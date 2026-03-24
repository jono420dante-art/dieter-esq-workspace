# Dieter Esq. workspace

## Deploy the full music studio (recommended)

Single **Docker** image: **React UI** + **FastAPI** on one URL.

1. Read **[`DIETER_ESQ_START.md`](./DIETER_ESQ_START.md)** — Railway / Render / local `docker compose`.
2. Repo root **`railway.toml`** points at **`dieter-backend/Dockerfile`** (build context = this repo root).

Main code:

- **`mureka-clone/`** — Vite + React app  
- **`dieter-backend/`** — FastAPI (`app/`), beat lab, pipelines  

## Other tools in this folder

- **Dieter Tower (Three.js)**: [`docs/dieter-tower-README.md`](./docs/dieter-tower-README.md)
