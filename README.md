# Dieter Esq. workspace

**GitHub:** [github.com/jono420dante-art/dieter-esq-workspace](https://github.com/jono420dante-art/dieter-esq-workspace) — clone or open this folder; that repo **is** the full product (React + FastAPI + Docker).

**Cursor / VS Code:** **File → Open Workspace from File…** → choose [`dieter-esq-workspace.code-workspace`](./dieter-esq-workspace.code-workspace) so the whole tree (UI, API, deploy config) is one connected project.

## Deploy the full music studio (recommended)

Single **Docker** image: **React UI** + **FastAPI** on one URL.

1. Read **[`DIETER_ESQ_START.md`](./DIETER_ESQ_START.md)** — Railway / Render / **Vercel** / local `docker compose`.
2. Repo root **`railway.toml`** points at **`dieter-backend/Dockerfile`** (build context = this repo root).
3. **Vercel / Netlify (free):** root **`vercel.json`** or **`netlify.toml`**. The main UI build copies **`mureka-clone/dist` → `./public`** so Vercel’s default **Output Directory** (`public`) matches the build. Custom domain (**`dieter-music.app`**), **Stripe `pk_live_…`** build injection, fork + deploy: **[`docs/DIETER_MUSIC_APP.md`](./docs/DIETER_MUSIC_APP.md)**. Set **`VITE_API_BASE`** to your live API. **After each push:** CI build + channel checklist — **[`docs/DEPLOY_CHANNELS_PERFORMANCE.md`](./docs/DEPLOY_CHANNELS_PERFORMANCE.md)** (Portal `/#portal`, static health, CORS). **Production UI:** [https://dieter-esq-workspace.vercel.app](https://dieter-esq-workspace.vercel.app) (add your domain in the hosting UI). **Redeploy:** `npm run deploy:vercel` from repo root, or push to GitHub.

Main code:

- **`mureka-clone/`** — Vite + React app  
- **`dieter-backend/`** — FastAPI (`app/`), beat lab, pipelines  
- **`DIETER-PRO/`** — Express + Vite “pro” studio; **Video Suite** proxies cover+audio MP4 to the same FastAPI as mureka (`POST /api/local/music-video` via **`DIETER_FASTAPI_URL`**). Build: `npm run dieter-pro:build` from repo root. Deploy: [`DIETER-PRO/render.yaml`](./DIETER-PRO/render.yaml).  
- **`vocal-engine-app/`** — Bark / vocal pipeline API + Vocal Box UI ([`vocal-engine-app/DEPLOY.md`](./vocal-engine-app/DEPLOY.md))  
- **Architecture:** [`docs/GATEWAY_ARCHITECTURE.md`](./docs/GATEWAY_ARCHITECTURE.md) — gateway, sync/portal routing, plugin extension points  
- **Vocals / training hooks:** [`docs/VOCAL_ENGINE_AND_TRAINING.md`](./docs/VOCAL_ENGINE_AND_TRAINING.md) — Mureka + DSP, `POST /api/vocal/analyze` for dataset labels  
- **App map & perf:** [`docs/APP_UNDERSTANDING.md`](./docs/APP_UNDERSTANDING.md) — tabs, gateway, OpenAI + Claude lyrics, Vite production build  
- **WAM ecosystem:** [`docs/WAM_ECOSYSTEM.md`](./docs/WAM_ECOSYSTEM.md) — community plugins, pedalboard, Open Studio DAW, Sequencer Party  
- **Web audio stack (synths, Faust/LV2 caveats, snippets):** [`docs/DIETER_WEB_AUDIO_STACK.md`](./docs/DIETER_WEB_AUDIO_STACK.md)  

## Other tools in this folder

- **Dieter Pro (Node + React)**: [`DIETER-PRO/`](./DIETER-PRO/) — run `npm run dev` inside that folder; set **`DIETER_FASTAPI_URL`** to your `dieter-backend` origin so `/api/dieter/*` proxies match mureka-clone behaviour.  
- **One-shot builds (CI / sanity):** `npm run workspace:build` — main studio static + DIETER-PRO `dist`.  
- **Dieter Tower (Three.js)**: [`docs/dieter-tower-README.md`](./docs/dieter-tower-README.md)
