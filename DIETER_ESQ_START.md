# Dieter Esq. — full app: open and use

The **full application** is one service: **React UI + FastAPI** in a **single Docker image**. You open **one HTTPS URL** — no separate static site or `?api=` setup.

## Source on GitHub

**https://github.com/jono420dante-art/dieter-esq-workspace**

Use this repo when Railway (or Render) asks you to pick a GitHub project.

## Pathway (production)

### 1. Deploy on Railway

1. Create a project at [railway.app](https://railway.app) and **Deploy from GitHub** (this repository).
2. Railway should pick up **`railway.toml`** at the repo root (build: `dieter-backend/Dockerfile`).
3. After the build finishes, open the **generated public URL** (e.g. `https://your-service.up.railway.app`).
4. That URL is the app: **same origin** for the UI and **`/api/*`**.

Optional environment variables (in Railway → Variables):

| Variable | Purpose |
|----------|---------|
| `MUREKA_API_KEY` | Cloud song generation (Mureka) |
| `OPENAI_API_KEY` | AI lyrics on the server |
| `WEB_CONCURRENCY` | Gunicorn workers (default `2`) |
| `DIETER_AUDIO_ENGINE` | e.g. `procedural` |

### 2. First visit checklist

1. Open the **root** of the URL (`/`). You should see **Dieter Esq.** with tabs: **Local**, **Beat lab**, **Voice studio**, **Cloud**.
2. Confirm API: `https://YOUR_HOST/api/health` returns `{"ok":true,...}`.
3. **Local** or **Beat lab**: upload a beat and run a flow (same host — no CORS setup).
4. **Cloud**: click **API keys**, add your **Mureka** key, then **Create**.

### 3. Same thing on Render

Use **`dieter-backend/Dockerfile`** from the **repository root** as context, health check **`/api/health`**. See `dieter-backend/DEPLOY_RENDER.md`.

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
- **Not** required: Cloudflare Pages + separate API URL — that split is only if you *choose* to host the UI elsewhere.

---

## Troubleshooting

- **Blank page**: check build logs; ensure `npm run build` inside Docker succeeded.
- **API errors**: confirm `/api/health` works; check Railway/Render logs for missing **ffmpeg** (included in Dockerfile) or Python errors.
- **Mureka / OpenAI**: set keys on the **server** (Railway variables), not only in the browser.
