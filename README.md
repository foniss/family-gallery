# 📸 Family Gallery — AI-Powered Local Photo Gallery

> **Your own private Google Photos — runs entirely on your computer.**
> AI face detection, automatic tagging, beautiful web interface.
> No cloud. No subscription. Your photos never leave your machine.

> 📖 **[Full Setup Guide](SETUP_GUIDE.md)** — Complete step-by-step instructions including online hosting

---

## 🎯 What Is This?

Drop your family photos into a folder. AI automatically detects faces, groups them, and lets you name everyone once. From then on, every new photo gets tagged automatically.

Share the gallery with your family through a beautiful, mobile-friendly website — password protected and hostable for free.

---

## ✨ Features

### For Your Family
| Feature | Description |
|---------|-------------|
| 🔍 Smart Filters | Three-state people filter (include/exclude/neutral) |
| 🏷️ Tags | Multi-select tag dropdown for events and batches |
| ⭐ Favorites | Star photos, filter to see only favorites |
| 🖼️ Lightbox | Full-resolution viewer with zoom, rotate, download |
| 🎬 Slideshow | Auto-play with speed control and progress bar |
| 📱 Mobile | Touch-friendly with pinch zoom and swipe |
| 📥 Download | Single photo or bulk download as zip |
| 🔒 Password | Protected access for family only |

### For You (Admin)
| Feature | Description |
|---------|-------------|
| 🤖 AI Detection | InsightFace buffalo_l model — state of the art |
| 👥 Auto Clustering | DBSCAN groups similar faces automatically |
| ✅ Review Queue | Grid view — name clusters, skip strangers instantly |
| 👤 People Manager | Rename, merge, split, delete, change avatar |
| 📁 Categories | Separate family/friends/work — family viewer only shows family |
| 🏷️ Batch Tags | Tag = folder name — organize by event |
| ↻ Rotate | Permanently fix rotated photos |
| 🗑️ Delete/Archive | Move photos to removed or archive folders |
| ⚙️ AI Settings | Tune detection thresholds via sliders |
| 📊 Stats | Database stats, storage info, processing tools |
| 📡 Scan | Add new photos anytime with progress tracking |

### Smart Organization
| Feature | Description |
|---------|-------------|
| 📥 Inbox System | Drop photos → auto-sort to photos/misc/duplicates/errors |
| 🔄 Auto-Tag | Known faces get tagged instantly — no review needed |
| 👨‍👩‍👧 Family Filter | Family viewer only shows photos with family members |
| 🏷️ Multi-Tag | Select multiple tags to combine event filters |
| 🔍 Type Filter | All / With Faces / Untagged / No Tag / Misc |
| 📦 Batch Filter | Filter by processing batch |

---

## 🖥️ Screenshots

### Family Viewer
```
┌──────────────────────────────────────────────┐
│  📸 Family Gallery              23 photos    │
│                                              │
│  (mom✓) (dad) (sarah✗) (bob)                │
│                                              │
│  [With Others|Only] [★ Fav] [🏷️ Tags ▼]     │
├──────────────────────────────────────────────┤
│  ┌────┐ ┌──────┐ ┌────┐ ┌──────┐           │
│  │    │ │      │ │    │ │      │           │
│  │    │ │      │ │    │ │      │           │
│  └────┘ │      │ └────┘ │      │           │
│         └──────┘        └──────┘           │
└──────────────────────────────────────────────┘
```

### Admin — Review Queue
```
┌──────────────────────────────────────────────┐
│  Review Queue           [Skip All]           │
│  12 groups to review                         │
│                                              │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐       │
│  │ (faces) │ │ (faces) │ │ (faces) │       │
│  │ 3 photos│ │ 8 photos│ │ 5 photos│       │
│  │ [Name]  │ │ [Name]  │ │ [Name]  │       │
│  └─────────┘ └─────────┘ └─────────┘       │
└──────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + Tailwind CSS + Framer Motion |
| Backend | Python + FastAPI |
| Database | SQLite with WAL mode |
| AI Model | InsightFace (buffalo_l) |
| Clustering | DBSCAN (scikit-learn) |
| Hosting | Cloudflare Tunnel (free) |
| Redirect | GitHub Pages (free) |

---

## 🚀 Quick Start

### 1. Clone and install

```bash
git clone https://github.com/foniss/family-gallery.git
cd family-gallery
npm install
pip install fastapi uvicorn pillow numpy scikit-learn tqdm aiofiles python-multipart insightface onnxruntime opencv-python
```

### 2. Configure

```bash
copy backend\config.example.py backend\config.py
```

Edit `backend/config.py` — set `ROOT_DIR` to your project path.

### 3. Set passwords

Edit `src/viewer/PasswordGate.jsx` and `src/admin/AdminGate.jsx` with your chosen passwords.

### 4. Initialize

```bash
cd backend
python -c "from database import create_tables; create_tables()"
python -c "from config import ensure_dirs; ensure_dirs()"
```

### 5. Run

```bash
# Windows — double-click start.bat
# Or manually:
# Terminal 1: cd backend && python api.py
# Terminal 2: npm start
```

Open http://localhost:3000 (family) or http://localhost:3000/admin (admin).

### 6. Add photos

```bash
# Copy photos to gallery/inbox/
cd backend
python run.py --tag "my_photos"
# Go to admin → Review Queue → name the faces
```

> 📖 **[Full Setup Guide](SETUP_GUIDE.md)** for detailed instructions including AI tuning and online hosting.

---

## 📁 Project Structure

```
family-gallery/
├── backend/              # Python API + AI engine
│   ├── api.py            # FastAPI REST server
│   ├── scanner.py        # Photo ingestion + thumbnails
│   ├── detector.py       # Face detection (InsightFace)
│   ├── clusterer.py      # Face clustering (DBSCAN)
│   ├── database.py       # SQLite operations
│   └── run.py            # Master pipeline
├── src/                  # React frontend
│   ├── viewer/           # Family viewer (public)
│   ├── admin/            # Admin panel (private)
│   ├── components/       # Shared UI components
│   └── services/         # API communication
├── gallery/              # Photo storage (gitignored)
│   ├── inbox/            # Drop new photos here
│   ├── photos/           # Sorted by batch tag
│   ├── misc/             # No-face photos
│   └── ...               # duplicates, archive, etc.
├── data/                 # Generated data (gitignored)
│   ├── gallery.db        # SQLite database
│   ├── thumbnails/       # WebP previews
│   ├── face_crops/       # Detected face images
│   └── avatars/          # Person profile images
├── start.bat             # Local launcher
├── host_online.bat       # Online hosting launcher
└── SETUP_GUIDE.md        # Detailed setup instructions
```

---

## 🌐 Host Online (Free)

Share with family using Cloudflare Tunnel + GitHub Pages:

1. Install [cloudflared](https://github.com/cloudflare/cloudflared/releases)
2. Create a GitHub Pages redirect repo
3. Configure `update_link.py` with your GitHub username
4. Double-click `host_online.bat`
5. Share the permanent GitHub Pages URL with family

Family bookmarks the URL once. It works whenever your PC is running.

> See **[Setup Guide → Step 9](SETUP_GUIDE.md#step-9-host-online-optional)** for full instructions.

---

## 🤖 How The AI Works

```
1. You drop photos in inbox/

2. Scanner processes each photo:
   ├── Generates hash (duplicate detection)
   ├── Extracts EXIF data
   ├── Auto-rotates based on orientation
   ├── Creates WebP thumbnails
   └── Moves to photos/ or misc/

3. Detector finds faces:
   ├── InsightFace AI scans each photo
   ├── Extracts 512-dimensional face embedding
   ├── Saves cropped face images
   └── Filters by confidence and size

4. Clusterer groups faces:
   ├── Stage 1: Match against known people (auto-tag)
   ├── Stage 2: DBSCAN clusters unknown faces
   └── Unknown clusters → Review Queue

5. You name the clusters once.
   From then on → automatic tagging forever.
```

---

## ⚙️ AI Settings

Tunable via admin Settings page or `backend/config.py`:

| Setting | Default | Description |
|---------|---------|-------------|
| `MIN_FACE_SIZE` | 35px | Minimum face size to detect |
| `FACE_CONFIDENCE_THRESHOLD` | 0.5 | How confident AI must be |
| `FACE_MATCH_THRESHOLD` | 0.42 | Similarity needed for auto-tag |
| `CLUSTER_EPS` | 0.40 | Clustering tightness |
| `CLUSTER_MIN_SAMPLES` | 3 | Min photos to form a cluster |
| `det_size` | 1280×1280 | Detection resolution (in detector.py) |
| `THUMBNAIL_QUALITY` | 88 | WebP thumbnail quality |

---

## 📊 Performance

| Collection Size | Scan Time | Detection Time | Clustering |
|----------------|-----------|----------------|------------|
| 100 photos | 1 min | 5 min | 30 sec |
| 1,000 photos | 5 min | 30 min | 2 min |
| 10,000 photos | 30 min | 4 hours | 10 min |
| 30,000 photos | 1 hour | 12 hours | 30 min |

- Detection at 1280×1280 resolution
- Times on a modern CPU (no GPU required)
- Run overnight for large collections

---

## 🔒 Privacy & Security

- **100% local** — photos never leave your computer
- **No cloud services** — no Google, no AWS, no APIs
- **No tracking** — no analytics, no telemetry
- **Password protected** — separate passwords for family and admin
- **Cloudflare Tunnel** — encrypted connection when hosting online
- **No permanent URL exposure** — tunnel URL changes each session

---

## 🤝 Contributing

Found a bug? Want to add a feature? PRs welcome!

1. Fork the repo
2. Create a branch: `git checkout -b my-feature`
3. Make your changes
4. Push: `git push origin my-feature`
5. Open a Pull Request

---

## 📄 License

MIT — use it however you want.

---

## 🙏 Credits

- [InsightFace](https://github.com/deepinsight/insightface) — Face detection and recognition
- [FastAPI](https://fastapi.tiangolo.com/) — Backend API framework
- [React](https://react.dev/) — Frontend framework
- [Tailwind CSS](https://tailwindcss.com/) — Styling
- [Framer Motion](https://www.framer.com/motion/) — Animations
- [Lucide Icons](https://lucide.dev/) — UI icons
- [Cloudflare](https://www.cloudflare.com/) — Free tunnel hosting

---

**Built with ❤️ for families who want to keep their memories private.**