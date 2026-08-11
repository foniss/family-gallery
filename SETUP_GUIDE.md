# Family Gallery — Complete Setup Guide

A step-by-step guide to get your own AI-powered family photo gallery running.

---

## Prerequisites

Before starting, make sure you have:

- **Windows 10/11** (tested on Windows, may work on Mac/Linux with path changes)
- **Node.js** — [Download LTS version](https://nodejs.org)
- **Python 3.11+** — [Download](https://www.python.org/downloads/) (check "Add to PATH" during install)
- **Git** — [Download](https://git-scm.com/download/win)

---

## Step 1: Clone The Repository

```bash
git clone https://github.com/foniss/family-gallery.git
cd family-gallery
```

---

## Step 2: Install Dependencies

### Node.js packages:
```bash
npm install
```

### Python packages:
```bash
pip install fastapi uvicorn pillow numpy scikit-learn tqdm aiofiles python-multipart insightface onnxruntime opencv-python
```

If `pip` doesn't work, try:
```bash
python -m pip install fastapi uvicorn pillow numpy scikit-learn tqdm aiofiles python-multipart insightface onnxruntime opencv-python
```

---

## Step 3: Configure Your Settings

### Copy the config template:

Windows:
```powershell
copy backend\config.example.py backend\config.py
```

Mac/Linux:
```bash
cp backend/config.example.py backend/config.py
```

### Edit `backend/config.py`:

Open the file and change `ROOT_DIR` to wherever you cloned the project:

```python
# Example Windows:
ROOT_DIR = Path("C:/Users/YourName/family-gallery")

# Example Mac/Linux:
ROOT_DIR = Path("/home/yourname/family-gallery")
```

---

## Step 4: Set Your Passwords

### Family viewer password:

Open `src/viewer/PasswordGate.jsx` and change:
```jsx
const FAMILY_PASSWORD = 'YourFamilyPassword';
```

### Admin panel password:

Open `src/admin/AdminGate.jsx` and change:
```jsx
const ADMIN_PASSWORD = 'YourAdminPassword';
```

---

## Step 5: Initialize The Database

```bash
cd backend
python -c "from database import create_tables; create_tables()"
python -c "from config import ensure_dirs; ensure_dirs()"
```

This creates the SQLite database and all necessary folders.

---

## Step 6: First Run

### Option A: Use the launcher (Windows)
Double-click `start.bat`

### Option B: Manual start

Terminal 1 — Start API:
```bash
cd backend
python api.py
```

Terminal 2 — Start React:
```bash
npm start
```

### Open in browser:
- **Family Viewer:** http://localhost:3000
- **Admin Panel:** http://localhost:3000/admin

---

## Step 7: Add Your First Photos (Seed Batch)

The AI needs to learn your family's faces. Start with a small batch:

1. Pick **~100 photos** with clear faces of family members
   - 10-20 photos per person
   - Clear, well-lit, front-facing photos work best
   - Mix of solo and small group photos

2. Copy them into the inbox folder:
   ```
   gallery/inbox/
   ```

3. Process them:
   ```bash
   cd backend
   python run.py --tag "seed"
   ```

4. Open the admin panel → **Review Queue**
   - Name each cluster of faces
   - Be thorough — this is your foundation

5. After naming everyone, rerun clustering for better accuracy:
   ```bash
   python run.py --cluster
   ```

6. Check Review Queue again — name any new clusters

---

## Step 8: Add Your Full Photo Collection

Once you've seeded the model with known faces:

1. Copy all your photos into `gallery/inbox/`

2. Process them:
   ```bash
   cd backend
   python run.py --tag "main_collection"
   ```
   
   This may take several hours for large collections (6-12 hours for 30,000 photos). Run it overnight.

3. After processing:
   - Most faces will be auto-tagged based on your seed
   - Check Review Queue for any new unknown clusters
   - Use admin gallery to fix any wrong tags

---

## Step 9: Host Online (Optional)

Share your gallery with family over the internet using free tools.

### Prerequisites:
- [Cloudflared](https://github.com/cloudflare/cloudflared/releases) — download and install the Windows MSI
- A [GitHub](https://github.com) account (free)

### One-Time Setup:

#### 1. Create a redirect repository on GitHub:
- Go to github.com → New repository
- Name it: `family-gallery-redirect`
- Set to **Public**
- Check "Add a README file"
- Create repository

#### 2. Enable GitHub Pages:
- Go to your new repo → Settings → Pages
- Source: Deploy from a branch
- Branch: main / (root)
- Save
- Note your URL: `https://YOUR-USERNAME.github.io/family-gallery-redirect`

#### 3. Clone it inside your project:
```bash
cd family-gallery
git clone https://github.com/YOUR-USERNAME/family-gallery-redirect.git
```

#### 4. Configure git credentials:
```bash
cd family-gallery-redirect
git config user.name "YOUR-USERNAME"
git config user.email "your@email.com"
git config --global credential.helper store
```

Do a test push (it will ask for credentials once):
```bash
echo "test" > test.txt
git add test.txt
git commit -m "test"
git push
```
- Username: your GitHub username
- Password: your GitHub **Personal Access Token** (NOT your password)

To get a token: GitHub → Settings → Developer settings → Personal access tokens → Generate new token → check "repo" → Generate → Copy it

#### 5. Configure `update_link.py`:

Open `update_link.py` in your project root and change these lines:
```python
GITHUB_USERNAME = "YOUR-GITHUB-USERNAME"    # Your GitHub username
REPO_NAME = "family-gallery-redirect"       # Your redirect repo name
```

#### 6. Update `src/services/api.js`:

The `API_ORIGIN` line needs to point to your tunnel URL. The `update_link.py` script updates this automatically each time you host online.

### Hosting Online:

Every time you want family to access the gallery:

1. Double-click `host_online.bat`

2. Wait for it to:
   - Start API
   - Start React
   - Start Cloudflare tunnels
   - Update GitHub Pages redirect

3. Terminal will show:
   ```
   SHARE THIS URL WITH FAMILY:
   https://YOUR-USERNAME.github.io/family-gallery-redirect
   ```

4. Share that URL with family — they bookmark it once

5. When done, press Ctrl+C to stop everything

### How It Works:
```
Family opens: https://YOUR-USERNAME.github.io/family-gallery-redirect
    → GitHub Pages redirects to current Cloudflare tunnel URL
    → Your React app loads
    → React fetches data from API tunnel
    → Family sees the gallery

Each time you restart:
    → New tunnel URLs generated automatically
    → Script updates the redirect page
    → Family's bookmarked URL still works
```

### Important Notes:
- Gallery is only accessible when your PC is running `host_online.bat`
- When you stop hosting, the URL shows an error page
- Family enters the password once per device — saved permanently
- Admin panel is also accessible at the same URL + `/admin` (separate password)

---

## Folder Structure After Setup

```
family-gallery/
├── backend/              # Python API + AI processing
│   ├── config.py         # YOUR config (not tracked by git)
│   ├── config.example.py # Template config
│   ├── api.py            # REST API server
│   ├── scanner.py        # Photo scanner
│   ├── detector.py       # Face detection
│   ├── clusterer.py      # Face clustering
│   ├── database.py       # Database operations
│   ├── progress.py       # Progress tracking
│   └── run.py            # Master pipeline script
├── gallery/              # Photo storage (not tracked by git)
│   ├── inbox/            # Drop new photos here
│   ├── photos/           # Processed (with faces)
│   ├── misc/             # Processed (no faces)
│   ├── duplicates/       # Duplicate files
│   ├── removed/          # Deleted photos (recoverable)
│   ├── archive/          # Archived photos
│   ├── errors/           # Failed processing
│   ├── exports/          # Downloaded albums
│   └── videos/           # Video files (future use)
├── data/                 # App data (not tracked by git)
│   ├── gallery.db        # SQLite database
│   ├── thumbnails/       # Preview images
│   ├── face_crops/       # Detected face crops
│   └── avatars/          # Person avatar images
├── src/                  # React frontend
│   ├── admin/            # Admin panel components
│   ├── viewer/           # Family viewer components
│   ├── components/       # Shared components
│   └── services/         # API helper
├── start.bat             # Local launcher (Windows)
├── host_online.bat       # Online hosting launcher (Windows)
└── update_link.py        # Hosting URL updater (not tracked by git)
```

---

## Tips For Best Results

### Face Detection Accuracy
- Start with clear, well-lit seed photos
- Run clustering multiple times after naming people
- Each pass improves accuracy (85-90% after 3 passes)
- Use admin gallery to manually fix wrong tags

### AI Settings (Admin → Settings)
- **Face Confidence:** 0.5 (balanced detection)
- **Face Match:** 0.42 (separates siblings well)
- **Cluster EPS:** 0.40 (prevents merging similar-looking people)
- **Min Face Size:** 35px (catches background faces in group photos)

### Improving Detection In Group Photos
Open `backend/detector.py`, find `det_size=(640, 640)` and change to:
```python
det_size=(1280, 1280)
```
This detects smaller faces but processing takes ~3x longer.

### Person Categories
- Set family members to "family" category in People Manager
- Set friends to "friends" category
- Family viewer only shows "family" category people
- Create custom categories as needed

### Custom Tags
- Use tags when scanning: `python run.py --tag "wedding_2024"`
- Tag becomes the folder name in `gallery/photos/`
- Filter by multiple tags in the viewer
- Great for organizing events and batches

### Processing Large Collections
- Run overnight: `python run.py --tag "collection_name"`
- If interrupted, just run again — it resumes automatically
- Don't close the terminal or sleep your PC during processing

---

## Troubleshooting

### "pip not recognized"
```bash
python -m pip install ...
```

### "insightface fails to install"
Try Python 3.11 instead of 3.14. Some AI libraries need stable Python versions.

### Photos are rotated
The scanner auto-fixes EXIF rotation. For stubborn photos, use the rotate button in admin lightbox.

### Face detection misses background people
- Increase detection resolution in `backend/detector.py`
- Change `det_size=(640, 640)` to `det_size=(1280, 1280)`
- Lower `MIN_FACE_SIZE` in `backend/config.py`

### Similar people getting merged (siblings, relatives with hijab, etc.)
- Lower `CLUSTER_EPS` in config.py (try 0.35)
- Rerun clustering: `python run.py --cluster`
- Use the Split feature in People Manager if already merged

### Brothers/sisters merged into one person
- Delete the person in People Manager
- Rerun clustering: `python run.py --cluster`
- Name the two new separate clusters correctly

### Database locked error
Close all terminals, DB Browser, and any other programs accessing the database. Then try again.

### API loads slowly with many photos
Add database indexes (run once):
```bash
cd backend
python -c "from database import create_indexes; create_indexes()"
```

### Photos don't load on phone when hosting online
Make sure all URLs in your React code use the `API_BASE` variable from `src/services/api.js` instead of hardcoded `http://localhost:8000`.

---

## License

MIT — use it however you want.