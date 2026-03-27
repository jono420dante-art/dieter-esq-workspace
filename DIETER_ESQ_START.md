# Dieter Esq. — full app: open and use

The **full application** is one service: **React UI + FastAPI** in a **single Docker image**. You open **one HTTPS URL** — no separate static site or `?api=` setup.

## Source on GitHub

**https://github.com/jono420dante-art/dieter-esq-workspace**

Use this repo when Railway (or Render) asks you to pick a GitHub project.

## Pathway (production)

### 1. Deploy on Railway

1. Create a project at [railway.app](https://railway.app) and **Deploy from GitHub** (this repository).
2. In the service **Settings**, set **Root Directory** to **empty** (repository root). Do **not** set it to `dieter-backend` — the Docker build needs both `mureka-clone/` and `dieter-backend/` in the same context.
3. Railway should pick up **`railway.toml`** at the repo root (build: `dieter-backend/Dockerfile`).
4. After the build finishes, open the **generated public URL** (e.g. `https://your-service.up.railway.app`).
5. That URL is the app: **same origin** for the UI and **`/api/*`**.

Optional environment variables (in Railway → Variables):

| Variable | Purpose |
|----------|---------|
| `MUREKA_API_KEY` | Cloud song generation (Mureka) |
| `OPENAI_API_KEY` | AI lyrics on the server (GPT) |
| `ANTHROPIC_API_KEY` | AI lyrics on the server (Claude); order vs OpenAI: `DIETER_LYRICS_AI_ORDER` |
| `WEB_CONCURRENCY` | Gunicorn workers (default `2`) |
| `DIETER_AUDIO_ENGINE` | e.g. `procedural` |

### 2. First visit checklist

1. Open the **root** of the URL (`/`). **Create** = prompts + optional Mureka cloud; **Local** = your lyrics + a beat via Dieter (**no Mureka key**). In dev, `.env` can set `VITE_DEFAULT_MODE=local` to open on Local first.
2. **Mureka is optional.** For cloud tracks: **Connections** → Mureka key → **Generate with Mureka**. For poems/lyrics + beat: **Local** → paste lines, drop audio, **Make Song**.
3. Confirm API: `https://YOUR_HOST/api/health` returns `{"ok":true,...}`.
4. Use **Local**, **Beat lab**, and **Voice studio** for stems, FFmpeg pipeline, and reference voice — all on the same host.
5. **Cloud** tab = advanced form (lyrics + style presets) — same Mureka backend path.

**Your live app URL** is whatever Railway (or Render) shows after deploy — shape: `https://<service>.up.railway.app` — there is no fixed link until you deploy.

### 3. Same thing on Render

Use **`dieter-backend/Dockerfile`** from the **repository root** as context, health check **`/api/health`**. See `dieter-backend/DEPLOY_RENDER.md`.

### 4. Vercel (static React UI + API elsewhere)

Step-by-step for **GitHub → Vercel + Railway** (env vars, CORS, API-only Docker): see **`DEPLOY_VERCEL_RAILWAY.md`** at the repo root. For API-only Railway builds use **`dieter-backend/Dockerfile.api`** (no `mureka-clone` in the image).

Vercel hosts the **Vite build** from **`mureka-clone`** only. Your **FastAPI** backend must already be live (Railway / Render / Docker) — the browser calls that host via `VITE_API_BASE`.

1. In [Vercel](https://vercel.com), switch to team **`jonathan-s-projects-2da2bb36`** (team menu, top left), then **Add New → Project** and import **[dieter-esq-workspace](https://github.com/jono420dante-art/dieter-esq-workspace)**.
2. **Root Directory**: leave **empty** so Vercel uses the repo root **[`vercel.json`](./vercel.json)** (it installs and builds inside `mureka-clone/`).  
   *Alternative:* set **Root Directory** to **`mureka-clone`** and use [`mureka-clone/vercel.json`](./mureka-clone/vercel.json) only — do **not** do both conflicting setups.
3. **Environment Variables** (Production and Preview), at minimum:

| Variable | Example | Purpose |
|----------|---------|---------|
| `VITE_API_BASE` | `https://your-api.up.railway.app/api` | All `/api` traffic from the UI |
| `VITE_USE_TRPC` | omit (defaults **REST** on Vercel/production) | Set `true` only if you deploy **`dieter-trpc`** and want the UI to call `/trpc` |

Optional: `VITE_TRPC_URL` if you deploy **`dieter-backend/dieter-trpc`** separately; `VITE_DEFAULT_MODE`, `MUREKA_API_KEY` on the **backend** for server-side Mureka.

4. Deploy. Open the **stable production URL** **https://dieter-esq-workspace.vercel.app** (each deploy also gets a unique `*-*.vercel.app` URL; prefer the alias for bookmarks). In **Connections**, confirm **API base** matches your backend (or rely on the baked-in `VITE_API_BASE`).

**Redeploy (Vercel):** from the repository root, run `npm run deploy:vercel` after `vercel login`, or push to the connected Git branch.

**CORS:** FastAPI defaults to permissive origins (`DIETER_CORS_ORIGINS` default `*`). For production hardening, set `DIETER_CORS_ORIGINS` to your Vercel origin(s), e.g. `https://dieter-esq-workspace.vercel.app`.

### VPS (full stack in Docker)

On your server (Docker + repo clone): `docker compose build && docker compose up -d` from the repo root — same image as Railway (see **§1** above). Use your VPS public URL and point DNS / TLS as usual; no Vercel involved.

---

## Pathway (local, full stack)

From the **repository root**:

```powershell
docker compose build
docker compose up
```

Open **http://localhost:8080** — that is the full app.  
Health: **http://localhost:8080/api/health**

---

## What this is *not*

- **Not** “static HTML only”: those files under `public/` are optional extras inside the same build; the main product is the **React app at `/`**.
- **Not** required: Vercel / Cloudflare Pages + separate API URL — that split is only if you *choose* to host the UI elsewhere (see **§4 Vercel** above).

---

## Troubleshooting

- **Docker: `"/mureka-clone": not found`** (or `failed to calculate checksum`): the image is being built with the **wrong context**. The context must be the **repository root** (the directory that contains both `mureka-clone/` and `dieter-backend/`). On **Railway**, clear **Root Directory** in service settings. On **Render**, the Docker **context** for `dockerfilePath: ./dieter-backend/Dockerfile` must be the repo root (Render’s default for a single service is usually correct). On **Google Cloud Build**, use `docker build -f dieter-backend/Dockerfile .` with `.` = repo root, not `dieter-backend` as the build’s working directory. Also confirm **`mureka-clone/` is committed and pushed** to GitHub — a backend-only clone will fail the same way.
- **Blank page**: check build logs; ensure `npm run build` inside Docker succeeded.
- **API errors**: confirm `/api/health` works; check Railway/Render logs for missing **ffmpeg** (included in Dockerfile) or Python errors.
- **Mureka / OpenAI**: set keys on the **server** (Railway variables), not only in the browser.
