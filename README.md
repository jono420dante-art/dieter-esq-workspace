# Dieter Esq. workspace

**GitHub:** [github.com/jono420dante-art/dieter-esq-workspace](https://github.com/jono420dante-art/dieter-esq-workspace) — clone or open this folder; that repo **is** the full product (React + FastAPI + Docker).

**Cursor / VS Code:** **File → Open Workspace from File…** → choose [`dieter-esq-workspace.code-workspace`](./dieter-esq-workspace.code-workspace) so the whole tree (UI, API, deploy config) is one connected project.

## Deploy the full music studio (recommended)

Single **Docker** image: **React UI** + **FastAPI** on one URL.

1. Read **[`DIETER_ESQ_START.md`](./DIETER_ESQ_START.md)** — Railway / Render / **Vercel** / local `docker compose`.
2. Repo root **`railway.toml`** points at **`dieter-backend/Dockerfile`** (build context = this repo root).
3. **Vercel / Netlify (free):** root **`vercel.json`** or **`netlify.toml`**. Custom domain (**`dieter-music.app`**), **Stripe `pk_live_…`** build injection, fork + deploy: **[`docs/DIETER_MUSIC_APP.md`](./docs/DIETER_MUSIC_APP.md)**. Set **`VITE_API_BASE`** to your live API. **Production UI:** [https://dieter-esq-workspace.vercel.app](https://dieter-esq-workspace.vercel.app) (add your domain in the hosting UI). **Redeploy:** `npm run deploy:vercel` from repo root, or push to GitHub.

Main code:

- **`mureka-clone/`** — Vite + React app  
- **`dieter-backend/`** — FastAPI (`app/`), beat lab, pipelines  
- **Architecture:** [`docs/GATEWAY_ARCHITECTURE.md`](./docs/GATEWAY_ARCHITECTURE.md) — gateway, sync/portal routing, plugin extension points  
- **WAM ecosystem:** [`docs/WAM_ECOSYSTEM.md`](./docs/WAM_ECOSYSTEM.md) — community plugins, pedalboard, Open Studio DAW, Sequencer Party  

## Other tools in this folder

- **Dieter Tower (Three.js)**: [`docs/dieter-tower-README.md`](./docs/dieter-tower-README.md)
