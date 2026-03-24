# DIETER — start here (Windows)

## 1. Install Python (once)

1. **https://www.python.org/downloads/** → Python **3.11+**
2. ✅ Check **“Add python.exe to PATH”**
3. Close and reopen **File Explorer** (or sign out/in)

## 2. Install Node.js (once)

1. **https://nodejs.org/** → **LTS** (includes `npm`)
2. Close and reopen **File Explorer**

## 3. Run the app

Folder layout:

```text
Downloads\dIETER JONO TOWEER_files\   (or wherever you extracted)
├── OPEN-DIETER-LOCAL.bat    ← DOUBLE-CLICK THIS
├── dieter-local-studio\     (optional: standalone Librosa API on port 8890)
├── dieter-backend\          (FastAPI — powers “Local” tab in mureka-clone)
└── mureka-clone\            (React UI — Vite)
```

- **Double‑click `OPEN-DIETER-LOCAL.bat`**  
  - Creates Python **venv** and installs packages (first run can take a few minutes)  
  - Starts **API** (see your `serve-windows.ps1` / backend — often **8787**)  
  - Starts **Web UI** → **http://127.0.0.1:5173**  
  - Tries to open the browser  

> If you use **only** `dieter-local-studio` (port **8890**), run that service separately; the React app’s **Local** tab is wired to **DIETER FastAPI** under `/api` by default.

### Manual setup: `dieter-backend` on port **8000** + Vite

See **`QUICKSTART_DEV.md`** (`uvicorn` on **8000**, `npm run dev` / `npm start`, pitch env vars, static HTML via **http://127.0.0.1:5173/…** — not `file://`).

## 4. In the app (Local studio)

1. Pick a voice (e.g. **👨 Man 2**)
2. Type lyrics, e.g. **“Drop the bass, feel the rhythm tonight”**
3. **Drag** any **MP3** beat onto the drop zone (or click to browse)
4. Click **Make Song** → wait → **▶ Play** + **Download**

> Full RVC/Tortoise singing runs on **your** GPU box when configured; until then, the app uses the **offline procedural** vocal layer + **FFmpeg** mix where implemented in `dieter-backend`.

### Optional: static “Suno-style” page (same API)

With Vite running, open **`http://127.0.0.1:5173/dieter-ai-music-studio.html`** — 12 voice cards, lyrics, beat upload, **Make Song** → play + download.  
If your API is on another host/port than the Vite proxy, add e.g. **`?api=http://127.0.0.1:8890/api`** to the URL once.

## Troubleshooting

- **Nothing opens** → Run `OPEN-DIETER-LOCAL.bat` from the folder that **contains** `mureka-clone` (see `WINDOWS_QUICKSTART.md`).
- **Red errors** in black windows → copy the text and fix Python/Node PATH first.
