# Manual dev — backend port **8000** + Vite

Use this when you run **`dieter-backend`** yourself (not `dieter-local-studio` on 8890).

## 1. Backend

```bash
cd dieter-backend
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
```

Minimum if you skip `requirements.txt`:

```bash
pip install fastapi uvicorn[standard] librosa soundfile numpy pydantic python-multipart
```

Run API:

```bash
uvicorn app.main:app --reload --port 8000
```

Health check: **http://127.0.0.1:8000/api/health**

## 2. Pitch engine (optional)

Preserves duration when shifting vocals (`DIETER_PITCH_ENGINE`).

**Linux / macOS**

```bash
export DIETER_PITCH_ENGINE=librosa   # or rubberband, ffmpeg_ps
```

**Windows (cmd)**

```bat
set DIETER_PITCH_ENGINE=librosa
```

**Windows (PowerShell)**

```powershell
$env:DIETER_PITCH_ENGINE = "librosa"
```

## 3. Frontend (React + Vite)

```bash
cd mureka-clone
npm install
npm run dev
# or: npm start   (same script — runs Vite)
```

App: **http://127.0.0.1:5173/**

`vite.config.js` proxies **`/api`** → **http://127.0.0.1:8000** by default.  
To point at another backend:

```bash
# Linux/macOS
API_PROXY_TARGET=http://127.0.0.1:8890 npm run dev
```

```bat
REM Windows cmd
set API_PROXY_TARGET=http://127.0.0.1:8890&& npm run dev
```

## 4. Static HTML (dieter-ai-music-studio, sdc420-xtreme, …)

**Do not** open `dieter-ai-music-studio.html` as a **`file://`** URL — `fetch('/api/...')` will fail (wrong origin / CORS).

**Do** run Vite and open the page on the dev server, e.g.:

- **http://127.0.0.1:5173/dieter-ai-music-studio.html**
- **http://127.0.0.1:5173/sdc420-xtreme.html**

If the API is **not** proxied to the same port (e.g. backend on 8890 without changing `API_PROXY_TARGET`), add a query param once:

**http://127.0.0.1:5173/dieter-ai-music-studio.html?api=http://127.0.0.1:8890/api**

## 5. Compare: `OPEN-DIETER-LOCAL.bat`

That launcher uses **`dieter-local-studio`** (port **8890**), not `dieter-backend` on 8000. For a single stack with **8000**, use the steps above and **`QUICKSTART_DEV.md`**.
