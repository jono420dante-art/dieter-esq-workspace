# Dieter Esq. — Vercel (frontend) + Railway (backend)

One **GitHub** repository should contain both **`mureka-clone/`** (React) and **`dieter-backend/`** (FastAPI). That matches this workspace layout and the root **`railway.toml`** / **`Dockerfile`** (full stack on one host).

You have two deployment patterns:

---

## A) Single URL (simplest)

Deploy **`dieter-backend/Dockerfile`** from the **repo root** on **Railway** (see **`railway.toml`**). You get React at `/` and the API at `/api` on the **same origin** — no CORS configuration and no `VITE_API_BASE` guesswork. See **`DIETER_ESQ_START.md`**.

---

## B) Split: Vercel + Railway (fully driven UI + API)

Use this when you want **`*.vercel.app`** for the SPA and a separate API host.

### 1. GitHub

- Push one repo that includes **`mureka-clone`** and **`dieter-backend`** (this monorepo layout).
- Vercel and Railway both connect to **that same repository**.

### 2. Railway — API

1. **New project** → **Deploy from GitHub** → select the repo.
2. **Settings** → set **Root Directory** empty (repo root), **or** add a service that uses:
   - **Dockerfile path:** `dieter-backend/Dockerfile.api`  
   - **Build context:** repository root (the folder that contains both `mureka-clone` and `dieter-backend`).
3. Railway injects **`PORT`**; the container listens on **`0.0.0.0:$PORT`** (already configured).
4. Copy the public HTTPS URL, e.g. `https://dieter-api-production.up.railway.app`.

**Health check:** `GET https://<your-host>/api/health` should return JSON.

**Environment variables (examples):**

| Variable | Purpose |
|----------|---------|
| `DIETER_CORS_ORIGINS` | Comma-separated list, e.g. `https://your-app.vercel.app,https://your-domain.com` (default `*` is permissive) |
| `MUREKA_API_KEY` | Optional — only if you use Mureka cloud routes on the server |
| `OPENAI_API_KEY` | Optional — AI lyrics on the server |

### 3. Vercel — frontend

1. **Add project** → import the **same** GitHub repo.
2. **Root Directory:** `mureka-clone`
3. **Framework:** Vite (or Other; **`vercel.json`** already sets build/output).
4. **Environment variables** (Production + Preview):

| Variable | Example |
|----------|---------|
| `VITE_API_BASE` | `https://dieter-api-production.up.railway.app/api` |
| `VITE_USE_TRPC` | `false` (REST to Railway unless you run tRPC separately) |

5. Deploy. After the first deploy, the built app will call your Railway **`/api`** for lyrics, Local lab, Mureka proxy, storage URLs, etc.

### 4. CORS

If the browser blocks requests, set **`DIETER_CORS_ORIGINS`** on Railway to your exact Vercel origin(s), including `https://<project>.vercel.app`.

### 5. No Mureka key in the browser for “your poems”

- **Local** tab: beat + lyrics → procedural vocal + mix — uses **Dieter only** (no Mureka).
- **Create** tab: optional **Open Local lab** with your text — same pipeline.
- **Mureka** remains optional: add a key under **Connections** when you want cloud generation.

---

## Troubleshooting

| Issue | What to check |
|-------|----------------|
| API 404 from Vercel | `VITE_API_BASE` must end with `/api` and match Railway URL (HTTPS). Redeploy Vercel after changing env. |
| CORS errors | `DIETER_CORS_ORIGINS` includes your Vercel origin. |
| Local lab empty | Railway service must be the API image; confirm **`/api/health`**. |

---

## Related files

- **`mureka-clone/vercel.json`** — SPA rewrites and build output **`dist`**
- **`dieter-backend/Dockerfile`** — full stack (React static + API)
- **`dieter-backend/Dockerfile.api`** — API only for split deploy
- **`railway.toml`** — full-stack Railway (repo root)
