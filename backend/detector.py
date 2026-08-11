# ============================================
# DETECTOR.PY
# Face detection + auto-sorting.
# After detection, moves photos:
# - Has faces → photos/batch_name/
# - No faces  → misc/batch_name/
# ============================================

import numpy as np
import json
import shutil
from pathlib import Path
from tqdm import tqdm
import cv2

from config import (
    FACE_CROPS_DIR, PHOTOS_DIR, MISC_DIR,
    MIN_FACE_SIZE, FACE_CONFIDENCE_THRESHOLD,
    BATCH_SIZE
)
from database import (
    get_connection, insert_face,
    mark_photo_processed, get_unprocessed_photos,
    update_photo_path, add_tag_to_photo
)
from progress import (
    start_progress, update_progress,
    update_stats, finish_progress
)


def load_face_model():
    print("🤖 Loading face detection model...")
    try:
        import insightface
        from insightface.app import FaceAnalysis

        app = FaceAnalysis(
            name='buffalo_l',
            providers=['CPUExecutionProvider']
        )
        # 1280x1280 detects smaller faces in large/group photos
        # Tradeoff: ~2-3x slower per photo but catches more faces
        app.prepare(ctx_id=0, det_size=(1280, 1280))
        print("✅ Face model loaded (high-res detection)")
        return app
    except Exception as e:
        print(f"❌ Failed to load model: {e}")
        raise


def detect_faces_in_image(model, image_path: str, photo_id: int) -> list:
    faces_found = []
    try:
        img_cv = cv2.imread(str(image_path))
        # OpenCV ignores EXIF rotation but we already
        # corrected the file during scanning.
        # This is a safety fallback for any uncorrected files.
        if img_cv is not None:
            try:
                from PIL import Image as PILImage, ImageOps
                pil_img = PILImage.open(str(image_path))
                exif = pil_img._getexif()
                if exif:
                    orientation = exif.get(274)
                    if orientation and orientation != 1:
                        # File wasn't corrected — fix in memory for detection
                        if orientation == 3:
                            img_cv = cv2.rotate(img_cv, cv2.ROTATE_180)
                        elif orientation == 6:
                            img_cv = cv2.rotate(img_cv, cv2.ROTATE_90_CLOCKWISE)
                        elif orientation == 8:
                            img_cv = cv2.rotate(img_cv, cv2.ROTATE_90_COUNTERCLOCKWISE)
                pil_img.close()
            except Exception:
                pass
        if img_cv is None:
            return []

        detected = model.get(img_cv)
        if not detected:
            return []

        for i, face in enumerate(detected):
            confidence = float(face.det_score)
            if confidence < FACE_CONFIDENCE_THRESHOLD:
                continue

            bbox = face.bbox.astype(int)
            x1, y1, x2, y2 = bbox
            face_w = x2 - x1
            face_h = y2 - y1

            if face_w < MIN_FACE_SIZE or face_h < MIN_FACE_SIZE:
                continue

            embedding = face.embedding.tolist()
            crop_path = save_face_crop(
                img_cv, x1, y1, x2, y2, photo_id, i
            )

            faces_found.append({
                'photo_id':   photo_id,
                'bbox_x':     int(x1),
                'bbox_y':     int(y1),
                'bbox_w':     int(face_w),
                'bbox_h':     int(face_h),
                'embedding':  embedding,
                'crop_path':  str(crop_path) if crop_path else None,
                'confidence': confidence,
            })
    except Exception as e:
        print(f"⚠️  Detection error photo {photo_id}: {e}")

    return faces_found


def save_face_crop(img_cv, x1, y1, x2, y2, photo_id, face_index):
    try:
        import time
        
        h, w = img_cv.shape[:2]
        pad_x = int((x2 - x1) * 0.2)
        pad_y = int((y2 - y1) * 0.2)

        x1_pad = max(0, x1 - pad_x)
        y1_pad = max(0, y1 - pad_y)
        x2_pad = min(w, x2 + pad_x)
        y2_pad = min(h, y2 + pad_y)

        face_crop = img_cv[y1_pad:y2_pad, x1_pad:x2_pad]
        face_crop = cv2.resize(face_crop, (128, 128))

        # Unique filename using timestamp to avoid cache collisions
        ts = int(time.time() * 1000) % 1000000
        filename  = f"face_{photo_id}_{face_index}_{ts}.jpg"
        save_path = FACE_CROPS_DIR / filename
        cv2.imwrite(str(save_path), face_crop)
        return save_path
    except Exception as e:
        print(f"⚠️  Crop error: {e}")
        return None


def move_photo_to_final(
    filepath: str,
    has_faces: bool,
    batch_name: str
) -> str:
    """
    Move photo from inbox to final location:
    - Has faces → photos/batch_name/
    - No faces  → misc/batch_name/
    
    Returns the new file path.
    """
    source = Path(filepath)
    
    if not source.exists():
        return filepath
    
    if has_faces:
        target_dir = PHOTOS_DIR / batch_name
    else:
        target_dir = MISC_DIR / batch_name
    
    target_dir.mkdir(parents=True, exist_ok=True)
    
    dest = target_dir / source.name
    
    # Handle filename conflicts
    if dest.exists():
        stem    = dest.stem
        suffix  = dest.suffix
        counter = 1
        while dest.exists():
            dest = target_dir / f"{stem}_{counter}{suffix}"
            counter += 1
    
    try:
        shutil.move(str(source), str(dest))
        return str(dest)
    except Exception as e:
        print(f"⚠️  Move error: {e}")
        return filepath


def get_auto_tag(photo_info: dict) -> str:
    """Determine tag for non-face photos"""
    fname = (photo_info.get('file_name') or '').lower()
    w     = photo_info.get('width')  or 1
    h     = photo_info.get('height') or 1
    ratio = w / h

    if photo_info.get('is_screenshot'):
        return 'screenshot'
    elif any(word in fname for word in [
        'cake', 'food', 'meal', 'dinner',
        'lunch', 'breakfast', 'restaurant',
        'coffee', 'drink', 'recipe'
    ]):
        return 'food'
    elif ratio > 1.8:
        return 'landscape'
    elif ratio < 0.6:
        return 'object'
    else:
        return 'misc'

def run_face_detection(photo_ids: list = None):
    model = load_face_model()

    if photo_ids:
        conn = get_connection()
        placeholders = ','.join('?' * len(photo_ids))
        photos = conn.execute(f"""
            SELECT id, file_path, file_name, batch_name,
                   is_screenshot, width, height
            FROM photos
            WHERE id IN ({placeholders})
            AND processed = FALSE
        """, photo_ids).fetchall()
        conn.close()
        photos = [dict(p) for p in photos]
    else:
        photos = get_unprocessed_photos()

    if not photos:
        print("✅ No photos need detection")
        finish_progress("No photos needed detection.")
        return

    total = len(photos)
    print(f"\n🔍 Detecting faces in {total} photos")
    print("=" * 50)

    start_progress('detecting', total, f'Detecting faces in {total} photos...')

    total_faces       = 0
    photos_with_faces = 0
    errors            = 0
    processed_count   = 0

    for photo in tqdm(photos, desc="Detecting faces"):
        processed_count += 1

        try:
            photo_id   = photo['id']
            file_path  = photo['file_path']
            file_name  = photo.get('file_name', '')
            batch_name = photo.get('batch_name', 'batch_001')

            update_progress(
                processed_count, file_name,
                f'Found {total_faces} faces so far'
            )

            # Detect faces
            faces = detect_faces_in_image(model, file_path, photo_id)

            # Save faces to database
            for face_data in faces:
                insert_face(face_data)

            has_faces = len(faces) > 0

            # Move photo to final location
            new_path = move_photo_to_final(
                file_path, has_faces, batch_name
            )

            # Determine folder type
            folder_type = 'photos' if has_faces else 'misc'

            # Update database with new path and status
            conn = get_connection()
            conn.execute("""
                UPDATE photos
                SET file_path   = ?,
                    has_faces   = ?,
                    face_count  = ?,
                    is_misc     = ?,
                    folder_type = ?,
                    processed   = TRUE
                WHERE id = ?
            """, (
                new_path,
                has_faces,
                len(faces),
                not has_faces,
                folder_type,
                photo_id
            ))

            # Auto-tag non-face photos
            if not has_faces:
                # ALWAYS add misc tag so it shows in misc filter
                conn.execute("""
                    INSERT OR IGNORE INTO tags
                    (photo_id, tag, source)
                    VALUES (?, 'misc', 'system')
                """, (photo_id,))

                # Also add specific tag for what type it is
                photo_info = conn.execute("""
                    SELECT is_screenshot, file_name, width, height
                    FROM photos WHERE id = ?
                """, (photo_id,)).fetchone()

                if photo_info:
                    fname = (photo_info['file_name'] or '').lower()
                    w     = photo_info['width']  or 1
                    h     = photo_info['height'] or 1
                    ratio = w / h

                    specific_tag = None
                    if photo_info['is_screenshot']:
                        specific_tag = 'screenshot'
                    elif any(word in fname for word in [
                        'cake', 'food', 'meal', 'dinner',
                        'lunch', 'breakfast', 'restaurant',
                        'coffee', 'drink', 'recipe'
                    ]):
                        specific_tag = 'food'
                    elif ratio > 1.8:
                        specific_tag = 'landscape'
                    elif ratio < 0.6:
                        specific_tag = 'object'

                    if specific_tag:
                        conn.execute("""
                            INSERT OR IGNORE INTO tags
                            (photo_id, tag, source)
                            VALUES (?, ?, 'system')
                        """, (photo_id, specific_tag))

            conn.commit()
            conn.close()

            if has_faces:
                photos_with_faces += 1
                total_faces       += len(faces)

            update_stats(faces_found=total_faces, errors=errors)

        except Exception as e:
            errors += 1
            print(f"\n⚠️  Error on {photo.get('file_name')}: {e}")
            update_stats(errors=errors)

            # Move error file out of inbox to errors folder
            try:
                from config import ERRORS_DIR
                source = Path(photo['file_path'])

                if source.exists():
                    batch_name = photo.get('batch_name', 'unknown')
                    error_dir  = ERRORS_DIR / batch_name
                    error_dir.mkdir(parents=True, exist_ok=True)

                    dest = error_dir / source.name
                    if dest.exists():
                        stem    = dest.stem
                        suffix  = dest.suffix
                        counter = 1
                        while dest.exists():
                            dest = error_dir / f"{stem}_{counter}{suffix}"
                            counter += 1

                    import shutil
                    shutil.move(str(source), str(dest))

                    update_photo_path(
                        photo['id'],
                        str(dest),
                        'errors'
                    )
                    print(f"   📁 Moved to errors/{batch_name}/")

                mark_photo_processed(photo['id'])
            except Exception as move_err:
                print(f"   ⚠️  Could not move error file: {move_err}")
                try:
                    mark_photo_processed(photo['id'])
                except Exception:
                    pass
            continue

    finish_progress(
        f'Detection complete. {total_faces} faces '
        f'in {photos_with_faces} photos.'
    )

    print("\n" + "=" * 50)
    print(f"✅ Processed:         {total}")
    print(f"👤 With faces:        {photos_with_faces}")
    print(f"📁 To misc:           {total - photos_with_faces}")
    print(f"😊 Total faces:       {total_faces}")
    if errors:
        print(f"❌ Errors:           {errors}")
    print("=" * 50)
    
if __name__ == "__main__":
    run_face_detection()