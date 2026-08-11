"""
Generate high-quality avatars for all existing people.
Run once to upgrade from pixelated face crops to sharp avatars.
"""

from PIL import Image, ImageOps
from pathlib import Path
from tqdm import tqdm
from database import get_connection
from config import DATA_DIR

def generate_all_avatars():
    avatars_dir = DATA_DIR / "avatars"
    avatars_dir.mkdir(parents=True, exist_ok=True)
    
    conn = get_connection()
    
    persons = conn.execute("SELECT id, name FROM persons").fetchall()
    
    print(f"Generating avatars for {len(persons)} people...")
    
    for person in tqdm(persons, desc="Generating avatars"):
        # Get best face for this person
        face = conn.execute("""
            SELECT f.bbox_x, f.bbox_y, f.bbox_w, f.bbox_h,
                   p.file_path
            FROM faces f
            JOIN photos p ON p.id = f.photo_id
            WHERE f.person_id = ?
            AND f.bbox_w IS NOT NULL
            AND f.bbox_h IS NOT NULL
            ORDER BY f.confidence DESC
            LIMIT 1
        """, (person['id'],)).fetchone()
        
        if not face:
            print(f"  No face found for {person['name']}, skipping")
            continue
        
        file_path = Path(face['file_path'])
        if not file_path.exists():
            print(f"  Photo not found for {person['name']}, skipping")
            continue
        
        try:
            img = Image.open(str(file_path))
            try:
                img = ImageOps.exif_transpose(img)
            except Exception:
                pass
            img = img.convert('RGB')
            
            img_w, img_h = img.size
            
            x = face['bbox_x'] or 0
            y = face['bbox_y'] or 0
            w = face['bbox_w'] or 100
            h = face['bbox_h'] or 100
            
            pad = max(w, h) * 0.5
            cx = x + w / 2
            cy = y + h / 2
            size = max(w, h) + pad * 2
            
            x1 = max(0, int(cx - size / 2))
            y1 = max(0, int(cy - size / 2))
            x2 = min(img_w, int(cx + size / 2))
            y2 = min(img_h, int(cy + size / 2))
            
            avatar_img = img.crop((x1, y1, x2, y2))
            avatar_img = avatar_img.resize((384, 384), Image.LANCZOS)
            
            avatar_path = avatars_dir / f"avatar_{person['id']}.webp"
            avatar_img.save(str(avatar_path), 'WEBP', quality=92)
            
            img.close()
            avatar_img.close()
            
        except Exception as e:
            print(f"  Error for {person['name']}: {e}")
    
    conn.close()
    print("Done!")

if __name__ == "__main__":
    generate_all_avatars()