# ============================================
# SCANNER.PY
# Scans INBOX only. Sorts photos into:
# - photos\ (has faces — after detection)
# - misc\   (no faces — after detection)
# - duplicates\ (exact copies)
# - errors\ (couldn't process)
#
# Uses custom tag as subfolder name.
# Auto-rotates photos based on EXIF orientation.
# ============================================

import hashlib
import os
import shutil
from pathlib import Path
from PIL import Image, ExifTags, ImageOps
from tqdm import tqdm

from config import (
    INBOX_DIR, PHOTOS_DIR, MISC_DIR,
    DUPLICATES_DIR, ERRORS_DIR, VIDEOS_DIR,
    THUMBNAILS_DIR, SUPPORTED_FORMATS,
    VIDEO_FORMATS, THUMBNAIL_SIZES,
    BATCH_SIZE
)
from database import (
    get_connection, insert_photo,
    photo_exists, create_tables,
    migrate_tags_table
)
from progress import (
    start_progress, update_progress, finish_progress
)


# ── Track batch name globally so detector can use it ──
_current_batch_name = None

def get_current_batch_name():
    return _current_batch_name


def hash_file(filepath: Path) -> str:
    h = hashlib.blake2b(digest_size=16)
    with open(filepath, 'rb') as f:
        for chunk in iter(lambda: f.read(8192), b''):
            h.update(chunk)
    return h.hexdigest()


def get_exif_date(image: Image.Image):
    """
    Extract date taken from EXIF data.
    Must be called BEFORE exif_transpose because
    transpose can strip some EXIF tags.
    """
    try:
        exif_data = image._getexif()
        if not exif_data:
            return None
        exif = {
            ExifTags.TAGS.get(k, k): v
            for k, v in exif_data.items()
        }
        for field in [
            'DateTimeOriginal',
            'DateTime',
            'DateTimeDigitized'
        ]:
            if field in exif:
                return exif[field][:10].replace(':', '-')
    except Exception:
        pass
    return None


def fix_rotation(image: Image.Image) -> Image.Image:
    """
    Auto-rotate image based on EXIF orientation tag.

    Phones save photos sideways/upside-down internally
    and rely on EXIF orientation to display correctly.
    Without this, thumbnails show rotated photos.

    ImageOps.exif_transpose reads the orientation tag
    and physically rotates the pixels to match.
    """
    try:
        return ImageOps.exif_transpose(image)
    except Exception:
        # If EXIF data is missing or corrupt, return as-is
        return image


def is_screenshot(image: Image.Image, filepath: Path) -> bool:
    filename = filepath.name.lower()
    if 'screenshot' in filename or 'screen_shot' in filename:
        return True
    if filepath.suffix.lower() == '.png':
        w, h = image.size
        screenshot_sizes = [
            (1080, 1920), (1920, 1080),
            (1170, 2532), (2532, 1170),
            (1284, 2778), (2778, 1284),
            (750,  1334), (1334, 750),
            (1440, 3200), (3200, 1440),
            (2560, 1440), (1440, 2560),
            (1080, 2400), (2400, 1080),
        ]
        if (w, h) in screenshot_sizes:
            return True
    return False


def generate_thumbnails(image: Image.Image, photo_id: int) -> dict:
    """
    Generate WebP thumbnails at multiple sizes.
    Image passed in should already be rotation-corrected.
    """
    from config import THUMBNAIL_QUALITY
    
    paths = {}
    for size_name, (max_w, max_h) in THUMBNAIL_SIZES.items():
        thumb = image.copy()
        thumb.thumbnail((max_w, max_h), Image.LANCZOS)
        filename  = f"{photo_id}_{size_name}.webp"
        save_path = THUMBNAILS_DIR / filename
        thumb.save(str(save_path), 'WEBP', quality=THUMBNAIL_QUALITY)
        paths[size_name] = str(save_path)
    return paths


def get_batch_folder_name(custom_tag: str = None) -> str:
    """
    Generate a batch folder name.
    If custom tag provided: use that as folder name.
    If not: use batch_XXX auto-incrementing.
    """
    if custom_tag:
        clean = custom_tag.strip().lower()
        clean = clean.replace(' ', '_')
        clean = ''.join(
            c for c in clean
            if c.isalnum() or c == '_'
        )
        return clean

    # Auto-generate batch name
    existing = []

    if PHOTOS_DIR.exists():
        existing += [
            d.name for d in PHOTOS_DIR.iterdir()
            if d.is_dir() and d.name.startswith('batch_')
        ]

    if MISC_DIR.exists():
        existing += [
            d.name for d in MISC_DIR.iterdir()
            if d.is_dir() and d.name.startswith('batch_')
        ]

    existing = list(set(existing))

    if not existing:
        return 'batch_001'

    numbers = []
    for name in existing:
        try:
            num = int(name.replace('batch_', ''))
            numbers.append(num)
        except ValueError:
            pass

    next_num = max(numbers) + 1 if numbers else 1
    return f'batch_{next_num:03d}'


def move_file_to(filepath: Path, target_dir: Path, batch_name: str) -> Path:
    """
    Move a file to target_dir/batch_name/
    Handles filename conflicts automatically.
    Returns the new file path.
    """
    dest_folder = target_dir / batch_name
    dest_folder.mkdir(parents=True, exist_ok=True)

    dest = dest_folder / filepath.name

    if dest.exists():
        stem    = dest.stem
        suffix  = dest.suffix
        counter = 1
        while dest.exists():
            dest = dest_folder / f"{stem}_{counter}{suffix}"
            counter += 1

    shutil.move(str(filepath), str(dest))
    return dest


def move_videos_to_folder(batch_name: str):
    """
    Move any video files from inbox to videos folder.
    We don't process them yet but keep them organised.
    """
    video_files = []
    for fmt in VIDEO_FORMATS:
        video_files.extend(INBOX_DIR.rglob(f"*{fmt}"))
        video_files.extend(INBOX_DIR.rglob(f"*{fmt.upper()}"))

    video_files = list(set(video_files))

    if video_files:
        print(f"\n🎬 Found {len(video_files)} videos — moving to videos folder")
        for vf in video_files:
            move_file_to(vf, VIDEOS_DIR, batch_name)
        print(f"   ✅ Moved to videos/{batch_name}/")


def scan_photos_folder(custom_tag: str = None):
    """
    Scan INBOX folder for new photos.

    Flow:
    1. Find all images in inbox
    2. Skip duplicates (move to duplicates folder)
    3. Open image safely — extract EXIF date FIRST
    4. Auto-rotate based on EXIF orientation
    5. Generate correctly-rotated thumbnails
    6. Save to database with processed=FALSE
    7. Face detection later decides photos\ vs misc\

    Photos stay in inbox temporarily.
    After face detection they get moved to
    photos\ or misc\ based on whether faces found.
    """
    global _current_batch_name

    create_tables()
    migrate_tags_table()

    # Generate batch folder name
    batch_name = get_batch_folder_name(custom_tag)
    _current_batch_name = batch_name

    # Move videos first
    move_videos_to_folder(batch_name)

    # Find all image files in inbox
    all_files = []
    for fmt in SUPPORTED_FORMATS:
        all_files.extend(INBOX_DIR.rglob(f"*{fmt}"))
        all_files.extend(INBOX_DIR.rglob(f"*{fmt.upper()}"))

    all_files = list(set(all_files))
    total     = len(all_files)

    print(f"\n📥 Inbox: {INBOX_DIR}")
    print(f"📁 Found {total} new photos to process")
    print(f"📂 Batch name: {batch_name}")
    if custom_tag:
        print(f"🏷️  Custom tag: '{custom_tag}'")
    print("=" * 50)

    if total == 0:
        print("✅ Inbox is empty — nothing to process")
        print(f"   Add photos to: {INBOX_DIR}")
        finish_progress("Inbox is empty.")
        return []

    start_progress('scanning', total, f'Processing {total} photos...')

    new_photos      = 0
    skipped         = 0
    errors          = 0
    needs_detection = []
    new_photo_ids   = []
    processed_count = 0

    for i in tqdm(
        range(0, len(all_files), BATCH_SIZE),
        desc="Scanning inbox"
    ):
        batch = all_files[i:i + BATCH_SIZE]

        for filepath in batch:
            processed_count += 1

            update_progress(
                processed_count,
                filepath.name,
                f'{new_photos} new photos processed'
            )

            try:
                # Step 1: Hash file for duplicate detection
                file_hash = hash_file(filepath)

                # Step 2: Check for duplicates
                if photo_exists(file_hash):
                    print(f"\n⏭️  Duplicate: {filepath.name}")
                    move_file_to(filepath, DUPLICATES_DIR, batch_name)
                    skipped += 1
                    continue

                # Step 3: Open image safely
                # Use context manager so Windows releases the file handle
                # Step 3: Open image safely
                with Image.open(filepath) as img:
                    img.load()

                    # Step 4: Extract EXIF date BEFORE any modifications
                    date_taken = get_exif_date(img)

                    # Step 5: Check if rotation is needed
                    needs_rotation = False
                    try:
                        exif = img._getexif()
                        if exif:
                            orientation = exif.get(274)  # 274 = Orientation tag
                            if orientation and orientation != 1:
                                needs_rotation = True
                    except Exception:
                        pass

                    # Step 6: Fix rotation
                    img = fix_rotation(img)

                    # Step 7: Convert to RGB
                    image = img.convert('RGB')

                width, height = image.size

                # Step 8: If photo was rotated, save corrected version
                # over the original so face detection and lightbox
                # both show correct orientation
                if needs_rotation:
                    try:
                        save_format = filepath.suffix.lower()
                        if save_format in ['.jpg', '.jpeg']:
                            image.save(str(filepath), 'JPEG', quality=95)
                        elif save_format == '.png':
                            image.save(str(filepath), 'PNG')
                        elif save_format == '.webp':
                            image.save(str(filepath), 'WEBP', quality=95)
                        else:
                            image.save(str(filepath), 'JPEG', quality=95)

                        # Rehash since file contents changed
                        file_hash = hash_file(filepath)
                    except Exception as rot_err:
                        print(f"   ⚠️  Could not save rotated version: {rot_err}")

                # File handle is now fully released by the context manager
                width, height = image.size

                # Step 7: Detect screenshots (after rotation so dimensions are correct)
                screenshot = is_screenshot(image, filepath)
                file_size  = os.path.getsize(filepath)

                # Step 8: Save to database
                photo_data = {
                    'file_path':    str(filepath),
                    'file_hash':    file_hash,
                    'file_name':    filepath.name,
                    'file_size':    file_size,
                    'width':        width,
                    'height':       height,
                    'date_taken':   date_taken,
                    'has_faces':    False,
                    'face_count':   0,
                    'is_screenshot': screenshot,
                    'is_misc':      False,
                    'processed':    False,
                    'favorite':     False,
                    'folder_type':  'inbox',
                    'batch_name':   batch_name,
                    'thumb_small':  None,
                    'thumb_medium': None,
                }

                photo_id = insert_photo(photo_data)

                if photo_id:
                    # Step 9: Generate thumbnails from rotation-corrected image
                    thumb_paths = generate_thumbnails(image, photo_id)

                    conn = get_connection()
                    conn.execute("""
                        UPDATE photos
                        SET thumb_small = ?, thumb_medium = ?
                        WHERE id = ?
                    """, (
                        thumb_paths.get('small'),
                        thumb_paths.get('medium'),
                        photo_id
                    ))
                    conn.commit()
                    conn.close()

                    needs_detection.append(photo_id)
                    new_photo_ids.append(photo_id)
                    new_photos += 1

            except Exception as e:
                errors += 1
                print(f"\n⚠️  Error: {filepath.name}: {e}")
                try:
                    move_file_to(filepath, ERRORS_DIR, batch_name)
                    # Force delete if Windows left a copy behind
                    if filepath.exists():
                        filepath.unlink()
                except Exception as move_err:
                    print(f"   ⚠️  Could not move error file: {move_err}")
                continue

    # Apply custom tag to all new photos in this batch
    if custom_tag and new_photo_ids:
        from database import add_custom_tag_to_photos
        add_custom_tag_to_photos(new_photo_ids, custom_tag)

    finish_progress(
        f'Scan complete. {new_photos} new, '
        f'{skipped} duplicates.'
    )

    print("\n" + "=" * 50)
    print(f"✅ New photos:        {new_photos}")
    print(f"⏭️  Duplicates:       {skipped}")
    print(f"📷 Need detection:    {len(needs_detection)}")
    print(f"📂 Batch:             {batch_name}")
    if custom_tag:
        print(f"🏷️  Tagged as:        '{custom_tag}'")
    if errors:
        print(f"❌ Errors:           {errors}")
    print("=" * 50)

    return needs_detection