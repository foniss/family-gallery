# ============================================
# HEALTH_CHECK.PY
# Run this before processing your full
# photo collection.
# Checks everything is ready and estimates
# how long it will take.
# ============================================

import os
import sys
import time
import shutil
from pathlib import Path

print("\n🔍 Family Gallery — Health Check")
print("=" * 50)

# ── Check 1: Python Version ───────────────────
print("\n📋 System Info:")
print(f"   Python: {sys.version.split()[0]}")

# ── Check 2: Disk Space ───────────────────────
print("\n💾 Disk Space:")
total, used, free = shutil.disk_usage("D:/")
free_gb  = free  / (1024**3)
total_gb = total / (1024**3)
used_gb  = used  / (1024**3)

print(f"   Total:     {total_gb:.1f} GB")
print(f"   Used:      {used_gb:.1f} GB")
print(f"   Free:      {free_gb:.1f} GB")

# 30,000 photos need roughly:
# - Thumbnails: ~3GB
# - Face crops: ~500MB
# - Database:   ~200MB
NEEDED_GB = 4.0

if free_gb < NEEDED_GB:
    print(f"\n❌ WARNING: You need at least {NEEDED_GB}GB free")
    print(f"   You only have {free_gb:.1f}GB free")
    print("   Free up disk space before continuing")
else:
    print(f"\n✅ Disk space OK ({free_gb:.1f}GB free)")

# ── Check 3: RAM ──────────────────────────────
print("\n🧠 Memory:")
try:
    import psutil
    ram = psutil.virtual_memory()
    ram_gb = ram.total / (1024**3)
    available_gb = ram.available / (1024**3)
    print(f"   Total RAM:     {ram_gb:.1f} GB")
    print(f"   Available:     {available_gb:.1f} GB")

    if available_gb < 2:
        print("   ⚠️  Low memory — close other apps before scanning")
    else:
        print("   ✅ Memory OK")
except ImportError:
    print("   (Install psutil for RAM check: python -m pip install psutil)")

# ── Check 4: Photos Folder ────────────────────
print("\n📁 Photos Folder:")
from config import PHOTOS_DIR, DATA_DIR, FACE_CROPS_DIR, THUMBNAILS_DIR

if not PHOTOS_DIR.exists():
    print(f"   ❌ Photos folder not found: {PHOTOS_DIR}")
else:
    # Count photos
    SUPPORTED = {'.jpg', '.jpeg', '.png', '.heic', 
                 '.webp', '.bmp', '.tiff', '.tif'}
    all_photos = []
    for ext in SUPPORTED:
        all_photos.extend(PHOTOS_DIR.rglob(f"*{ext}"))
        all_photos.extend(PHOTOS_DIR.rglob(f"*{ext.upper()}"))
    
    all_photos = list(set(all_photos))
    print(f"   ✅ Found {len(all_photos):,} photos in {PHOTOS_DIR}")

    # Calculate total size
    total_size = sum(
        f.stat().st_size for f in all_photos 
        if f.exists()
    )
    size_gb = total_size / (1024**3)
    print(f"   📦 Total size: {size_gb:.1f} GB")

# ── Check 5: Database ─────────────────────────
print("\n🗄️  Database:")
from database import get_stats, create_tables
create_tables()
stats = get_stats()
print(f"   Photos in DB:      {stats['total_photos']:,}")
print(f"   Processed:         {stats['total_photos'] - stats['unprocessed_photos']:,}")
print(f"   Unprocessed:       {stats['unprocessed_photos']:,}")
print(f"   Faces found:       {stats['total_faces']:,}")
print(f"   People named:      {stats['total_people']:,}")
print(f"   Pending clusters:  {stats['pending_clusters']:,}")

# ── Check 6: AI Model ─────────────────────────
print("\n🤖 AI Model:")
try:
    import insightface
    from insightface.app import FaceAnalysis
    
    print("   Loading model (may take 10 seconds)...")
    start = time.time()
    
    app = FaceAnalysis(
        name='buffalo_l',
        providers=['CPUExecutionProvider']
    )
    app.prepare(ctx_id=0, det_size=(640, 640))
    
    load_time = time.time() - start
    print(f"   ✅ Model loaded in {load_time:.1f}s")
    
    # Quick benchmark on a test image
    import numpy as np
    test_img = np.zeros((640, 640, 3), dtype=np.uint8)
    start = time.time()
    app.get(test_img)
    bench_time = time.time() - start
    
    print(f"   ⚡ Speed: {bench_time:.2f}s per photo")
    
    # Estimate total processing time
    if len(all_photos) > 0:
        estimated_seconds = len(all_photos) * bench_time
        estimated_hours = estimated_seconds / 3600
        print(f"\n⏱️  Time Estimate for {len(all_photos):,} photos:")
        print(f"   Optimistic:  {estimated_hours * 0.7:.1f} hours")
        print(f"   Realistic:   {estimated_hours:.1f} hours")
        print(f"   Worst case:  {estimated_hours * 1.5:.1f} hours")
        print(f"\n   💡 Tip: Start before bed, finish by morning")
        
except Exception as e:
    print(f"   ❌ Model error: {e}")

# ── Check 7: Required Folders ─────────────────
print("\n📂 Data Folders:")
for folder in [DATA_DIR, FACE_CROPS_DIR, THUMBNAILS_DIR]:
    if folder.exists():
        print(f"   ✅ {folder}")
    else:
        folder.mkdir(parents=True, exist_ok=True)
        print(f"   ✅ Created: {folder}")

# ── Final Verdict ─────────────────────────────
print("\n" + "=" * 50)
print("✅ Health check complete!")
print("\nWhen ready to process all photos:")
print("   1. Copy all photos to:", PHOTOS_DIR)
print("   2. Run: python run.py")
print("   3. Let it run overnight")
print("=" * 50)