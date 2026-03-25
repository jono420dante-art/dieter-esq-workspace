# Mureka Clone V2 — own GitHub repository

This Vite app can live in **its own repo** (for example `your-org/mureka-clone-v2`). The Dieter **FastAPI** backend stays a separate project (for example `your-org/dieter-backend` or the full `dieter-esq-workspace` monorepo).

## What you get

- One GitHub repo = **only** this frontend (`npm run dev`, `npm run build`, Vercel).
- The UI talks to any deployed API via **`VITE_API_BASE`** (e.g. `https://your-api.up.railway.app/api`).
- Optional: clone **`dieter-backend`** **next to** this repo on disk and run `npm run build:backend` to copy `dist/` into `../dieter-backend/static`, or set **`DIETER_BACKEND_PATH`**.

## Create the new repository

### Option A — New folder (simple)

1. On GitHub: **New repository** → name e.g. `mureka-clone-v2` → empty, no README.
2. On your machine, copy **only** the contents of the `mureka-clone/` folder (this app) into a new directory that will be the repo root.
3. In that directory:

```bash
git init
git add .
git commit -m "Initial: Mureka Clone V2 standalone"
git branch -M main
git remote add origin https://github.com/YOUR_USER/mureka-clone-v2.git
git push -u origin main
```

### Option B — Split from the monorepo with `git subtree` (keep history)

From the **parent** repo that contains `mureka-clone/`:

```bash
git subtree split -P mureka-clone -b mureka-clone-v2-split
git push https://github.com/YOUR_USER/mureka-clone-v2.git mureka-clone-v2-split:main
```

Then clone the new repo and continue work there.

## Deploy (Vercel)

1. Import **this** repo in Vercel; **Root Directory** = `.` (repo root is the Vite app).
2. Set **`VITE_API_BASE`** to your live backend, e.g. `https://YOUR_HOST.up.railway.app/api`.
3. See **`DEPLOY_VERCEL_RAILWAY.md`** in the backend monorepo for CORS (`DIETER_CORS_ORIGINS`) — or copy the relevant section into this repo’s wiki.

## Linking backend + frontend in development

- Run FastAPI locally (e.g. port **8787**).
- In this repo, **`.env.local`** (or Vite env): `VITE_API_BASE=http://127.0.0.1:8787/api` if not using the default proxy, or rely on **`vite.config.js`** proxy to `8787`.

## Scripts

| Command | Purpose |
|--------|---------|
| `npm run build` | Production `dist/` only |
| `npm run build:backend` | `vite build` + copy to `../dieter-backend/static` if that folder exists |
| `DIETER_BACKEND_PATH=../path/to/dieter-backend npm run build:backend` | Copy to a custom backend checkout |

The backend remains optional: **Vercel** only needs `npm run build` and **`dist/`**.
