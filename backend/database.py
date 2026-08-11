# ============================================
# DATABASE.PY
# All database operations.
# Clean version with tag support and
# folder tracking.
# ============================================

import sqlite3
import json
from pathlib import Path
from config import DATABASE_PATH


def get_connection():
    conn = sqlite3.connect(
        str(DATABASE_PATH),
        check_same_thread=False
    )
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def create_tables():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS photos (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            file_path       TEXT    UNIQUE NOT NULL,
            file_hash       TEXT    UNIQUE,
            file_name       TEXT,
            file_size       INTEGER,
            width           INTEGER,
            height          INTEGER,
            date_taken      TEXT,
            has_faces       BOOLEAN DEFAULT FALSE,
            face_count      INTEGER DEFAULT 0,
            is_screenshot   BOOLEAN DEFAULT FALSE,
            is_misc         BOOLEAN DEFAULT FALSE,
            processed       BOOLEAN DEFAULT FALSE,
            favorite        BOOLEAN DEFAULT FALSE,
            folder_type     TEXT    DEFAULT 'photos',
            batch_name      TEXT,
            thumb_small     TEXT,
            thumb_medium    TEXT,
            created_at      TEXT    DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS faces (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            photo_id    INTEGER NOT NULL REFERENCES photos(id),
            crop_path   TEXT,
            bbox_x      INTEGER,
            bbox_y      INTEGER,
            bbox_w      INTEGER,
            bbox_h      INTEGER,
            embedding   TEXT,
            person_id   INTEGER REFERENCES persons(id),
            cluster_id  INTEGER,
            confidence  REAL,
            created_at  TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS persons (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            name                TEXT UNIQUE NOT NULL,
            avatar_face_id      INTEGER REFERENCES faces(id),
            photo_count         INTEGER DEFAULT 0,
            category            TEXT DEFAULT 'family',
            created_at          TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS clusters (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            face_count  INTEGER DEFAULT 0,
            named       BOOLEAN DEFAULT FALSE,
            person_id   INTEGER REFERENCES persons(id),
            created_at  TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS tags (
            id       INTEGER PRIMARY KEY AUTOINCREMENT,
            photo_id INTEGER NOT NULL REFERENCES photos(id),
            tag      TEXT NOT NULL,
            source   TEXT DEFAULT 'system',
            UNIQUE(photo_id, tag)
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS processing_log (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            event       TEXT NOT NULL,
            detail      TEXT,
            created_at  TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)

    conn.commit()
    conn.close()
    print("✅ Database tables ready")


# ── Photo Operations ──────────────────────────

def photo_exists(file_hash: str) -> bool:
    conn = get_connection()
    row = conn.execute(
        "SELECT id FROM photos WHERE file_hash = ?",
        (file_hash,)
    ).fetchone()
    conn.close()
    return row is not None


def insert_photo(data: dict) -> int:
    conn = get_connection()
    cursor = conn.execute("""
        INSERT OR IGNORE INTO photos
        (file_path, file_hash, file_name, file_size,
         width, height, date_taken, has_faces, face_count,
         is_screenshot, is_misc, processed, favorite,
         folder_type, batch_name,
         thumb_small, thumb_medium)
        VALUES
        (:file_path, :file_hash, :file_name, :file_size,
         :width, :height, :date_taken, :has_faces, :face_count,
         :is_screenshot, :is_misc, :processed, :favorite,
         :folder_type, :batch_name,
         :thumb_small, :thumb_medium)
    """, data)
    photo_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return photo_id


def mark_photo_processed(photo_id: int):
    conn = get_connection()
    conn.execute(
        "UPDATE photos SET processed = TRUE WHERE id = ?",
        (photo_id,)
    )
    conn.commit()
    conn.close()


def get_all_photos(limit=None, offset=0):
    conn = get_connection()
    query = """
        SELECT p.*,
               GROUP_CONCAT(DISTINCT pr.name) as people,
               GROUP_CONCAT(DISTINCT t.tag)   as tags
        FROM photos p
        LEFT JOIN faces  f  ON f.photo_id  = p.id
        LEFT JOIN persons pr ON pr.id       = f.person_id
        LEFT JOIN tags   t  ON t.photo_id  = p.id
        WHERE p.processed = TRUE
        GROUP BY p.id
        ORDER BY p.date_taken DESC NULLS LAST, p.id DESC
    """
    if limit:
        query += f" LIMIT {limit} OFFSET {offset}"

    rows = conn.execute(query).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_unprocessed_photos():
    conn = get_connection()
    rows = conn.execute("""
        SELECT * FROM photos
        WHERE processed = FALSE
        ORDER BY id ASC
    """).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def update_photo_path(photo_id: int, new_path: str, folder_type: str):
    """Update a photo's file path and folder type after moving"""
    conn = get_connection()
    conn.execute("""
        UPDATE photos
        SET file_path = ?, folder_type = ?
        WHERE id = ?
    """, (new_path, folder_type, photo_id))
    conn.commit()
    conn.close()


# ── Face Operations ───────────────────────────

def insert_face(data: dict) -> int:
    conn = get_connection()
    if isinstance(data.get('embedding'), list):
        data['embedding'] = json.dumps(data['embedding'])

    cursor = conn.execute("""
        INSERT INTO faces
        (photo_id, crop_path, bbox_x, bbox_y,
         bbox_w, bbox_h, embedding, confidence)
        VALUES
        (:photo_id, :crop_path, :bbox_x, :bbox_y,
         :bbox_w, :bbox_h, :embedding, :confidence)
    """, data)
    face_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return face_id


def get_all_embeddings():
    import numpy as np
    conn = get_connection()
    rows = conn.execute("""
        SELECT id, embedding FROM faces
        WHERE embedding IS NOT NULL
        AND person_id IS NULL
    """).fetchall()
    conn.close()

    result = []
    for row in rows:
        embedding = json.loads(row['embedding'])
        result.append((row['id'], np.array(embedding)))
    return result


def assign_face_to_person(face_id: int, person_id: int):
    conn = get_connection()
    conn.execute(
        "UPDATE faces SET person_id = ? WHERE id = ?",
        (person_id, face_id)
    )
    conn.commit()
    conn.close()


def assign_face_to_cluster(face_id: int, cluster_id: int):
    conn = get_connection()
    conn.execute(
        "UPDATE faces SET cluster_id = ? WHERE id = ?",
        (cluster_id, face_id)
    )
    conn.commit()
    conn.close()


# ── Person Operations ─────────────────────────

def create_person(name: str) -> int:
    conn = get_connection()
    cursor = conn.execute(
        "INSERT OR IGNORE INTO persons (name) VALUES (?)",
        (name,)
    )
    person_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return person_id


def get_all_persons():
    conn = get_connection()
    rows = conn.execute("""
        SELECT
            p.id,
            p.name,
            COUNT(DISTINCT f.photo_id) as photo_count,
            p.avatar_face_id
        FROM persons p
        LEFT JOIN faces f ON f.person_id = p.id
        GROUP BY p.id
        ORDER BY p.name ASC
    """).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_person_photos(person_id: int):
    conn = get_connection()
    rows = conn.execute("""
        SELECT DISTINCT p.*
        FROM photos p
        JOIN faces f ON f.photo_id = p.id
        WHERE f.person_id = ?
        ORDER BY p.date_taken DESC NULLS LAST
    """, (person_id,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ── Cluster Operations ────────────────────────

def create_cluster() -> int:
    conn = get_connection()
    cursor = conn.execute(
        "INSERT INTO clusters DEFAULT VALUES"
    )
    cluster_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return cluster_id


def get_all_clusters():
    conn = get_connection()

    clusters = conn.execute("""
        SELECT c.id, c.face_count, c.named
        FROM clusters c
        WHERE c.named = FALSE
        ORDER BY c.face_count DESC
    """).fetchall()

    result = []
    for cluster in clusters:
        faces = conn.execute("""
            SELECT crop_path FROM faces
            WHERE cluster_id = ?
            AND crop_path IS NOT NULL
            LIMIT 6
        """, (cluster['id'],)).fetchall()

        photo_count = conn.execute("""
            SELECT COUNT(DISTINCT photo_id)
            FROM faces WHERE cluster_id = ?
        """, (cluster['id'],)).fetchone()[0]

        result.append({
            'id':         cluster['id'],
            'face_count': cluster['face_count'],
            'photo_count': photo_count,
            'faces':      [f['crop_path'] for f in faces],
        })

    conn.close()
    return result


def name_cluster(cluster_id: int, person_name: str):
    conn = get_connection()

    conn.execute(
        "INSERT OR IGNORE INTO persons (name) VALUES (?)",
        (person_name,)
    )

    person = conn.execute(
        "SELECT id FROM persons WHERE name = ?",
        (person_name,)
    ).fetchone()
    person_id = person['id']

    conn.execute("""
        UPDATE faces
        SET person_id = ?, cluster_id = NULL
        WHERE cluster_id = ?
    """, (person_id, cluster_id))

    conn.execute("""
        UPDATE clusters
        SET named = TRUE, person_id = ?
        WHERE id = ?
    """, (person_id, cluster_id))

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
    print(f"✅ Named cluster {cluster_id} as '{person_name}'")


# ── Tag Operations ────────────────────────────

def add_tag_to_photo(photo_id: int, tag: str, source: str = 'system'):
    conn = get_connection()
    conn.execute("""
        INSERT OR IGNORE INTO tags (photo_id, tag, source)
        VALUES (?, ?, ?)
    """, (photo_id, tag.strip().lower(), source))
    conn.commit()
    conn.close()


def add_custom_tag_to_photos(photo_ids: list, tag: str):
    if not photo_ids or not tag.strip():
        return
    conn = get_connection()
    conn.executemany("""
        INSERT OR IGNORE INTO tags (photo_id, tag, source)
        VALUES (?, ?, 'custom')
    """, [(pid, tag.strip().lower()) for pid in photo_ids])
    conn.commit()
    conn.close()
    print(f"🏷️  Tagged {len(photo_ids)} photos as '{tag}'")


def get_all_custom_tags() -> list:
    conn = get_connection()
    columns = conn.execute("PRAGMA table_info(tags)").fetchall()
    column_names = [col['name'] for col in columns]

    if 'source' in column_names:
        rows = conn.execute("""
            SELECT DISTINCT tag, COUNT(*) as photo_count
            FROM tags
            WHERE source = 'custom'
            GROUP BY tag
            ORDER BY photo_count DESC
        """).fetchall()
    else:
        system_tags = {
            'no-people', 'landscape', 'misc',
            'screenshot', 'food', 'object'
        }
        rows = conn.execute("""
            SELECT DISTINCT tag, COUNT(*) as photo_count
            FROM tags
            GROUP BY tag
            ORDER BY photo_count DESC
        """).fetchall()
        rows = [r for r in rows if r['tag'] not in system_tags]

    conn.close()
    return [dict(r) for r in rows]


def get_photos_by_tag(tag: str) -> list:
    conn = get_connection()
    rows = conn.execute("""
        SELECT DISTINCT p.*
        FROM photos p
        JOIN tags t ON t.photo_id = p.id
        WHERE t.tag = ?
        AND p.processed = TRUE
        ORDER BY p.date_taken DESC NULLS LAST
    """, (tag.strip().lower(),)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def migrate_tags_table():
    conn = get_connection()
    try:
        conn.execute("""
            ALTER TABLE tags
            ADD COLUMN source TEXT DEFAULT 'system'
        """)
        conn.commit()
    except Exception:
        pass
    conn.close()


# ── Stats ─────────────────────────────────────
def get_stats():
    conn = get_connection()
    stats = {
        'total_photos': conn.execute(
            "SELECT COUNT(*) FROM photos WHERE processed = TRUE"
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
        'unprocessed_photos': conn.execute(
            "SELECT COUNT(*) FROM photos WHERE processed = FALSE"
        ).fetchone()[0],
        'misc_photos': conn.execute(
            "SELECT COUNT(*) FROM photos WHERE is_misc = TRUE"
        ).fetchone()[0],
        'untagged_photos': conn.execute("""
            SELECT COUNT(DISTINCT p.id)
            FROM photos p
            WHERE p.processed = TRUE
            AND p.has_faces = TRUE
            AND p.id IN (
                SELECT DISTINCT f.photo_id 
                FROM faces f
                WHERE f.person_id IS NULL
            )
        """).fetchone()[0],
    }
    conn.close()
    return stats
def migrate_person_category():
    """Add category column to persons table if missing"""
    conn = get_connection()
    try:
        conn.execute("""
            ALTER TABLE persons 
            ADD COLUMN category TEXT DEFAULT 'family'
        """)
        conn.commit()
        print("✅ Added category column to persons")
    except Exception:
        pass  # Already exists
    conn.close()

def create_indexes():
    """
    Create database indexes for fast queries.
    Run once — makes ALL queries significantly faster.
    Safe to run multiple times.
    """
    conn = get_connection()
    
    # Photos table indexes
    conn.execute("CREATE INDEX IF NOT EXISTS idx_photos_processed ON photos(processed)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_photos_has_faces ON photos(has_faces)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_photos_is_misc ON photos(is_misc)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_photos_folder_type ON photos(folder_type)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_photos_batch_name ON photos(batch_name)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_photos_favorite ON photos(favorite)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_photos_date_taken ON photos(date_taken)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_photos_file_hash ON photos(file_hash)")
    
    # Faces table indexes
    conn.execute("CREATE INDEX IF NOT EXISTS idx_faces_photo_id ON faces(photo_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_faces_person_id ON faces(person_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_faces_cluster_id ON faces(cluster_id)")
    
    # Tags table indexes
    conn.execute("CREATE INDEX IF NOT EXISTS idx_tags_photo_id ON tags(photo_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_tags_tag ON tags(tag)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_tags_source ON tags(source)")
    
    # Persons table indexes
    conn.execute("CREATE INDEX IF NOT EXISTS idx_persons_name ON persons(name)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_persons_category ON persons(category)")
    
    conn.commit()
    conn.close()
    print("✅ Database indexes created")

# Run directly to initialise
if __name__ == "__main__":
    print("\n🚀 Family Gallery API v2.0")
    create_tables()
    from database import migrate_person_category, create_indexes
    migrate_person_category()
    create_indexes()
