# ============================================
# CONFIG.PY — TEMPLATE
# Copy this file to config.py and update paths
# ============================================

from pathlib import Path

# ── Change this to YOUR project location ─────
ROOT_DIR = Path("D:/projects/family-gallery")

# ── Gallery storage ──────────────────────────
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

# ── Thumbnail settings ───────────────────────
THUMBNAIL_SIZES = {
    "small":  (400, 400),
    "medium": (1000, 1000),
}
THUMBNAIL_QUALITY = 88

# ── Face Detection ───────────────────────────
MIN_FACE_SIZE             = 35
FACE_CONFIDENCE_THRESHOLD = 0.5

# ── Face Matching ────────────────────────────
FACE_MATCH_THRESHOLD = 0.42

# ── Clustering ───────────────────────────────
CLUSTER_EPS         = 0.40
CLUSTER_MIN_SAMPLES = 3

# ── Processing ───────────────────────────────
BATCH_SIZE = 50

# ── Create directories ───────────────────────
def ensure_dirs():
    for d in [
        GALLERY_DIR, INBOX_DIR, PHOTOS_DIR, MISC_DIR,
        DUPLICATES_DIR, REMOVED_DIR, ARCHIVE_DIR,
        ERRORS_DIR, EXPORTS_DIR, VIDEOS_DIR,
        DATA_DIR, FACE_CROPS_DIR, THUMBNAILS_DIR,
    ]:
        d.mkdir(parents=True, exist_ok=True)

ensure_dirs()