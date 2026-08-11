from PIL import Image, ImageOps
from pathlib import Path
from tqdm import tqdm
from database import get_connection
from config import THUMBNAILS_DIR, THUMBNAIL_SIZES, THUMBNAIL_QUALITY

def rebuild_all_thumbnails():
    conn = get_connection()
    photos = conn.execute("""
        SELECT id, file_path FROM photos
        WHERE processed = TRUE
    """).fetchall()
    conn.close()

    print(f"Rebuilding thumbnails for {len(photos)} photos...")
    print(f"Sizes: {THUMBNAIL_SIZES}")
    print(f"Quality: {THUMBNAIL_QUALITY}")

    for photo in tqdm(photos, desc="Rebuilding"):
        photo_id  = photo['id']
        file_path = photo['file_path']

        try:
            image = Image.open(file_path)
            try:
                image = ImageOps.exif_transpose(image)
            except Exception:
                pass
            image = image.convert('RGB')

            for size_name, (max_w, max_h) in THUMBNAIL_SIZES.items():
                thumb = image.copy()
                thumb.thumbnail((max_w, max_h), Image.LANCZOS)
                filename  = f"{photo_id}_{size_name}.webp"
                save_path = THUMBNAILS_DIR / filename
                thumb.save(str(save_path), 'WEBP', quality=THUMBNAIL_QUALITY)

            image.close()

        except Exception as e:
            print(f"Error on {file_path}: {e}")
            continue

    print("Done!")

if __name__ == "__main__":
    rebuild_all_thumbnails()