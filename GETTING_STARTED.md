# Run DIETER + Mureka-style UI (local dev)

You need **Python 3.10+**, **Node.js 18+ (LTS)**, and **npm**.

## Production-style (one container)

From the **repository root**:

```bash
docker compose build && docker compose up
```

Open **http://localhost:8080** — React + **AI Beat Lab** and `/api/health` on the same origin. See `dieter-backend/DEPLOY_RENDER.md` for **Render.com**.

## MacBook (macOS) — dev stack

From the project root:

```bash
chmod +x serve-mac.sh mureka-clone/dev-stack.sh
./serve-mac.sh
```

This starts **FastAPI** (`:8787`), **tRPC** (`:8790`), and **Vite** (`:5173`) with the correct env. Open **http://127.0.0.1:5173**.

**Lighter stack (FastAPI + Vite only, no tRPC):** `chmod +x beatlab-pro-mac.sh && ./beatlab-pro-mac.sh` — Beat Lab / Beat Lab Pro and all `/api/*` routes; DistroKid prep is **`POST /api/pipeline/upload-distrokid-prep`**, not a browser page at `/upload-distrokid`.

- **Beat lab** or unified build: beat analysis uses **`/api/analyze-beats`** (same app as DIETER when you copy `dist` into `dieter-backend/static/`).
- **Local** tab: **librosa** + FFmpeg helpers (no cloud keys).
- **Cloud** tab: **Mureka** key in **API keys**, then **Create**.

- Optional: copy `dieter-backend/.env.example` → `dieter-backend/.env` and set `MUREKA_API_KEY` / `OPENAI_API_KEY` so the server can call providers without pasting secrets in the browser.

- **Stop:** `Ctrl+C` in the terminal (stops Vite and tears down API + tRPC).

## Windows — PowerShell

From the repo root:

```powershell
pwsh -File mureka-clone/dev-stack.ps1
```

(Separate windows open for API + tRPC; Vite runs in the current window.)

## Manual (three terminals)

Same on Mac or Windows: see `mureka-clone/README.md`.

## Static “deploy” HTML (no React)

```bash
npx --yes serve deploy -p 3000
```

Open the URL it prints. Set **API key & backend URL** in the UI to `http://127.0.0.1:8787` when FastAPI runs locally.

## Troubleshooting

| Issue | Fix |
|--------|-----|
| Port in use | Change `DIETER_API_PORT` / `DIETER_TRPC_PORT` or quit the other app |
| `curl` not found | Install Xcode CLI tools on Mac: `xcode-select --install` |
| tRPC errors | Ensure FastAPI is up first (`/api/health`) |
| Mureka 401 | Valid key at [platform.mureka.ai](https://platform.mureka.ai) |
