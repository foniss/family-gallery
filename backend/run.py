# ============================================
# RUN.PY
# Master script with custom tag support.
# ============================================

import sys
import time
from datetime import datetime


def print_header(title):
    print("\n" + "=" * 50)
    print(f"  {title}")
    print("=" * 50)


def ask_for_custom_tag():
    print("\n" + "=" * 50)
    print("  🏷️  CUSTOM TAG (optional)")
    print("=" * 50)
    print("\nThis tag becomes the subfolder name.")
    print("Examples: party_2024, christmas, moms_phone")
    print("(Press Enter to auto-generate batch_XXX)\n")

    tag = input("Tag name: ").strip()

    if tag:
        print(f"\n✅ Batch folder: '{tag}'")
        return tag
    else:
        print("\n⏭️  Will auto-generate batch name")
        return None

def cleanup_inbox():
    """
    Safety sweep — move any remaining files
    out of inbox after pipeline finishes.
    These are files that somehow didn't get
    processed or moved.
    """
    from config import INBOX_DIR, ERRORS_DIR
    from pathlib import Path
    import shutil

    remaining = list(INBOX_DIR.rglob("*"))
    # Filter to only files (not directories)
    remaining = [f for f in remaining if f.is_file()]

    if not remaining:
        return

    print(f"\n🧹 Inbox cleanup: {len(remaining)} leftover files")

    cleanup_dir = ERRORS_DIR / "inbox_leftover"
    cleanup_dir.mkdir(parents=True, exist_ok=True)

    for filepath in remaining:
        try:
            dest = cleanup_dir / filepath.name
            counter = 1
            while dest.exists():
                dest = cleanup_dir / f"{filepath.stem}_{counter}{filepath.suffix}"
                counter += 1
            shutil.move(str(filepath), str(dest))
        except Exception as e:
            print(f"   ⚠️  Could not move {filepath.name}: {e}")

    # Remove empty subdirectories in inbox
    for dirpath in sorted(INBOX_DIR.rglob("*"), reverse=True):
        if dirpath.is_dir():
            try:
                dirpath.rmdir()  # Only removes if empty
            except OSError:
                pass

    print(f"   ✅ Moved to errors/inbox_leftover/")

def run_full_pipeline(custom_tag=None):
    start_time = time.time()
    print("\n🚀 Family Gallery — Processing Pipeline")
    print(f"   Started: {datetime.now().strftime('%I:%M %p')}")

    if custom_tag is None:
        custom_tag = ask_for_custom_tag()

    # Step 1: Scan
    print_header("STEP 1/3: Scanning Inbox")
    from scanner import scan_photos_folder
    scan_photos_folder(custom_tag=custom_tag)

    # Check for unprocessed
    from database import get_unprocessed_photos
    unprocessed = get_unprocessed_photos()

    if not unprocessed:
        print("\n✅ All photos processed!")
        print_header("Running Clustering Update")
        from clusterer import run_clustering
        run_clustering()
        return

    # Step 2: Detect
    print_header(f"STEP 2/3: Detecting Faces ({len(unprocessed)} photos)")
    from detector import run_face_detection
    run_face_detection()

    # Step 3: Cluster
    print_header("STEP 3/3: Grouping Faces")
    from clusterer import run_clustering
    run_clustering()

    # Clean up any stragglers in inbox
    cleanup_inbox()
    # Done
    elapsed = time.time() - start_time
    minutes = int(elapsed // 60)
    seconds = int(elapsed % 60)

    print("\n" + "=" * 50)
    print("🎉 ALL DONE!")
    print(f"   Time: {minutes}m {seconds}s")
    if custom_tag:
        print(f"   Batch: {custom_tag}")
    print("=" * 50)


if __name__ == "__main__":
    args = sys.argv[1:]

    custom_tag = None
    if '--tag' in args:
        idx = args.index('--tag')
        try:
            custom_tag = args[idx + 1]
        except IndexError:
            print("⚠️  --tag needs a value")
            sys.exit(1)

    if '--scan' in args:
        from scanner import scan_photos_folder
        scan_photos_folder(custom_tag=custom_tag)

    elif '--detect' in args:
        from detector import run_face_detection
        run_face_detection()

    elif '--cluster' in args:
        from clusterer import run_clustering
        run_clustering()

    else:
        run_full_pipeline(custom_tag=custom_tag)