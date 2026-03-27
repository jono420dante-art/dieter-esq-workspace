# Deploy Vocal Engine (use from any phone / browser)

## Why `127.0.0.1` fails on another device

`127.0.0.1` always means “this machine.” A phone or another computer cannot reach your laptop’s backend through that address. You need either:

1. **A public HTTPS URL** for the API (and for the UI, or a LAN IP with servers listening on `0.0.0.0`), or  
2. **Same Wi‑Fi + your PC’s LAN IP** (see [Local network](#local-network-same-wi-fi) below).

---

## Recommended: Render (API) + Vercel (UI)

### 1) API — Render

1. In [Render](https://render.com): **New → Web Service** (or **Blueprint** using the repo root `render.yaml`).
2. Connect this repo. Use these settings if creating the service manually:
   - **Root**: repository root (the Dockerfile copies `vocal-engine-app/` from there).
   - **Dockerfile path**: `vocal-engine-app/backend/Dockerfile`
   - **Health check path**: `/health`
3. **Environment**
   - `PORT` — Render usually injects this; the image defaults to `8080` and uvicorn uses `${PORT}`.
   - `VOCAL_CORS_ORIGINS` — use `*` so any deployed frontend can call the API, **or** a comma-separated list of exact origins (e.g. `https://your-app.vercel.app`).  
   - `RVC_DEVICE` — `cpu` on Render (no GPU on starter plans). Optional RVC model files must be baked or mounted per your setup.
4. After deploy, copy the service URL, e.g. `https://vocal-engine-api-xxxx.onrender.com`.

**Cold starts:** Free/starter instances sleep after idle time; the first request may take ~30–60s.

### 2) UI — Vercel

1. **New Project** → import this repo.
2. **Root Directory**: `vocal-engine-app/frontend`
3. Framework: Vite (or “Other” with defaults from `vercel.json`).
4. **Environment Variables** (Production — and Preview if you use preview deployments):

   | Name            | Value |
   |-----------------|--------|
   | `VITE_API_URL`  | `https://vocal-engine-api-xxxx.onrender.com` (no trailing slash) |

5. Deploy. Open the Vercel URL on any device.

The UI bakes `VITE_API_URL` at **build** time. After you change it, trigger a **redeploy** on Vercel.

---

## Local network (same Wi‑Fi)

**Backend** (listen on all interfaces):

```bash
cd vocal-engine-app/backend
source ../.venv/bin/activate   # if you use a venv
uvicorn main:app --host 0.0.0.0 --port 8000
```

**Frontend** — from `vocal-engine-app/frontend`:

```bash
cp .env.example .env.local
# Set VITE_API_URL=http://YOUR_PC_LAN_IP:8000  e.g. http://192.168.1.50:8000
npm run dev
```

`vite.config.js` uses `host: true` so the dev server is reachable as `http://YOUR_PC_LAN_IP:5173`.

**CORS** — export before starting the API if the UI is not on localhost:

```bash
export VOCAL_CORS_ORIGINS=*
# Windows PowerShell: $env:VOCAL_CORS_ORIGINS="*"
```

---

## Docker (LAN or server)

From repo root:

```bash
export VOCAL_CORS_ORIGINS=*
docker compose -f vocal-engine-app/docker-compose.yml up --build
```

API: `http://<host>:8000` (or the mapped port). Point `VITE_API_URL` at that URL for any client that is not on localhost.

---

## Checklist

- [ ] API is reachable: open `https://…/health` or `http://…/api/health` and see `{"ok":true}`.
- [ ] Vercel **Production** build has `VITE_API_URL` set to that API base URL.
- [ ] After changing `VITE_API_URL`, run a new Vercel deployment.
