# Deploy to Render.com (Docker)

Single **Web Service** runs **Gunicorn + Uvicorn workers**, **FastAPI**, and the **Vite** static bundle (AI Beat Lab UI).

## 1. Repo layout

- `dieter-backend/Dockerfile` — multi-stage: builds `mureka-clone`, copies `dist` → `/app/static`.
- `docker-compose.yml` — local smoke test (`docker compose up`).

## 2. Render dashboard

1. **New → Web Service → Build from repo** (GitHub/GitLab).
2. **Root directory**: leave empty (repository root) *or* set to `.` if Render asks.
3. **Dockerfile path**: `dieter-backend/Dockerfile`.
4. **Instance type**: at least **Starter** (512MB+); librosa benefits from CPU.
5. **Health check path**: `/api/health`
6. **Environment**:
   - `PORT` — Render injects automatically (often `10000`); the Dockerfile `CMD` uses `${PORT}`.
   - `WEB_CONCURRENCY` — optional, default `2` (lower if OOM).
   - `DIETER_AUDIO_ENGINE` — optional, e.g. `procedural`.

## 3. Blueprint (`render.yaml`)

See `dieter-backend/render.yaml` in this repo — adjust service name and remove the second service if you only deploy **one** combined image (recommended for this stack).

**Note:** Older blueprints pointed `dieter-trpc` at a separate URL. For **Beat Lab + static only**, you only need the **FastAPI** Docker service; add tRPC later if you use Mureka cloud flows.

## 4. First deploy checklist

- [ ] Build succeeds locally: `docker compose build` from repo root.
- [ ] Open `https://<your-service>.onrender.com` — React loads.
- [ ] `GET https://<your-service>.onrender.com/api/health` returns JSON.
- [ ] Beat Lab: upload a loop → BPM + waveform (uses same origin `/api/analyze-beats`).

## 5. Cold starts

Free/starter tiers **spin down** after idle. First request may take **30–60s**. Upgrade or use a keep-alive ping if needed.

## 6. Vercel UI + Render API (split origin)

If the React app is on **Vercel** and the API on **Render**, set **Vercel → Project → Environment Variables**:

- **`VITE_API_BASE`** = your Render service origin **without** a path, e.g. `https://dieter-beat-lab.onrender.com` (the client appends `/api`).

Redeploy Vercel after changing env vars so the value is baked into the bundle. Optionally set **`DIETER_CORS_ORIGINS`** on Render to a comma list including `https://your-app.vercel.app` (default `*` already allows browser calls from Vercel).
