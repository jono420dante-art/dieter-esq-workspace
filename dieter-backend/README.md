# Mureka-style clone (Vite + React)

## Dev (REST or tRPC)

**tRPC path (default):** `Create` calls `murekaSongGenerate` / `murekaSongQuery` on the DIETER tRPC server, which proxies to FastAPI → Mureka.

### Build the React app into `static/` (single origin)

Build the React app into `static/`, then run the API (same process serves `/` and `/api/*`).

**One command (recommended):** install frontend deps once, then build + copy (run each line from the repo root):

```bash
cd mureka-clone
npm ci
cd ..
npm run build:backend
```

`npm run build:backend` is defined at the **repository root** (`package.json`) and in `mureka-clone/`; it uses Node only (no shell `&&`) and runs Vite via `node …/vite.js build`, which avoids Windows issues where spawning `npm.cmd` fails.

Alternatives:

- **Any OS:** `node scripts/build-frontend-to-backend.mjs` from the repo root
- **Windows (PowerShell):** `.\scripts\build-frontend-to-backend.ps1` (same as above)
- **macOS / Linux:** `bash scripts/build-frontend-to-backend.sh`

Then start the server:

```bash
cd dieter-backend
pip install -r requirements.txt
gunicorn app.main:app -k uvicorn.workers.UvicornWorker -w 2 -b 0.0.0.0:8080 --timeout 120
```

Manual copy (equivalent to the scripts above):

```bash
cd mureka-clone && npm ci && npm run build
cp -r dist/* ../dieter-backend/static/
cd ../dieter-backend
pip install -r requirements.txt
gunicorn app.main:app -k uvicorn.workers.UvicornWorker -w 2 -b 0.0.0.0:8080 --timeout 120
```

Or use **Docker** / **docker compose** from the repository root — see `docker-compose.yml` and `Dockerfile`.

**Render.com:** see `DEPLOY_RENDER.md` and root `render.yaml`.

### Run dev (Windows PowerShell)

```powershell
cd dieter-backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8787
```

### macOS / Linux (one terminal)

From repo root:

```bash
chmod +x serve-mac.sh mureka-clone/dev-stack.sh
./serve-mac.sh
```

Or: `./mureka-clone/dev-stack.sh`

### Windows (alternative to dev-stack.ps1)

Use **three terminals**, or run `pwsh -File mureka-clone/dev-stack.ps1` from repo root (opens two extra windows for API + tRPC, then Vite in this shell).

### Three terminals (any OS)

1. **FastAPI** — port `8787`  
   `cd dieter-backend` → activate venv → `uvicorn app.main:app --reload --port 8787`

2. **tRPC gateway** — port `8790`  
   `cd dieter-backend/dieter-trpc` → `npm install` →  
   **macOS/Linux:** `export DIETER_FASTAPI_BASE=http://127.0.0.1:8787` and `npm run dev`  
   **PowerShell:** `$env:DIETER_FASTAPI_BASE='http://127.0.0.1:8787'; npm run dev`  
   (Optional: `DIETER_TRPC_PORT`, default `8790`.)

3. **This app** — `cd mureka-clone` → `npm install` → `npm run dev`  
   Vite proxies `/trpc` → `http://127.0.0.1:8790` and `/api` → `8787` (see `vite.config.js`).

4. Open **API key**, paste your Mureka key, **Create**. Status line shows `[tRPC]` while polling.

**REST only:** set `VITE_USE_TRPC=false` (e.g. in `.env`) to call FastAPI `/api/mureka/*` directly without tRPC.

## Production with FastAPI (single origin)

Build into the backend `static/` folder so Gunicorn serves UI + API:

```bash
# from repo root
cd mureka-clone && npm ci && npm run build
mkdir -p ../dieter-backend/static && cp -r dist/* ../dieter-backend/static/
cd ../dieter-backend && gunicorn app.main:app -k uvicorn.workers.UvicornWorker -w 2 -b 0.0.0.0:8080
```

Or `docker compose up` from the repo root (see `docker-compose.yml`).

## Deploy (Vercel) — SPA-only alternative

```bash
cd mureka-clone
npm run build
vercel --prod
```

- `vercel.json` is included (SPA rewrite + Vite `dist`).
- Set **`VITE_TRPC_URL`** to your deployed tRPC origin + `/trpc` (e.g. `https://dieter-trpc.onrender.com/trpc`) and **`VITE_API_BASE`** if you use REST fallback (`VITE_USE_TRPC=false`).
- Redeploy after changing env vars.
- Prefer **`MUREKA_API_KEY` only on the server**; avoid shipping keys in public clients for production.

## Optional: MusicGen (Audiocraft)

Local lyrics→instrumental generation (large install and GPU recommended):

1. `pip install -r requirements.txt` (includes `audiocraft`, `transformers`; first run may download multi‑GB weights).
2. Set **`DIETER_ENABLE_MUSICGEN=1`** (see `.env.example`). Without this, MusicGen routes return **503**.
3. **Routes:** `GET /api/musicgen/status` · `POST /api/musicgen/generate` · production aliases `POST /api/music` and `POST /api/song` (when enabled).
4. Output WAVs live under **`storage/musicgen/`** and are served at **`/api/storage/musicgen/{jobId}.wav`**.

## Stems

When Mureka returns a ZIP or stem URLs, add download buttons in `App.jsx` and point users to Ableton / Logic import.
