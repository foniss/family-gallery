# Family Gallery — AI-Powered Photo Gallery

A private, local photo gallery with AI face detection, automatic tagging, and a beautiful web interface for your family.

## Features

### Family Viewer
- Three-state people filter (include/exclude/neutral)
- Multi-tag selection
- Favorites system
- Slideshow with speed control
- Zoom (mouse wheel, pinch, double-tap)
- Single & bulk download
- Password protected
- Mobile-friendly

### Admin Panel
- Face detection (InsightFace AI)
- Automatic clustering of similar faces
- Review queue for naming clusters
- People manager (rename/merge/delete/split/avatar)
- Category system (family/friends/custom)
- Custom tags per batch
- Photo rotation, archive, delete
- Settings with AI threshold controls
- Scan new photos with progress tracking

### Smart Organization
- Inbox → auto-sort to photos/misc/duplicates/errors
- Batch folders named by custom tags
- Family-only filter (hides non-family from viewer)
- Multiple tag support per photo

## Tech Stack
...auto-sort to `gallery/photos/` or `gallery/misc/`

## Folder Structure
```
family-gallery/
├── backend/          # Python API + AI processing
├── gallery/          # Photo storage
│   ├── inbox/        # Drop new photos here
│   ├── photos/       # Processed (with faces)
│   ├── misc/         # Processed (no faces)
│   ├── duplicates/   # Duplicate files
│   ├── removed/      # Deleted photos
│   ├── archive/      # Archived photos
│   ├── errors/       # Failed processing
│   ├── exports/      # Downloaded albums
│   └── videos/       # Video files
├── data/             # App data
│   ├── thumbnails/   # Preview images
│   ├── face_crops/   # Detected face crops
│   ├── avatars/      # Person avatars
│   └── gallery.db    # SQLite database
├── src/              # React frontend
│   ├── admin/        # Admin panel
│   ├── viewer/       # Family viewer
│   ├── components/   # Shared components
│   └── services/     # API helper
└── public/           # Static assets
```

## License
MIT