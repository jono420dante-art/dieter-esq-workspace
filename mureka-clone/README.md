# Mureka-style clone (Vite + React)

## Dev (REST or tRPC)

**tRPC path (default):** `Create` calls `murekaSongGenerate` / `murekaSongQuery` on the DIETER tRPC server, which proxies to FastAPI → Mureka.

### macOS / Linux (one terminal)

From repo root:

```bash
chmod +x mureka-clone/dev-stack.sh serve-mac.sh
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

## Stems

When Mureka returns a ZIP or stem URLs, add download buttons in `App.jsx` and point users to Ableton / Logic import.
