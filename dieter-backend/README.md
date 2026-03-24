# DIETER Backend (real)

This is the real backend API for DIETER (jobs, storage, WAV generation).

## Production (Gunicorn + static UI)

Build the React app into `static/`, then run the API (same process serves `/` and `/api/*`):

```bash
cd mureka-clone && npm ci && npm run build
# copy Vite output next to the Python package:
cp -r dist/* ../dieter-backend/static/
cd ../dieter-backend
pip install -r requirements.txt
gunicorn app.main:app -k uvicorn.workers.UvicornWorker -w 2 -b 0.0.0.0:8080 --timeout 120
```

Or use **Docker** / **docker compose** from the repository root — see `docker-compose.yml` and `Dockerfile`.

**Render.com:** see `DEPLOY_RENDER.md` and root `render.yaml`.

## Run dev (Windows PowerShell)

```powershell
cd "C:\Users\Michelle\Downloads\dIETER JONO TOWEER_files\dieter-backend"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8787
```

## Run (macOS)

From the **repository root** (parent of `dieter-backend/`):

```bash
chmod +x serve-mac.sh mureka-clone/dev-stack.sh
./serve-mac.sh
```

This starts **FastAPI** (`8787`), **tRPC** (`8790`), and the **mureka-clone** Vite app (`5173`). Open **http://127.0.0.1:5173**.

See **`GETTING_STARTED.md`** in the repo root for the full picture (env vars, static `deploy/` UI, Windows, troubleshooting).

**Backend only** (one terminal):

```bash
cd dieter-backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8787
```

## What you get

- `POST /api/music/plan`
- `POST /api/music/generate` (async job)
- `GET /api/jobs/{jobId}` (poll)
- `GET /api/storage/{key}` (download generated WAV)

### Mureka proxy (CORS-friendly)

Browser UIs should call these instead of `https://api.mureka.ai` directly (avoids CORS). Pass `Authorization: Bearer <key>` or set env `MUREKA_API_KEY`.

- `POST /api/mureka/song/generate` — body: `{ "lyrics": "", "model": "auto", "prompt": "style + vocal + detail" }` ([docs](https://platform.mureka.ai/docs/en/quickstart.html))
- `GET /api/mureka/song/query/{task_id}` — poll until a downloadable URL appears in the JSON

Then poll the returned task id until the response includes an `mp3_url` / `audio_url` (shape may vary by API version).

### Lyrics helper (Generate / Optimize)

Server-side lyrics so the browser never calls OpenAI directly (optional `OPENAI_API_KEY` on FastAPI, or pass `openaiApiKey` in the JSON body). Falls back to local templates/rules if OpenAI is unavailable.

- `POST /api/lyrics/generate` — body: `{ "style": "…", "title": "…", "vocal": "female"|"male", "openaiApiKey": null }` → `{ "text": "…", "source": "openai"|"local" }`
- `POST /api/lyrics/optimize` — body: `{ "lyrics": "…", "openaiApiKey": null }` → `{ "text": "…", "source": "openai"|"local" }`

The `dieter-trpc` gateway exposes `lyricsGenerate` and `lyricsOptimize` mutations that proxy to these routes.

Storage is local filesystem under `storage/` (S3-compatible later).

### DistroKid (manual upload after master)

There is **no DistroKid API** for uploads—use their dashboard. Step-by-step: **`DISTROKID_RELEASE.md`**.

Related API routes (metadata stub + optional file prep):

- `POST /api/pipeline/generate-master`
- `POST /api/pipeline/upload-distrokid-prep`

**Beat-reactive waveform video (FFmpeg, offline):**

- `POST /api/local/music-video` — multipart audio + optional `beat_times_json` (or auto librosa beats) → H.264 MP4 with `+faststart` for web upload. HeyGen/MAIVE-style AI clips are not included; wire those providers separately.

## Production deploy (Backend + API gateway)

This repo now includes production deployment scaffolding:

- `dieter-backend/Dockerfile` (FastAPI)
- `dieter-backend/dieter-trpc/Dockerfile` (tRPC API gateway)
- `dieter-backend/render.yaml` (Render blueprint with both services)
- `dieter-backend/.env.example` (runtime env vars)

### Option A — Render (recommended)

1. Push your repo to GitHub.
2. In Render, create a new Blueprint and point to this repo.
3. Use `dieter-backend/render.yaml`.
4. After first deploy, set:
   - `DIETER_FASTAPI_BASE` on `dieter-trpc` to your backend URL  
     Example: `https://dieter-api.onrender.com`
5. Redeploy `dieter-trpc`.

Health checks:

- Backend: `/api/health`
- tRPC: `/health`

### Option B — Docker Compose (VPS / local prod)

Create a compose file with two services:

- FastAPI container from `dieter-backend/Dockerfile`
- tRPC container from `dieter-backend/dieter-trpc/Dockerfile`

Set env:

- `DIETER_FASTAPI_BASE=http://<backend-host>:<backend-port>` on tRPC
- `PORT` and `DIETER_TRPC_PORT` for host port mapping

### Frontend API wiring (important)

Point your frontend to the deployed tRPC URL (or backend URL, depending on call path):

- tRPC base: `https://<your-trpc-service>/trpc`
- FastAPI base: `https://<your-backend-service>/api`

Use HTTPS in production.

## Pure Song (local Coqui TTS + librosa + FFmpeg) — `main.py`

Experimental **free, local** vocal demo on the **legacy** entrypoint `main:app` (not `app.main:app` unless you port routes):

```powershell
cd dieter-backend
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

- **`POST /pure-song`** (alias **`POST /api/pure-song`**) — form fields: **`beat`** (audio file), **`lyrics`** (text).  
- Response: `{ "song": "/static/master_pro_<id>.mp3", "bpm": …, "pure": true, … }` — download via **`GET http://localhost:8000/static/...`**.  
- Requires **FFmpeg** on `PATH`. First TTS run downloads the **Glow-TTS / LJSpeech** model.

Prompt tips: use structure tags like `[verse]`, `[chorus]`, `[male]` in lyrics; the server wraps lines with `[singing] … [clear pronunciation…]`.

**RVC** (voice conversion) is not wired here — keep using `scripts/vocal_pipeline_stub.py` / a separate RVC WebUI for timbre; this stack is **TTS → beat sync → FFmpeg master**.

### Mureka → dieter-backend (`mureka_sync.py` + `main.py`)

Set **`MUREKA_API_KEY`** (server env only — [Mureka quickstart](https://platform.mureka.ai/docs/en/quickstart.html)).

- **`POST /api/pure-song-mureka`** — multipart: **`beat`** (file), **`lyrics`**, **`mureka_style`** (`rap` \| `pop` \| `edm` \| `rnb` \| custom). Calls **`POST /v1/song/generate`**, polls **`GET /v1/song/query/{id}`**, downloads audio, runs **`pro_ffmpeg_master`** with your beat.
- **`POST /api/mureka-webhook`** — JSON body with a downloadable URL (`audio_url` or parseable nested URL). Saves to **`/static`** (no beat mix; use the pipeline above when you have a beat).

**mureka-clone** `BeatLab.jsx`: after analyzing a beat, use **“Mureka AI + pro mix”** — it sends **`FormData`** to **`/api/pure-song-mureka`** (same as your backend; set **`VITE_BEAT_API_URL`** if the UI is not same-origin).

