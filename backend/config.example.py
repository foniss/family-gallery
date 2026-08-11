# ============================================
# CONFIG.PY
# All settings in one place.
# Updated for the new gallery folder structure.
# ============================================

from pathlib import Path

# ── Root of your project ─────────────────────
ROOT_DIR = Path("D:/projects/family-gallery")

# ── Gallery storage (all your photos) ────────
GALLERY_DIR    = ROOT_DIR / "gallery"
INBOX_DIR      = GALLERY_DIR / "inbox"
PHOTOS_DIR     = GALLERY_DIR / "photos"
MISC_DIR       = GALLERY_DIR / "misc"
DUPLICATES_DIR = GALLERY_DIR / "duplicates"
REMOVED_DIR    = GALLERY_DIR / "removed"
ARCHIVE_DIR    = GALLERY_DIR / "archive"
ERRORS_DIR     = GALLERY_DIR / "errors"
EXPORTS_DIR    = GALLERY_DIR / "exports"
VIDEOS_DIR     = GALLERY_DIR / "videos"

# ── App data ─────────────────────────────────
DATA_DIR       = ROOT_DIR / "data"
FACE_CROPS_DIR = DATA_DIR / "face_crops"
THUMBNAILS_DIR = DATA_DIR / "thumbnails"
DATABASE_PATH  = DATA_DIR / "gallery.db"

# ── Supported formats ────────────────────────
SUPPORTED_FORMATS = {
    ".jpg", ".jpeg", ".png",
    ".heic", ".webp", ".bmp",
    ".tiff", ".tif"
}

VIDEO_FORMATS = {
    ".mp4", ".mov", ".avi",
    ".mkv", ".wmv", ".webm"
}

# ── Thumbnail sizes ──────────────────────────
# ── Thumbnail sizes ──────────────────────
THUMBNAIL_SIZES = {
    "small":  (400, 400),    # Grid view — sharp enough to look good
    "medium": (1000, 1000),  # Lightbox quick preview before original loads
}

# ── Thumbnail quality ────────────────────
THUMBNAIL_QUALITY = 88  # Higher = better looking, bigger file

# ── Face Detection Settings ──────────────────
MIN_FACE_SIZE = 35
FACE_CONFIDENCE_THRESHOLD = 0.45

# ── Face Matching Settings ───────────────────
FACE_MATCH_THRESHOLD = 0.42

# ── Clustering Settings ─────────────────────
CLUSTER_EPS         = 0.40
CLUSTER_MIN_SAMPLES = 6

# ── Processing Settings ─────────────────────
BATCH_SIZE = 50

# ── Create all directories ──────────────────
def ensure_dirs():
    for d in [
        GALLERY_DIR,
        INBOX_DIR,
        PHOTOS_DIR,
        MISC_DIR,
        DUPLICATES_DIR,
        REMOVED_DIR,
        ARCHIVE_DIR,
        ERRORS_DIR,
        EXPORTS_DIR,
        VIDEOS_DIR,
        DATA_DIR,
        FACE_CROPS_DIR,
        THUMBNAILS_DIR,
    ]:
        d.mkdir(parents=True, exist_ok=True)

ensure_dirs()