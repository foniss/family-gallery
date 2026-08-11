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
python -m pip install fastapi uvicorn pillow numpy scikit-learn tqdm aiofiles python-multipart insightface onnxrun...o `det_size=(1280, 1280)`
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