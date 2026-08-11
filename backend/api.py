# ============================================
# API.PY
# Bridge between React frontend and Python.
# Updated for new gallery folder structure.
# ============================================

import os
import json
from pathlib import Path
from fastapi import FastAPI, HTTPException, Query, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional
import uvicorn
from fastapi.responses import FileResponse, JSONResponse
from config import (
    ROOT_DIR,
    GALLERY_DIR, PHOTOS_DIR, MISC_DIR,
    REMOVED_DIR, ARCHIVE_DIR, EXPORTS_DIR,
    THUMBNAILS_DIR, FACE_CROPS_DIR, DATA_DIR
)
from database import (
    get_all_photos, get_all_persons,
    get_all_clusters, get_person_photos,
    get_stats, name_cluster, get_connection,
    create_tables, update_photo_path
)

app = FastAPI(title="Family Gallery API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# Create avatars directory
from config import DATA_DIR
avatars_dir = DATA_DIR / "avatars"
avatars_dir.mkdir(parents=True, exist_ok=True)

app.mount(
    "/avatars",
    StaticFiles(directory=str(avatars_dir)),
    name="avatars"
)
# Serve static files
app.mount(
    "/thumbnails",
    StaticFiles(directory=str(THUMBNAILS_DIR)),
    name="thumbnails"
)

app.mount(
    "/face-crops",
    StaticFiles(directory=str(FACE_CROPS_DIR)),
    name="face-crops"
)


# ── Models ────────────────────────────────────

class NameClusterRequest(BaseModel):
    cluster_id: int
    person_name: str


# ── Helpers ───────────────────────────────────

def path_to_url(file_path, bust_cache=False):
    if not file_path:
        return None

    path = Path(file_path)
    cache_suffix = ""

    if bust_cache and path.exists():
        try:
            cache_suffix = f"?v={int(path.stat().st_mtime)}"
        except Exception:
            cache_suffix = ""

    try:
        rel = path.relative_to(THUMBNAILS_DIR)
        return f"/thumbnails/{rel}{cache_suffix}"
    except ValueError:
        pass

    try:
        rel = path.relative_to(FACE_CROPS_DIR)
        return f"/face-crops/{rel}{cache_suffix}"
    except ValueError:
        pass

    try:
        avatars_dir = DATA_DIR / "avatars"
        rel = path.relative_to(avatars_dir)
        return f"/avatars/{rel}{cache_suffix}"
    except ValueError:
        pass

    return file_path    


def parse_csv(value):
    if not value:
        return []
    return [v.strip() for v in value.split(',') if v.strip()]


# ── Routes ────────────────────────────────────

@app.get("/api-status")
def root():
    return {"status": "running", "message": "Family Gallery API v2.0"}


@app.get("/api/stats")
def api_stats():
    try:
        return get_stats()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/photos")
def api_get_photos(
    limit:  int = Query(default=50,  ge=1, le=500),
    offset: int = Query(default=0,   ge=0),
    person: Optional[str] = None,
    tag:    Optional[str] = None,
    fav:    Optional[bool] = None,
    family_only: Optional[bool] = None,
):
    try:
        conn = get_connection()
        conditions = ["p.processed = TRUE", "p.folder_type != 'removed'"]
        params = []
        if family_only:
            conditions.append("""
                p.id IN (
                    SELECT DISTINCT f.photo_id
                    FROM faces f
                    JOIN persons pr ON pr.id = f.person_id
                    WHERE pr.category = 'family'
                )
            """)
        if person:
            conditions.append("""
                p.id IN (
                    SELECT DISTINCT f.photo_id FROM faces f
                    JOIN persons pr ON pr.id = f.person_id
                    WHERE pr.name = ?
                )
            """)
            params.append(person)

        if tag:
            conditions.append("p.id IN (SELECT photo_id FROM tags WHERE tag = ?)")
            params.append(tag)

        if fav is not None:
            conditions.append("p.favorite = ?")
            params.append(fav)

        where = " AND ".join(conditions)

        rows = conn.execute(f"""
            SELECT p.id, p.file_path, p.file_name,
                   p.thumb_small, p.thumb_medium,
                   p.date_taken, p.has_faces, p.face_count,
                   p.width, p.height, p.favorite,
                   p.folder_type, p.batch_name
            FROM photos p
            WHERE {where}
            ORDER BY p.date_taken DESC NULLS LAST, p.id DESC
            LIMIT ? OFFSET ?
        """, params + [limit, offset]).fetchall()

        # Bulk fetch people and tags
        if rows:
            photo_ids = [r['id'] for r in rows]
            placeholders = ','.join('?' * len(photo_ids))
            
            people_rows = conn.execute(f"""
                SELECT f.photo_id, pr.name
                FROM faces f
                JOIN persons pr ON pr.id = f.person_id
                WHERE f.photo_id IN ({placeholders})
                AND f.person_id IS NOT NULL
            """, photo_ids).fetchall()
            
            tags_rows = conn.execute(f"""
                SELECT photo_id, tag FROM tags
                WHERE photo_id IN ({placeholders})
            """, photo_ids).fetchall()
            
            people_map = {}
            for r in people_rows:
                if r['photo_id'] not in people_map:
                    people_map[r['photo_id']] = []
                people_map[r['photo_id']].append(r['name'])
            
            tags_map = {}
            for r in tags_rows:
                if r['photo_id'] not in tags_map:
                    tags_map[r['photo_id']] = []
                tags_map[r['photo_id']].append(r['tag'])
        else:
            people_map = {}
            tags_map = {}

        conn.close()

        photos = []
        for row in rows:
            photo = dict(row)
            photo['thumb_small_url']  = path_to_url(photo['thumb_small'])
            photo['thumb_medium_url'] = path_to_url(photo['thumb_medium'])
            photo['people'] = people_map.get(photo['id'], [])
            photo['tags']   = tags_map.get(photo['id'], [])
            photos.append(photo)

        return {"photos": photos, "count": len(photos)}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/people")
def api_people():
    try:
        conn = get_connection()
        avatars_dir = DATA_DIR / "avatars"

        # Get all persons in one query
        persons = conn.execute("""
            SELECT id, name, photo_count, avatar_face_id, category
            FROM persons
            ORDER BY name ASC
        """).fetchall()

        # Get all avatar face crops in one query
        avatar_faces = {}
        if persons:
            person_ids = [p['id'] for p in persons]
            placeholders = ','.join('?' * len(person_ids))
            
            # Get best face per person in ONE query
            face_rows = conn.execute(f"""
                SELECT person_id, crop_path
                FROM faces
                WHERE person_id IN ({placeholders})
                AND crop_path IS NOT NULL
                GROUP BY person_id
                HAVING MAX(confidence)
            """, person_ids).fetchall()
            
            avatar_faces = {r['person_id']: r['crop_path'] for r in face_rows}

        # Get recent photos per person in ONE query
        recent_photos = {}
        if persons:
            person_ids = [p['id'] for p in persons]
            placeholders = ','.join('?' * len(person_ids))
            
            recent_rows = conn.execute(f"""
                SELECT f.person_id, p.thumb_small
                FROM faces f
                JOIN photos p ON p.id = f.photo_id
                WHERE f.person_id IN ({placeholders})
                AND p.thumb_small IS NOT NULL
                ORDER BY f.person_id, p.date_taken DESC NULLS LAST
            """, person_ids).fetchall()
            
            # Group by person, take first 3
            for row in recent_rows:
                pid = row['person_id']
                if pid not in recent_photos:
                    recent_photos[pid] = []
                if len(recent_photos[pid]) < 3:
                    recent_photos[pid].append(row['thumb_small'])

        conn.close()

        result = []
        for person in persons:
            p = dict(person)
            
            # Check for high-res avatar file first
            avatar_file = avatars_dir / f"avatar_{p['id']}.webp"
            if avatar_file.exists():
                ts = int(avatar_file.stat().st_mtime)
                p['avatar_url'] = f"/avatars/avatar_{p['id']}.webp?v={ts}"
            else:
                crop = avatar_faces.get(p['id'])
                p['avatar_url'] = path_to_url(crop) if crop else None

            p['recent_photos'] = [
                path_to_url(thumb) for thumb in recent_photos.get(p['id'], [])
            ]
            result.append(p)

        return {"people": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@app.post("/api/persons/{person_id}/upload-avatar")
async def api_upload_avatar(person_id: int, file: UploadFile = File(...)):
    """Upload any image as a person's avatar"""
    try:
        from PIL import Image as PILImage
        from config import DATA_DIR
        import io
        
        conn = get_connection()
        person = conn.execute(
            "SELECT name FROM persons WHERE id = ?", 
            (person_id,)
        ).fetchone()
        conn.close()
        
        if not person:
            raise HTTPException(status_code=404, detail="Person not found")
        
        contents = await file.read()
        img = PILImage.open(io.BytesIO(contents))
        img = img.convert('RGB')
        
        w, h = img.size
        if w != h:
            size = min(w, h)
            left = (w - size) // 2
            top = (h - size) // 2
            img = img.crop((left, top, left + size, top + size))
        
        img = img.resize((384, 384), PILImage.LANCZOS)
        
        avatars_dir = DATA_DIR / "avatars"
        avatars_dir.mkdir(parents=True, exist_ok=True)
        
        avatar_path = avatars_dir / f"avatar_{person_id}.webp"
        img.save(str(avatar_path), 'WEBP', quality=92)
        img.close()
        
        return {"success": True, "message": f"Avatar uploaded for {person['name']}"}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/people/{person_id}/photos")
def api_person_photos(
    person_id: int,
    limit:  int = Query(default=200, ge=1, le=500),
    offset: int = Query(default=0,   ge=0),
):
    try:
        photos = get_person_photos(person_id)
        result = []
        for photo in photos:
            photo['thumb_small_url']  = path_to_url(photo['thumb_small'])
            photo['thumb_medium_url'] = path_to_url(photo['thumb_medium'])
            result.append(photo)
        return {"photos": result[offset:offset+limit], "total": len(result)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/clusters")
def api_clusters():
    try:
        conn = get_connection()
        
        clusters_rows = conn.execute("""
            SELECT c.id, c.face_count, c.named
            FROM clusters c
            WHERE c.named = FALSE
            ORDER BY c.face_count DESC
        """).fetchall()
        
        clusters = []
        for cluster in clusters_rows:
            # Get face crops AND photo IDs for this cluster
            faces = conn.execute("""
                SELECT f.crop_path, f.photo_id, p.thumb_medium
                FROM faces f
                LEFT JOIN photos p ON p.id = f.photo_id
                WHERE f.cluster_id = ?
                AND f.crop_path IS NOT NULL
                LIMIT 6
            """, (cluster['id'],)).fetchall()

            photo_count = conn.execute("""
                SELECT COUNT(DISTINCT photo_id) 
                FROM faces WHERE cluster_id = ?
            """, (cluster['id'],)).fetchone()[0]

            clusters.append({
                'id':         cluster['id'],
                'face_count': cluster['face_count'],
                'photo_count': photo_count,
                'faces':      [
                    {
                        'crop_url': path_to_url(f['crop_path'], bust_cache=True),
                        'photo_id': f['photo_id'],
                        'photo_thumb': path_to_url(f['thumb_medium']) if f['thumb_medium'] else None
                    }
                    for f in faces
                ],
            })
        
        conn.close()
        return {"clusters": clusters, "count": len(clusters)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/clusters/name")
def api_name_cluster(request: NameClusterRequest):
    try:
        if not request.person_name.strip():
            raise HTTPException(status_code=400, detail="Name required")
        name_cluster(request.cluster_id, request.person_name.strip())
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/clusters/{cluster_id}/skip")
def api_skip_cluster(cluster_id: int):
    try:
        conn = get_connection()
        conn.execute(
            "UPDATE clusters SET named = TRUE WHERE id = ?",
            (cluster_id,)
        )
        conn.commit()
        conn.close()
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/clusters/{cluster_id}/not-a-person")
def api_not_person(cluster_id: int):
    """
    Mark cluster as not a real person.
    Removes face records completely so they
    never appear in any filter or gallery.
    """
    try:
        conn = get_connection()
        
        # Get all photo IDs affected
        photo_ids = conn.execute("""
            SELECT DISTINCT photo_id FROM faces 
            WHERE cluster_id = ?
        """, (cluster_id,)).fetchall()
        
        # Delete the face records entirely
        # These weren't real faces — remove them
        conn.execute("""
            DELETE FROM faces 
            WHERE cluster_id = ?
        """, (cluster_id,))
        
        # Mark cluster as handled
        conn.execute("""
            UPDATE clusters SET named = TRUE 
            WHERE id = ?
        """, (cluster_id,))
        
        # Update affected photos
        for row in photo_ids:
            pid = row['photo_id']
            
            # Recount faces for this photo
            remaining = conn.execute("""
                SELECT COUNT(*) as cnt FROM faces 
                WHERE photo_id = ?
            """, (pid,)).fetchone()['cnt']
            
            conn.execute("""
                UPDATE photos 
                SET face_count = ?,
                    has_faces = ?
                WHERE id = ?
            """, (remaining, remaining > 0, pid))
            
            # If no faces left, mark as misc
            if remaining == 0:
                conn.execute("""
                    UPDATE photos 
                    SET is_misc = TRUE, 
                        folder_type = 'misc'
                    WHERE id = ?
                """, (pid,))
                
                # Add misc tag
                conn.execute("""
                    INSERT OR IGNORE INTO tags (photo_id, tag, source)
                    VALUES (?, 'misc', 'system')
                """, (pid,))
        
        conn.commit()
        conn.close()
        
        return {"success": True, "message": "Marked as not a person"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/tags")
def api_tags():
    try:
        from database import get_all_custom_tags
        return {"tags": get_all_custom_tags()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/tags/{tag_name}/photos")
def api_tag_photos(
    tag_name: str,
    limit:  int = Query(default=200, ge=1, le=500),
    offset: int = Query(default=0,   ge=0),
):
    try:
        from database import get_photos_by_tag
        photos = get_photos_by_tag(tag_name)
        result = []
        for photo in photos:
            photo['thumb_small_url']  = path_to_url(photo['thumb_small'])
            photo['thumb_medium_url'] = path_to_url(photo['thumb_medium'])
            result.append(photo)
        return {"tag": tag_name, "photos": result[offset:offset+limit], "total": len(result)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/search")
def api_search(
    q:      str = Query(..., min_length=1),
    limit:  int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0,  ge=0),
):
    try:
        conn = get_connection()
        term = f"%{q}%"
        rows = conn.execute("""
            SELECT DISTINCT p.id, p.file_path, p.file_name,
                   p.thumb_small, p.thumb_medium, p.date_taken,
                   p.has_faces, p.width, p.height, p.favorite,
                   GROUP_CONCAT(DISTINCT pr.name) as people,
                   GROUP_CONCAT(DISTINCT t.tag)   as tags
            FROM photos p
            LEFT JOIN faces   f  ON f.photo_id  = p.id
            LEFT JOIN persons pr ON pr.id        = f.person_id
            LEFT JOIN tags    t  ON t.photo_id   = p.id
            WHERE p.processed = TRUE
            AND (pr.name LIKE ? OR t.tag LIKE ?
                 OR p.date_taken LIKE ? OR p.file_name LIKE ?)
            GROUP BY p.id
            ORDER BY p.date_taken DESC NULLS LAST
            LIMIT ? OFFSET ?
        """, (term, term, term, term, limit, offset)).fetchall()
        conn.close()

        photos = []
        for row in rows:
            photo = dict(row)
            photo['thumb_small_url']  = path_to_url(photo['thumb_small'])
            photo['thumb_medium_url'] = path_to_url(photo['thumb_medium'])
            photo['people'] = parse_csv(photo['people'])
            photo['tags']   = parse_csv(photo['tags'])
            photos.append(photo)

        return {"query": q, "photos": photos, "count": len(photos)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/photos/{photo_id}/original")
def api_original_photo(photo_id: int):
    """
    Serve the original full-resolution photo.
    Used by lightbox for sharp viewing.
    """
    try:
        conn = get_connection()
        row = conn.execute(
            "SELECT file_path, file_name FROM photos WHERE id = ?",
            (photo_id,)
        ).fetchone()
        conn.close()

        if not row:
            raise HTTPException(status_code=404, detail="Photo not found")

        file_path = Path(row['file_path'])

        if not file_path.exists():
            raise HTTPException(status_code=404, detail="File not found")

        # Determine media type
        suffix = file_path.suffix.lower()
        media_types = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.webp': 'image/webp',
            '.bmp': 'image/bmp',
            '.tiff': 'image/tiff',
            '.tif': 'image/tiff',
        }
        media_type = media_types.get(suffix, 'image/jpeg')

        return FileResponse(
            path=str(file_path),
            media_type=media_type,
            filename=row['file_name']
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
# ── # ── Person Management ─────────────────────────

class RenamePersonRequest(BaseModel):
    person_id: int
    new_name: str

class MergePersonsRequest(BaseModel):
    keep_id: int
    remove_id: int

class SetAvatarRequest(BaseModel):
    person_id: int
    face_id: int


@app.post("/api/persons/rename")
def api_rename_person(request: RenamePersonRequest):
    """Rename a person"""
    try:
        if not request.new_name.strip():
            raise HTTPException(status_code=400, detail="Name cannot be empty")
        
        conn = get_connection()
        
        existing = conn.execute(
            "SELECT id FROM persons WHERE name = ? AND id != ?",
            (request.new_name.strip(), request.person_id)
        ).fetchone()
        
        if existing:
            conn.close()
            raise HTTPException(status_code=400, detail=f"'{request.new_name}' already exists")
        
        conn.execute(
            "UPDATE persons SET name = ? WHERE id = ?",
            (request.new_name.strip(), request.person_id)
        )
        conn.commit()
        conn.close()
        return {"success": True, "message": f"Renamed to '{request.new_name}'"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/persons/merge")
def api_merge_persons(request: MergePersonsRequest):
    """Merge two people. All faces from remove_id go to keep_id."""
    try:
        if request.keep_id == request.remove_id:
            raise HTTPException(status_code=400, detail="Cannot merge person with themselves")
        
        conn = get_connection()
        
        keep = conn.execute("SELECT name FROM persons WHERE id = ?", (request.keep_id,)).fetchone()
        remove = conn.execute("SELECT name FROM persons WHERE id = ?", (request.remove_id,)).fetchone()
        
        if not keep or not remove:
            conn.close()
            raise HTTPException(status_code=404, detail="Person not found")
        
        # Move all faces
        conn.execute(
            "UPDATE faces SET person_id = ? WHERE person_id = ?",
            (request.keep_id, request.remove_id)
        )
        
        # Move any clusters
        conn.execute(
            "UPDATE clusters SET person_id = ? WHERE person_id = ?",
            (request.keep_id, request.remove_id)
        )
        
        # Delete removed person
        conn.execute("DELETE FROM persons WHERE id = ?", (request.remove_id,))
        
        # Update kept person photo count
        count = conn.execute(
            "SELECT COUNT(DISTINCT photo_id) as cnt FROM faces WHERE person_id = ?",
            (request.keep_id,)
        ).fetchone()['cnt']
        
        conn.execute(
            "UPDATE persons SET photo_count = ? WHERE id = ?",
            (count, request.keep_id)
        )
        
        conn.commit()
        conn.close()
        
        return {
            "success": True,
            "message": f"Merged '{remove['name']}' into '{keep['name']}' ({count} photos)"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class SetCategoryRequest(BaseModel):
    person_id: int
    category: str

@app.post("/api/persons/category")
def api_set_category(request: SetCategoryRequest):
    """Set a person's category (family, friends, etc)"""
    try:
        if not request.category.strip():
            raise HTTPException(status_code=400, detail="Category cannot be empty")
        
        conn = get_connection()
        conn.execute(
            "UPDATE persons SET category = ? WHERE id = ?",
            (request.category.strip().lower(), request.person_id)
        )
        conn.commit()
        conn.close()
        return {"success": True, "message": f"Category set to '{request.category}'"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/categories")
def api_get_categories():
    """Get all unique categories with person counts"""
    try:
        conn = get_connection()
        rows = conn.execute("""
            SELECT category, COUNT(*) as person_count
            FROM persons
            GROUP BY category
            ORDER BY person_count DESC
        """).fetchall()
        conn.close()
        return {"categories": [dict(r) for r in rows]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/persons/delete")
def api_delete_person(person_id: int = Query(...)):
    try:
        conn = get_connection()
        
        person = conn.execute(
            "SELECT name FROM persons WHERE id = ?", (person_id,)
        ).fetchone()
        
        if not person:
            conn.close()
            raise HTTPException(status_code=404, detail="Person not found")
        
        # Step 1: Unlink ALL faces
        conn.execute(
            "UPDATE faces SET person_id = NULL WHERE person_id = ?",
            (person_id,)
        )
        
        # Step 2: Unlink ALL clusters
        conn.execute(
            "UPDATE clusters SET person_id = NULL WHERE person_id = ?",
            (person_id,)
        )
        
        # Step 3: Delete avatar file
        try:
            avatar_path = DATA_DIR / "avatars" / f"avatar_{person_id}.webp"
            if avatar_path.exists():
                avatar_path.unlink()
        except Exception:
            pass
        
        # Step 4: Delete the person record
        conn.execute(
            "DELETE FROM persons WHERE id = ?",
            (person_id,)
        )
        
        conn.commit()
        conn.close()
        
        return {"success": True, "message": f"Deleted '{person['name']}'"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/persons/avatar")
def api_set_avatar(request: SetAvatarRequest):
    """
    Set a face as person's avatar.
    Generates a high-quality avatar crop from the ORIGINAL photo.
    """
    try:
        from PIL import Image, ImageOps
        from config import DATA_DIR
        
        conn = get_connection()
        
        # Get the face info
        face = conn.execute("""
            SELECT f.id, f.photo_id, f.bbox_x, f.bbox_y, 
                   f.bbox_w, f.bbox_h, f.person_id,
                   p.file_path
            FROM faces f
            JOIN photos p ON p.id = f.photo_id
            WHERE f.id = ? AND f.person_id = ?
        """, (request.face_id, request.person_id)).fetchone()
        
        if not face:
            conn.close()
            raise HTTPException(status_code=400, detail="Face not found for this person")
        
        file_path = Path(face['file_path'])
        
        if not file_path.exists():
            conn.close()
            raise HTTPException(status_code=404, detail="Original photo not found")
        
        # Open the original full-res photo
        img = Image.open(str(file_path))
        try:
            img = ImageOps.exif_transpose(img)
        except Exception:
            pass
        img = img.convert('RGB')
        
        img_w, img_h = img.size
        
        # Get face bounding box
        x = face['bbox_x'] or 0
        y = face['bbox_y'] or 0
        w = face['bbox_w'] or 100
        h = face['bbox_h'] or 100
        
        # Add generous padding around face (50%)
        pad = max(w, h) * 0.5
        
        # Calculate crop region
        cx = x + w / 2  # center x
        cy = y + h / 2  # center y
        
        # Make it square
        size = max(w, h) + pad * 2
        
        x1 = max(0, int(cx - size / 2))
        y1 = max(0, int(cy - size / 2))
        x2 = min(img_w, int(cx + size / 2))
        y2 = min(img_h, int(cy + size / 2))
        
        # Crop
        avatar_img = img.crop((x1, y1, x2, y2))
        
        # Resize to 384x384 for sharp avatar
        avatar_img = avatar_img.resize((384, 384), Image.LANCZOS)
        
        # Save avatar
        avatars_dir = DATA_DIR / "avatars"
        avatars_dir.mkdir(parents=True, exist_ok=True)
        
        avatar_path = avatars_dir / f"avatar_{request.person_id}.webp"
        avatar_img.save(str(avatar_path), 'WEBP', quality=92)
        
        img.close()
        avatar_img.close()
        
        # Update person record
        conn.execute(
            "UPDATE persons SET avatar_face_id = ? WHERE id = ?",
            (request.face_id, request.person_id)
        )
        conn.commit()
        conn.close()
        
        return {"success": True, "message": "Avatar updated"}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/persons/{person_id}/faces")
def api_person_faces(person_id: int):
    """Get all face crops for avatar selection"""
    try:
        conn = get_connection()
        rows = conn.execute("""
            SELECT id, crop_path, confidence
            FROM faces
            WHERE person_id = ?
            AND crop_path IS NOT NULL
            ORDER BY confidence DESC
            LIMIT 20
        """, (person_id,)).fetchall()
        conn.close()
        
        return {
            "faces": [
                {
                    'id': row['id'],
                    'crop_url': path_to_url(row['crop_path']),
                    'confidence': row['confidence'],
                }
                for row in rows
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
#----------------------------------

@app.post("/api/photos/{photo_id}/delete")
def api_delete_photo(photo_id: int):
    """Move photo to removed folder"""
    try:
        import shutil
        conn = get_connection()
        row = conn.execute(
            "SELECT file_path, batch_name FROM photos WHERE id = ?",
            (photo_id,)
        ).fetchone()
        
        if not row:
            conn.close()
            raise HTTPException(status_code=404)
        
        source = Path(row['file_path'])
        batch = row['batch_name'] or 'unknown'
        
        if source.exists():
            from config import REMOVED_DIR
            dest_dir = REMOVED_DIR / batch
            dest_dir.mkdir(parents=True, exist_ok=True)
            dest = dest_dir / source.name
            counter = 1
            while dest.exists():
                dest = dest_dir / f"{source.stem}_{counter}{source.suffix}"
                counter += 1
            shutil.move(str(source), str(dest))
            update_photo_path(photo_id, str(dest), 'removed')
        
        conn.close()
        return {"success": True, "message": "Photo moved to removed folder"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@app.post("/api/photos/{photo_id}/favorite")
def api_fav(photo_id: int):
    try:
        conn = get_connection()
        row = conn.execute(
            "SELECT favorite FROM photos WHERE id = ?",
            (photo_id,)
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404)
        new = not bool(row['favorite'])
        conn.execute(
            "UPDATE photos SET favorite = ? WHERE id = ?",
            (new, photo_id)
        )
        conn.commit()
        conn.close()
        return {"success": True, "favorite": new}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/photos/{photo_id}/remove")
def api_remove_photo(photo_id: int):
    """
    Move a photo to the removed folder.
    App NEVER deletes — just moves.
    YOU can recover from removed folder anytime.
    """
    try:
        conn = get_connection()
        row = conn.execute(
            "SELECT file_path, batch_name FROM photos WHERE id = ?",
            (photo_id,)
        ).fetchone()
        
        if not row:
            raise HTTPException(status_code=404)
        
        source = Path(row['file_path'])
        batch  = row['batch_name'] or 'unknown'
        
        if source.exists():
            dest_dir = REMOVED_DIR / batch
            dest_dir.mkdir(parents=True, exist_ok=True)
            dest = dest_dir / source.name
            
            import shutil
            shutil.move(str(source), str(dest))
            
            update_photo_path(photo_id, str(dest), 'removed')
        
        conn.close()
        return {"success": True, "message": "Photo moved to removed folder"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/photos/{photo_id}/archive")
def api_archive_photo(photo_id: int):
    """Move a photo to the archive folder"""
    try:
        import shutil
        conn = get_connection()
        row = conn.execute(
            "SELECT file_path, batch_name FROM photos WHERE id = ?",
            (photo_id,)
        ).fetchone()
        
        if not row:
            conn.close()
            raise HTTPException(status_code=404)
        
        source = Path(row['file_path'])
        batch  = row['batch_name'] or 'unknown'
        
        if source.exists():
            from config import ARCHIVE_DIR
            dest_dir = ARCHIVE_DIR / batch
            dest_dir.mkdir(parents=True, exist_ok=True)
            dest = dest_dir / source.name
            counter = 1
            while dest.exists():
                dest = dest_dir / f"{source.stem}_{counter}{source.suffix}"
                counter += 1
            shutil.move(str(source), str(dest))
            update_photo_path(photo_id, str(dest), 'archive')
        
        conn.close()
        return {"success": True, "message": "Photo archived"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/scan")
def api_scan(tag: Optional[str] = Query(default=None)):
    """
    Trigger a new photo scan.
    Optional tag parameter becomes the batch folder name.
    """
    import threading
    from progress import get_progress, reset_progress

    current = get_progress()
    if current['running']:
        return {"success": False, "message": "Already running"}

    reset_progress()

    custom_tag = tag.strip() if tag else None

    def pipeline():
        try:
            from scanner import scan_photos_folder
            from detector import run_face_detection
            from clusterer import run_clustering
            scan_photos_folder(custom_tag=custom_tag)
            run_face_detection()
            run_clustering()
        except Exception as e:
            from progress import finish_progress
            finish_progress(f"Error: {e}")

    threading.Thread(target=pipeline, daemon=True).start()

    msg = f"Scan started with tag '{custom_tag}'" if custom_tag else "Scan started"
    return {"success": True, "message": msg}

@app.get("/api/progress")
def api_progress():
    from progress import get_progress
    return get_progress()


@app.post("/api/progress/reset")
def api_progress_reset():
    from progress import reset_progress
    reset_progress()
    return {"success": True}

# ── Manual Tagging ────────────────────────────

class AddPersonRequest(BaseModel):
    photo_id:   int
    person_name: str

class RemovePersonRequest(BaseModel):
    photo_id:  int
    person_id: int

class FixPersonRequest(BaseModel):
    photo_id:      int
    old_person_id: int
    new_person_name: str

class AddTagRequest(BaseModel):
    photo_id: int
    tag:      str

class RemoveTagRequest(BaseModel):
    photo_id: int
    tag:      str


@app.post("/api/photos/add-person")
def api_add_person(request: AddPersonRequest):
    """
    Manually tag a person in a photo.
    Creates person if they don't exist yet.
    """
    try:
        conn = get_connection()

        # Create person if doesn't exist
        conn.execute("""
            INSERT OR IGNORE INTO persons (name)
            VALUES (?)
        """, (request.person_name.strip(),))

        # Get person ID
        person = conn.execute("""
            SELECT id FROM persons WHERE name = ?
        """, (request.person_name.strip(),)).fetchone()

        person_id = person['id']

        # Check if a face record exists for this photo
        # that isn't assigned to anyone
        unassigned_face = conn.execute("""
            SELECT id FROM faces
            WHERE photo_id = ?
            AND person_id IS NULL
            LIMIT 1
        """, (request.photo_id,)).fetchone()

        if unassigned_face:
            # Assign existing unassigned face
            conn.execute("""
                UPDATE faces
                SET person_id = ?
                WHERE id = ?
            """, (person_id, unassigned_face['id']))
        else:
            # Create a manual face record
            # (no bbox or embedding — manually added)
            conn.execute("""
                INSERT INTO faces
                (photo_id, person_id, confidence)
                VALUES (?, ?, 1.0)
            """, (request.photo_id, person_id))

        # Update photo has_faces flag
        conn.execute("""
            UPDATE photos SET has_faces = TRUE
            WHERE id = ?
        """, (request.photo_id,))

        # Update person photo count
        conn.execute("""
            UPDATE persons
            SET photo_count = (
                SELECT COUNT(DISTINCT photo_id)
                FROM faces WHERE person_id = ?
            )
            WHERE id = ?
        """, (person_id, person_id))

        conn.commit()
        conn.close()

        return {
            "success":   True,
            "person_id": person_id,
            "message":   f"Added {request.person_name} to photo"
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/photos/remove-person")
def api_remove_person(request: RemovePersonRequest):
    """
    Remove a person tag from a photo.
    Doesn't delete the person — just unlinks
    them from this specific photo.
    """
    try:
        conn = get_connection()

        # Remove face records linking this person to this photo
        conn.execute("""
            UPDATE faces
            SET person_id = NULL
            WHERE photo_id = ?
            AND person_id = ?
        """, (request.photo_id, request.person_id))

        # Check if photo still has any faces
        remaining = conn.execute("""
            SELECT COUNT(*) as cnt FROM faces
            WHERE photo_id = ?
            AND person_id IS NOT NULL
        """, (request.photo_id,)).fetchone()

        if remaining['cnt'] == 0:
            conn.execute("""
                UPDATE photos SET has_faces = FALSE
                WHERE id = ?
            """, (request.photo_id,))

        # Update person photo count
        conn.execute("""
            UPDATE persons
            SET photo_count = (
                SELECT COUNT(DISTINCT photo_id)
                FROM faces WHERE person_id = ?
            )
            WHERE id = ?
        """, (request.person_id, request.person_id))

        conn.commit()
        conn.close()

        return {"success": True, "message": "Person removed from photo"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/photos/fix-person")
def api_fix_person(request: FixPersonRequest):
    """
    Fix a wrong person tag.
    Changes "Mom" to "Aunt Sarah" on one photo.
    """
    try:
        conn = get_connection()

        # Create new person if doesn't exist
        conn.execute("""
            INSERT OR IGNORE INTO persons (name)
            VALUES (?)
        """, (request.new_person_name.strip(),))

        # Get new person ID
        new_person = conn.execute("""
            SELECT id FROM persons WHERE name = ?
        """, (request.new_person_name.strip(),)).fetchone()

        new_person_id = new_person['id']

        # Update face record
        conn.execute("""
            UPDATE faces
            SET person_id = ?
            WHERE photo_id = ?
            AND person_id = ?
        """, (new_person_id, request.photo_id, request.old_person_id))

        # Update BOTH person photo counts
        for pid in [request.old_person_id, new_person_id]:
            conn.execute("""
                UPDATE persons
                SET photo_count = (
                    SELECT COUNT(DISTINCT photo_id)
                    FROM faces WHERE person_id = ?
                )
                WHERE id = ?
            """, (pid, pid))

        conn.commit()
        conn.close()

        return {
            "success":        True,
            "new_person_id":  new_person_id,
            "message": f"Changed to {request.new_person_name}"
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/photos/add-tag")
def api_add_tag(request: AddTagRequest):
    """Add a custom tag to a photo"""
    try:
        conn = get_connection()
        conn.execute("""
            INSERT OR IGNORE INTO tags (photo_id, tag, source)
            VALUES (?, ?, 'manual')
        """, (request.photo_id, request.tag.strip().lower()))
        conn.commit()
        conn.close()
        return {"success": True, "message": f"Added tag '{request.tag}'"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/photos/remove-tag")
def api_remove_tag(request: RemoveTagRequest):
    """Remove a tag from a photo"""
    try:
        conn = get_connection()
        conn.execute("""
            DELETE FROM tags
            WHERE photo_id = ? AND tag = ?
        """, (request.photo_id, request.tag.strip().lower()))
        conn.commit()
        conn.close()
        return {"success": True, "message": f"Removed tag '{request.tag}'"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/persons/all")
def api_all_persons():
    try:
        conn = get_connection()
        rows = conn.execute("""
            SELECT id, name, photo_count, avatar_face_id, category
            FROM persons
            ORDER BY name ASC
        """).fetchall()

        avatars_dir = DATA_DIR / "avatars"
        result = []
        
        for row in rows:
            person = dict(row)
            
            # Check for high-res avatar file first
            avatar_file = avatars_dir / f"avatar_{person['id']}.webp"
            
            if avatar_file.exists():
                ts = int(avatar_file.stat().st_mtime)
                person['avatar_url'] = f"/avatars/avatar_{person['id']}.webp?v={ts}"
            else:
                # Fallback to face crop
                face = conn.execute("""
                    SELECT crop_path FROM faces
                    WHERE person_id = ? AND crop_path IS NOT NULL
                    ORDER BY confidence DESC LIMIT 1
                """, (person['id'],)).fetchone()
                
                person['avatar_url'] = (
                    path_to_url(face['crop_path']) if face else None
                )
            
            result.append(person)

        conn.close()
        return {"persons": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/photos/untagged")
def api_untagged_photos(
    limit:  int = Query(default=200, ge=1, le=1000),
    offset: int = Query(default=0,   ge=0),
):
    """
    Get photos that have detected faces but no person assigned.
    These are photos that need human review.
    NOT photos with no faces (those are misc).
    """
    try:
        conn = get_connection()
        
        rows = conn.execute("""
            SELECT p.id, p.file_path, p.file_name,
                   p.thumb_small, p.thumb_medium,
                   p.date_taken, p.has_faces, p.face_count,
                   p.width, p.height, p.favorite,
                   p.folder_type, p.batch_name
            FROM photos p
            WHERE p.processed = TRUE
            AND p.has_faces = TRUE
            AND p.id IN (
                SELECT DISTINCT f.photo_id 
                FROM faces f
                WHERE f.person_id IS NULL
            )
            ORDER BY p.id DESC
            LIMIT ? OFFSET ?
        """, (limit, offset)).fetchall()

        total = conn.execute("""
            SELECT COUNT(DISTINCT p.id)
            FROM photos p
            WHERE p.processed = TRUE
            AND p.has_faces = TRUE
            AND p.id IN (
                SELECT DISTINCT f.photo_id 
                FROM faces f
                WHERE f.person_id IS NULL
            )
        """).fetchone()[0]

        conn.close()

        photos = []
        for row in rows:
            photo = dict(row)
            photo['thumb_small_url']  = path_to_url(photo['thumb_small'])
            photo['thumb_medium_url'] = path_to_url(photo['thumb_medium'])
            photo['people'] = []
            photo['tags']   = []
            photos.append(photo)

        return {
            "photos": photos,
            "count":  len(photos),
            "total":  total
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@app.get("/api/photos/filter")
def api_filter_photos(
    persons:         Optional[str]  = Query(default=None),
    exclusive:       Optional[bool] = Query(default=False),
    exclude_person:  Optional[str]  = Query(default=None),
    min_faces:       Optional[int]  = Query(default=None),
    max_faces:       Optional[int]  = Query(default=None),
    tag:             Optional[str]  = Query(default=None),
    tags:            Optional[str]  = Query(default=None),
    batch:           Optional[str]  = Query(default=None),
    folder_type:     Optional[str]  = Query(default=None),
    favorite:        Optional[bool] = Query(default=None),
    has_faces:       Optional[bool] = Query(default=None),
    family_only:     Optional[bool] = Query(default=None),
    untagged:        Optional[bool] = Query(default=None),
    notag:           Optional[bool] = Query(default=None),
    limit:           int = Query(default=50, ge=1, le=500),
    offset:          int = Query(default=0, ge=0),
):
    try:
        conn = get_connection()
        conditions = ["p.processed = TRUE", "p.folder_type != 'removed'"]
        params = []

        # Person filters
        if persons:
            person_list = [n.strip() for n in persons.split(',') if n.strip()]
            if person_list:
                if exclusive:
                    for name in person_list:
                        conditions.append("""
                            p.id IN (
                                SELECT f.photo_id FROM faces f
                                JOIN persons pr ON pr.id = f.person_id
                                WHERE pr.name = ?
                            )
                        """)
                        params.append(name)
                    placeholders = ','.join('?' * len(person_list))
                    conditions.append(f"""
                        p.id NOT IN (
                            SELECT DISTINCT f.photo_id FROM faces f
                            JOIN persons pr ON pr.id = f.person_id
                            WHERE pr.name NOT IN ({placeholders})
                            AND f.person_id IS NOT NULL
                        )
                    """)
                    params.extend(person_list)
                else:
                    for name in person_list:
                        conditions.append("""
                            p.id IN (
                                SELECT f.photo_id FROM faces f
                                JOIN persons pr ON pr.id = f.person_id
                                WHERE pr.name = ?
                            )
                        """)
                        params.append(name)

        # Exclude persons
        if exclude_person:
            exclude_list = [n.strip() for n in exclude_person.split(',') if n.strip()]
            for name in exclude_list:
                conditions.append("""
                    p.id NOT IN (
                        SELECT DISTINCT f.photo_id FROM faces f
                        JOIN persons pr ON pr.id = f.person_id
                        WHERE pr.name = ?
                    )
                """)
                params.append(name)

        # Face count
        if min_faces is not None:
            conditions.append("p.face_count >= ?")
            params.append(min_faces)
        if max_faces is not None:
            conditions.append("p.face_count <= ?")
            params.append(max_faces)

        # Single tag
        if tag:
            conditions.append("p.id IN (SELECT photo_id FROM tags WHERE tag = ?)")
            params.append(tag)

        # Multiple tags (OR logic)
        if tags:
            tag_list = [t.strip() for t in tags.split(',') if t.strip()]
            if tag_list:
                placeholders = ','.join('?' * len(tag_list))
                conditions.append(f"""
                    p.id IN (
                        SELECT DISTINCT photo_id FROM tags WHERE tag IN ({placeholders})
                    )
                """)
                params.extend(tag_list)

        # Batch
        if batch:
            conditions.append("p.batch_name = ?")
            params.append(batch)

        # Folder type
        if folder_type:
            conditions.append("p.folder_type = ?")
            params.append(folder_type)

        # Favorite
        if favorite is not None:
            conditions.append("p.favorite = ?")
            params.append(favorite)

        # Has faces
        if has_faces is not None:
            if has_faces:
                conditions.append("p.has_faces = TRUE")
            else:
                conditions.append("(p.has_faces = FALSE OR p.is_misc = TRUE)")

        # Family only
        if family_only:
            conditions.append("""
                p.id IN (
                    SELECT DISTINCT f.photo_id
                    FROM faces f
                    JOIN persons pr ON pr.id = f.person_id
                    WHERE pr.category = 'family'
                )
            """)

        # Untagged — has faces but at least one face unnamed
        if untagged:
            conditions.append("p.has_faces = TRUE")
            conditions.append("""
                p.id IN (
                    SELECT DISTINCT f.photo_id 
                    FROM faces f
                    WHERE f.person_id IS NULL
                )
            """)

        # No tag — has faces but ZERO faces are named
        if notag:
            conditions.append("p.has_faces = TRUE")
            conditions.append("""
                p.id NOT IN (
                    SELECT DISTINCT f.photo_id 
                    FROM faces f
                    WHERE f.person_id IS NOT NULL
                )
            """)

        # ── Build WHERE clause ────────────────────
        where = " AND ".join(conditions)

        # Count query
        count_params = params.copy()
        total = conn.execute(f"""
            SELECT COUNT(DISTINCT p.id) FROM photos p WHERE {where}
        """, count_params).fetchone()[0]

        # Main query
        rows = conn.execute(f"""
            SELECT DISTINCT
                p.id, p.file_path, p.file_name,
                p.thumb_small, p.thumb_medium,
                p.date_taken, p.has_faces, p.face_count,
                p.width, p.height, p.favorite,
                p.folder_type, p.batch_name
            FROM photos p
            WHERE {where}
            ORDER BY p.date_taken DESC NULLS LAST, p.id DESC
            LIMIT ? OFFSET ?
        """, params + [limit, offset]).fetchall()

        # Bulk fetch people and tags
        if rows:
            photo_ids = [r['id'] for r in rows]
            placeholders = ','.join('?' * len(photo_ids))

            people_rows = conn.execute(f"""
                SELECT f.photo_id, pr.name
                FROM faces f
                JOIN persons pr ON pr.id = f.person_id
                WHERE f.photo_id IN ({placeholders})
                AND f.person_id IS NOT NULL
            """, photo_ids).fetchall()

            tags_rows = conn.execute(f"""
                SELECT photo_id, tag FROM tags
                WHERE photo_id IN ({placeholders})
            """, photo_ids).fetchall()

            people_map = {}
            for r in people_rows:
                if r['photo_id'] not in people_map:
                    people_map[r['photo_id']] = []
                people_map[r['photo_id']].append(r['name'])

            tags_map = {}
            for r in tags_rows:
                if r['photo_id'] not in tags_map:
                    tags_map[r['photo_id']] = []
                tags_map[r['photo_id']].append(r['tag'])
        else:
            people_map = {}
            tags_map = {}

        conn.close()

        photos = []
        for row in rows:
            photo = dict(row)
            photo['thumb_small_url']  = path_to_url(photo['thumb_small'])
            photo['thumb_medium_url'] = path_to_url(photo['thumb_medium'])
            photo['people'] = people_map.get(photo['id'], [])
            photo['tags']   = tags_map.get(photo['id'], [])
            photos.append(photo)

        return {"photos": photos, "count": len(photos), "total": total}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/persons/{person_name}/co-appearances")
def api_co_appearances(person_name: str):
    """
    Who appears most with this person?
    Returns ranked list of people who appear
    in photos together with the given person.
    """
    try:
        conn = get_connection()
        rows = conn.execute("""
            SELECT 
                pr2.name,
                pr2.id,
                COUNT(DISTINCT f1.photo_id) as together_count
            FROM faces f1
            JOIN persons pr1 ON pr1.id = f1.person_id
            JOIN faces f2 ON f2.photo_id = f1.photo_id AND f2.id != f1.id
            JOIN persons pr2 ON pr2.id = f2.person_id
            WHERE pr1.name = ?
            AND pr2.name != ?
            GROUP BY pr2.name
            ORDER BY together_count DESC
        """, (person_name, person_name)).fetchall()
        conn.close()
        
        return {
            "person": person_name,
            "co_appearances": [dict(r) for r in rows]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/batches")
def api_batches():
    """Get all batch names with photo counts"""
    try:
        conn = get_connection()
        rows = conn.execute("""
            SELECT 
                batch_name,
                COUNT(*) as photo_count,
                SUM(CASE WHEN has_faces THEN 1 ELSE 0 END) as face_photos,
                SUM(CASE WHEN is_misc THEN 1 ELSE 0 END) as misc_photos
            FROM photos
            WHERE processed = TRUE
            AND batch_name IS NOT NULL
            GROUP BY batch_name
            ORDER BY batch_name DESC
        """).fetchall()
        conn.close()
        return {"batches": [dict(r) for r in rows]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


    
@app.post("/api/photos/{photo_id}/rotate")
def api_rotate_photo(photo_id: int):
    """
    Rotate a photo 90 degrees clockwise.
    Saves the corrected version to disk
    and regenerates thumbnails.
    """
    try:
        from PIL import Image
        from config import THUMBNAILS_DIR, THUMBNAIL_SIZES

        conn = get_connection()
        row = conn.execute(
            "SELECT file_path FROM photos WHERE id = ?",
            (photo_id,)
        ).fetchone()
        conn.close()

        if not row:
            raise HTTPException(status_code=404, detail="Photo not found")

        file_path = Path(row['file_path'])

        if not file_path.exists():
            raise HTTPException(status_code=404, detail="File not found on disk")

        # Open and rotate 90 degrees clockwise
        img = Image.open(str(file_path))
        img = img.rotate(-90, expand=True)
        img_rgb = img.convert('RGB')

        # Save back to disk
        suffix = file_path.suffix.lower()
        if suffix in ['.jpg', '.jpeg']:
            img_rgb.save(str(file_path), 'JPEG', quality=95)
        elif suffix == '.png':
            img_rgb.save(str(file_path), 'PNG')
        elif suffix == '.webp':
            img_rgb.save(str(file_path), 'WEBP', quality=95)
        else:
            img_rgb.save(str(file_path), 'JPEG', quality=95)

        # Update dimensions in database
        w, h = img_rgb.size
        conn = get_connection()
        conn.execute(
            "UPDATE photos SET width = ?, height = ? WHERE id = ?",
            (w, h, photo_id)
        )
        conn.commit()
        conn.close()

        # Regenerate thumbnails
        for size_name, (max_w, max_h) in THUMBNAIL_SIZES.items():
            thumb = img_rgb.copy()
            thumb.thumbnail((max_w, max_h), Image.LANCZOS)
            filename  = f"{photo_id}_{size_name}.webp"
            save_path = THUMBNAILS_DIR / filename
            thumb.save(str(save_path), 'WEBP', quality=85)

        img.close()
        img_rgb.close()

        return {"success": True, "message": "Photo rotated 90° clockwise"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    


@app.get("/api/photos/download-zip")
def api_download_zip(
    persons:        Optional[str]  = Query(default=None),
    exclusive:      Optional[bool] = Query(default=False),
    exclude_person: Optional[str]  = Query(default=None),
    tag:            Optional[str]  = Query(default=None),
    tags:           Optional[str]  = Query(default=None),
    favorite:       Optional[bool] = Query(default=None),
    family_only:    Optional[bool] = Query(default=None),
):
    """
    Download filtered photos as a zip file.
    Uses same filter params as /api/photos/filter
    """
    import zipfile
    import tempfile

    try:
        conn = get_connection()

        conditions = ["p.processed = TRUE", "p.folder_type != 'removed'"]
        params = []

        # Build same filters as /api/photos/filter
        if persons:
            person_list = [n.strip() for n in persons.split(',') if n.strip()]
            if person_list:
                for name in person_list:
                    conditions.append("""
                        p.id IN (
                            SELECT f.photo_id FROM faces f
                            JOIN persons pr ON pr.id = f.person_id
                            WHERE pr.name = ?
                        )
                    """)
                    params.append(name)

                if exclusive:
                    placeholders = ','.join('?' * len(person_list))
                    conditions.append(f"""
                        p.id NOT IN (
                            SELECT DISTINCT f.photo_id FROM faces f
                            JOIN persons pr ON pr.id = f.person_id
                            WHERE pr.name NOT IN ({placeholders})
                        )
                    """)
                    params.extend(person_list)
        if family_only:
            conditions.append("""
                p.id IN (
                    SELECT DISTINCT f.photo_id
                    FROM faces f
                    JOIN persons pr ON pr.id = f.person_id
                    WHERE pr.category = 'family'
                )
            """)
        if exclude_person:
            exclude_list = [n.strip() for n in exclude_person.split(',') if n.strip()]
            for name in exclude_list:
                conditions.append("""
                    p.id NOT IN (
                        SELECT DISTINCT f.photo_id FROM faces f
                        JOIN persons pr ON pr.id = f.person_id
                        WHERE pr.name = ?
                    )
                """)
                params.append(name)

        if tag:
            conditions.append("""
                p.id IN (SELECT photo_id FROM tags WHERE tag = ?)
            """)
            params.append(tag)
        
        if tags:
            tag_list = [t.strip() for t in tags.split(',') if t.strip()]
            if tag_list:
                placeholders = ','.join('?' * len(tag_list))
                conditions.append(f"""
                    p.id IN (
                        SELECT photo_id FROM tags WHERE tag IN ({placeholders})
                    )
                """)
                params.extend(tag_list)

        if favorite:
            conditions.append("p.favorite = TRUE")

        where = " AND ".join(conditions)

        rows = conn.execute(f"""
            SELECT p.file_path, p.file_name
            FROM photos p
            WHERE {where}
        """, params).fetchall()
        conn.close()

        if not rows:
            raise HTTPException(status_code=404, detail="No photos match filters")

        # Create zip in temp file
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix='.zip')
        tmp_path = tmp.name
        tmp.close()

        with zipfile.ZipFile(tmp_path, 'w', zipfile.ZIP_DEFLATED) as zf:
            seen_names = {}
            for row in rows:
                file_path = Path(row['file_path'])
                if not file_path.exists():
                    continue

                # Handle duplicate filenames in zip
                name = row['file_name']
                if name in seen_names:
                    seen_names[name] += 1
                    stem = file_path.stem
                    suffix = file_path.suffix
                    name = f"{stem}_{seen_names[name]}{suffix}"
                else:
                    seen_names[name] = 0

                zf.write(str(file_path), name)

        # Build descriptive filename
        zip_name = "family_gallery"
        if persons:
            zip_name += "_" + persons.replace(",", "_")
        if tag:
            zip_name += "_" + tag
        if favorite:
            zip_name += "_favorites"
        zip_name += ".zip"

        return FileResponse(
            path=tmp_path,
            filename=zip_name,
            media_type='application/zip',
            background=None,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/photos/notag")
def api_notag_photos(
    limit:  int = Query(default=200, ge=1, le=1000),
    offset: int = Query(default=0,   ge=0),
):
    """
    Get photos with faces but ZERO person tags.
    Not a single face in the photo has been identified.
    Different from 'untagged' which includes partially tagged.
    """
    try:
        conn = get_connection()
        
        rows = conn.execute("""
            SELECT p.id, p.file_path, p.file_name,
                   p.thumb_small, p.thumb_medium,
                   p.date_taken, p.has_faces, p.face_count,
                   p.width, p.height, p.favorite,
                   p.folder_type, p.batch_name
            FROM photos p
            WHERE p.processed = TRUE
            AND p.has_faces = TRUE
            AND p.id NOT IN (
                SELECT DISTINCT f.photo_id 
                FROM faces f
                WHERE f.person_id IS NOT NULL
            )
            ORDER BY p.id DESC
            LIMIT ? OFFSET ?
        """, (limit, offset)).fetchall()

        total = conn.execute("""
            SELECT COUNT(DISTINCT p.id)
            FROM photos p
            WHERE p.processed = TRUE
            AND p.has_faces = TRUE
            AND p.id NOT IN (
                SELECT DISTINCT f.photo_id 
                FROM faces f
                WHERE f.person_id IS NOT NULL
            )
        """).fetchone()[0]

        conn.close()

        photos = []
        for row in rows:
            photo = dict(row)
            photo['thumb_small_url']  = path_to_url(photo['thumb_small'])
            photo['thumb_medium_url'] = path_to_url(photo['thumb_medium'])
            photo['people'] = []
            photo['tags']   = []
            photos.append(photo)

        return {
            "photos": photos,
            "count":  len(photos),
            "total":  total
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/photos/{photo_id}")
def api_get_photo(photo_id: int):
    """Get single photo with full details"""
    try:
        conn = get_connection()
        row = conn.execute("""
            SELECT p.*,
                   GROUP_CONCAT(DISTINCT pr.name) as people,
                   GROUP_CONCAT(DISTINCT t.tag)   as tags
            FROM photos p
            LEFT JOIN faces   f  ON f.photo_id = p.id
            LEFT JOIN persons pr ON pr.id       = f.person_id
            LEFT JOIN tags    t  ON t.photo_id  = p.id
            WHERE p.id = ?
            GROUP BY p.id
        """, (photo_id,)).fetchone()
        conn.close()

        if not row:
            raise HTTPException(status_code=404)

        photo = dict(row)
        photo['thumb_small_url']  = path_to_url(photo['thumb_small'])
        photo['thumb_medium_url'] = path_to_url(photo['thumb_medium'])
        photo['people'] = parse_csv(photo['people'])
        photo['tags']   = parse_csv(photo['tags'])
        return photo

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/photos/{photo_id}/download")
def api_download_photo(photo_id: int):
    """Download original full-resolution photo"""
    try:
        conn = get_connection()
        row = conn.execute(
            "SELECT file_path, file_name FROM photos WHERE id = ?",
            (photo_id,)
        ).fetchone()
        conn.close()

        if not row:
            raise HTTPException(status_code=404, detail="Photo not found")

        file_path = Path(row['file_path'])

        if not file_path.exists():
            raise HTTPException(status_code=404, detail="File not found on disk")

        return FileResponse(
            path=str(file_path),
            filename=row['file_name'],
            media_type='application/octet-stream'
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Settings Endpoints ────────────────────────

@app.get("/api/settings/stats")
def api_detailed_stats():
    """Get detailed database and storage stats"""
    import shutil
    from config import (
        GALLERY_DIR, PHOTOS_DIR, MISC_DIR, DUPLICATES_DIR,
        REMOVED_DIR, ARCHIVE_DIR, ERRORS_DIR, EXPORTS_DIR,
        VIDEOS_DIR, THUMBNAILS_DIR, FACE_CROPS_DIR,
        DATA_DIR, DATABASE_PATH, INBOX_DIR
    )
    
    try:
        conn = get_connection()
        
        stats = {
            'total_photos': conn.execute(
                "SELECT COUNT(*) FROM photos WHERE processed = TRUE"
            ).fetchone()[0],
            'photos_with_faces': conn.execute(
                "SELECT COUNT(*) FROM photos WHERE has_faces = TRUE AND processed = TRUE"
            ).fetchone()[0],
            'misc_photos': conn.execute(
                "SELECT COUNT(*) FROM photos WHERE is_misc = TRUE AND processed = TRUE"
            ).fetchone()[0],
            'total_people': conn.execute(
                "SELECT COUNT(*) FROM persons"
            ).fetchone()[0],
            'total_faces': conn.execute(
                "SELECT COUNT(*) FROM faces"
            ).fetchone()[0],
            'pending_clusters': conn.execute(
                "SELECT COUNT(*) FROM clusters WHERE named = FALSE"
            ).fetchone()[0],
            'untagged_photos': conn.execute("""
                SELECT COUNT(DISTINCT p.id) FROM photos p
                WHERE p.processed = TRUE AND p.has_faces = TRUE
                AND p.id IN (
                    SELECT DISTINCT f.photo_id FROM faces f
                    WHERE f.person_id IS NULL
                )
            """).fetchone()[0],
            'notag_photos': conn.execute("""
                SELECT COUNT(DISTINCT p.id) FROM photos p
                WHERE p.processed = TRUE AND p.has_faces = TRUE
                AND p.id NOT IN (
                    SELECT DISTINCT f.photo_id FROM faces f
                    WHERE f.person_id IS NOT NULL
                )
            """).fetchone()[0],
            'custom_tags': conn.execute(
                "SELECT COUNT(DISTINCT tag) FROM tags WHERE source = 'custom'"
            ).fetchone()[0],
            'batches': conn.execute(
                "SELECT COUNT(DISTINCT batch_name) FROM photos WHERE batch_name IS NOT NULL"
            ).fetchone()[0],
        }
        conn.close()
        
        # Folder sizes
        def folder_info(path):
            p = Path(path)
            if not p.exists():
                return {'path': str(p), 'size_bytes': 0, 'file_count': 0, 'size_display': '0 B'}
            
            total_size = 0
            file_count = 0
            try:
                for f in p.rglob('*'):
                    if f.is_file():
                        total_size += f.stat().st_size
                        file_count += 1
            except Exception:
                pass
            
            # Format size
            if total_size < 1024:
                size_str = f"{total_size} B"
            elif total_size < 1024 * 1024:
                size_str = f"{total_size / 1024:.1f} KB"
            elif total_size < 1024 * 1024 * 1024:
                size_str = f"{total_size / (1024*1024):.1f} MB"
            else:
                size_str = f"{total_size / (1024*1024*1024):.2f} GB"
            
            return {
                'path': str(p),
                'size_bytes': total_size,
                'file_count': file_count,
                'size_display': size_str
            }
        
        stats['folders'] = {
            'inbox':      folder_info(INBOX_DIR),
            'photos':     folder_info(PHOTOS_DIR),
            'misc':       folder_info(MISC_DIR),
            'duplicates': folder_info(DUPLICATES_DIR),
            'removed':    folder_info(REMOVED_DIR),
            'archive':    folder_info(ARCHIVE_DIR),
            'errors':     folder_info(ERRORS_DIR),
            'exports':    folder_info(EXPORTS_DIR),
            'videos':     folder_info(VIDEOS_DIR),
            'thumbnails': folder_info(THUMBNAILS_DIR),
            'face_crops': folder_info(FACE_CROPS_DIR),
            'database':   folder_info(DATA_DIR),
        }
        
        # Disk space
        try:
            disk = shutil.disk_usage(str(GALLERY_DIR))
            stats['disk'] = {
                'total': f"{disk.total / (1024**3):.1f} GB",
                'used':  f"{disk.used / (1024**3):.1f} GB",
                'free':  f"{disk.free / (1024**3):.1f} GB",
            }
        except Exception:
            stats['disk'] = {'total': 'Unknown', 'used': 'Unknown', 'free': 'Unknown'}
        
        return stats
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/settings/config")
def api_get_config():
    """Get current AI configuration"""
    from config import (
        FACE_CONFIDENCE_THRESHOLD, FACE_MATCH_THRESHOLD,
        CLUSTER_MIN_SAMPLES, CLUSTER_EPS, MIN_FACE_SIZE,
        THUMBNAIL_QUALITY, BATCH_SIZE
    )
    return {
        'face_confidence': FACE_CONFIDENCE_THRESHOLD,
        'face_match': FACE_MATCH_THRESHOLD,
        'cluster_min_samples': CLUSTER_MIN_SAMPLES,
        'cluster_eps': CLUSTER_EPS,
        'min_face_size': MIN_FACE_SIZE,
        'thumbnail_quality': THUMBNAIL_QUALITY,
        'batch_size': BATCH_SIZE,
    }


@app.post("/api/settings/config")
def api_save_config(
    face_confidence: Optional[float] = Query(default=None),
    face_match: Optional[float] = Query(default=None),
    cluster_min_samples: Optional[int] = Query(default=None),
    min_face_size: Optional[int] = Query(default=None),
    thumbnail_quality: Optional[int] = Query(default=None),
):
    """
    Save AI configuration to config file.
    Only updates values that are provided.
    """
    try:
        import config
        
        changes = []
        
        if face_confidence is not None:
            config.FACE_CONFIDENCE_THRESHOLD = max(0.1, min(0.9, face_confidence))
            changes.append(f"Face confidence: {config.FACE_CONFIDENCE_THRESHOLD}")
        
        if face_match is not None:
            config.FACE_MATCH_THRESHOLD = max(0.2, min(0.8, face_match))
            changes.append(f"Face match: {config.FACE_MATCH_THRESHOLD}")
        
        if cluster_min_samples is not None:
            config.CLUSTER_MIN_SAMPLES = max(2, min(10, cluster_min_samples))
            changes.append(f"Cluster min samples: {config.CLUSTER_MIN_SAMPLES}")
        
        if min_face_size is not None:
            config.MIN_FACE_SIZE = max(30, min(300, min_face_size))
            changes.append(f"Min face size: {config.MIN_FACE_SIZE}")
        
        if thumbnail_quality is not None:
            config.THUMBNAIL_QUALITY = max(50, min(100, thumbnail_quality))
            changes.append(f"Thumbnail quality: {config.THUMBNAIL_QUALITY}")
        
        # Save to config file so it persists across restarts
        config_path = Path("config.py")
        if config_path.exists():
            content = config_path.read_text()
            
            if face_confidence is not None:
                import re
                content = re.sub(
                    r'FACE_CONFIDENCE_THRESHOLD\s*=\s*[\d.]+',
                    f'FACE_CONFIDENCE_THRESHOLD = {config.FACE_CONFIDENCE_THRESHOLD}',
                    content
                )
            if face_match is not None:
                content = re.sub(
                    r'FACE_MATCH_THRESHOLD\s*=\s*[\d.]+',
                    f'FACE_MATCH_THRESHOLD = {config.FACE_MATCH_THRESHOLD}',
                    content
                )
            if cluster_min_samples is not None:
                content = re.sub(
                    r'CLUSTER_MIN_SAMPLES\s*=\s*\d+',
                    f'CLUSTER_MIN_SAMPLES = {config.CLUSTER_MIN_SAMPLES}',
                    content
                )
            if min_face_size is not None:
                content = re.sub(
                    r'MIN_FACE_SIZE\s*=\s*\d+',
                    f'MIN_FACE_SIZE = {config.MIN_FACE_SIZE}',
                    content
                )
            if thumbnail_quality is not None:
                content = re.sub(
                    r'THUMBNAIL_QUALITY\s*=\s*\d+',
                    f'THUMBNAIL_QUALITY = {config.THUMBNAIL_QUALITY}',
                    content
                )
            
            config_path.write_text(content)
        
        return {
            "success": True,
            "changes": changes,
            "message": "Settings saved. Changes apply to future scans."
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/settings/rebuild-thumbnails")
def api_rebuild_thumbnails():
    """Trigger thumbnail rebuild in background"""
    import threading
    from progress import get_progress, reset_progress
    
    current = get_progress()
    if current['running']:
        return {"success": False, "message": "Another task is running"}
    
    reset_progress()
    
    def rebuild():
        try:
            from PIL import Image, ImageOps
            from config import THUMBNAILS_DIR, THUMBNAIL_SIZES, THUMBNAIL_QUALITY
            from progress import start_progress, update_progress, finish_progress
            
            conn = get_connection()
            photos = conn.execute("""
                SELECT id, file_path FROM photos WHERE processed = TRUE
            """).fetchall()
            conn.close()
            
            total = len(photos)
            start_progress('scanning', total, f'Rebuilding {total} thumbnails...')
            
            for i, photo in enumerate(photos):
                try:
                    img = Image.open(photo['file_path'])
                    try:
                        img = ImageOps.exif_transpose(img)
                    except Exception:
                        pass
                    img = img.convert('RGB')
                    
                    for size_name, (max_w, max_h) in THUMBNAIL_SIZES.items():
                        thumb = img.copy()
                        thumb.thumbnail((max_w, max_h), Image.LANCZOS)
                        filename = f"{photo['id']}_{size_name}.webp"
                        save_path = THUMBNAILS_DIR / filename
                        thumb.save(str(save_path), 'WEBP', quality=THUMBNAIL_QUALITY)
                    
                    img.close()
                except Exception:
                    pass
                
                update_progress(i + 1, '', f'{i + 1}/{total} thumbnails rebuilt')
            
            finish_progress(f'Rebuilt {total} thumbnails')
        
        except Exception as e:
            from progress import finish_progress
            finish_progress(f'Error: {e}')
    
    threading.Thread(target=rebuild, daemon=True).start()
    return {"success": True, "message": "Thumbnail rebuild started"}


@app.post("/api/settings/rerun-clustering")
def api_rerun_clustering():
    """Rerun face clustering in background"""
    import threading
    from progress import get_progress, reset_progress
    
    current = get_progress()
    if current['running']:
        return {"success": False, "message": "Another task is running"}
    
    reset_progress()
    
    def cluster():
        try:
            from clusterer import run_clustering
            run_clustering()
        except Exception as e:
            from progress import finish_progress
            finish_progress(f'Error: {e}')
    
    threading.Thread(target=cluster, daemon=True).start()
    return {"success": True, "message": "Clustering started"}


@app.post("/api/settings/fix-counts")
def api_fix_counts():
    """Recalculate photo counts for all people"""
    try:
        conn = get_connection()
        conn.execute("""
            UPDATE persons SET photo_count = (
                SELECT COUNT(DISTINCT photo_id)
                FROM faces WHERE person_id = persons.id
            )
        """)
        conn.commit()
        conn.close()
        return {"success": True, "message": "Photo counts recalculated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── Serve React Build ────────────────────────
react_build = ROOT_DIR / "build"

if react_build.exists():
    app.mount(
        "/static",
        StaticFiles(directory=str(react_build / "static")),
        name="react-static"
    )
    
    @app.get("/{full_path:path}")
    async def serve_react_app(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not found")
        
        file_path = react_build / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(str(file_path))
        
        index_file = react_build / "index.html"
        if index_file.exists():
            return FileResponse(str(index_file))
        
        raise HTTPException(status_code=404, detail="Not found")

if __name__ == "__main__":
    print("\n🚀 Family Gallery API v2.0")
    print("=" * 50)
    create_tables()
    from database import migrate_person_category
    migrate_person_category()
    print("✅ Database ready")
    print("✅ API: http://localhost:8000")
    print("📖 Docs: http://localhost:8000/docs")
    print("=" * 50)

    uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)