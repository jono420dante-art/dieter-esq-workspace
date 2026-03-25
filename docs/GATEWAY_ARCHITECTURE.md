# Gateway architecture — Dieter Esq. music studio

This document describes how the **React UI** (`mureka-clone/`), **FastAPI gateway** (`dieter-backend/`), and **external AI providers** fit together. It is the structural reference for **sync**, **portal-style routing**, and future **plugins / learning** hooks.

## Layers

| Layer | Role |
|--------|------|
| **Browser** | Orchestration UI, waveform playback, localStorage for optional user keys in dev. No in-tab “toy” synthesis for the main Create flow — audio comes from URLs returned by the API / Mureka. |
| **Gateway (FastAPI)** | Single origin when deployed as one Docker image: `/api/*` proxies and normalizes provider calls, retries, timeouts, and file paths for labs. |
| **Providers** | **Mureka** (song + vocal models), optional **OpenAI** (lyrics), ffmpeg/librosa/rubberband stacks for **Local / Beat lab** pipelines. |

## Fast REST / same-origin portal

- **Full stack:** UI and API share one host → relative `VITE_API_BASE=/api` avoids CORS and keeps cookies/origin simple.
- **Split deploy (e.g. Vercel + Railway):** set `VITE_API_BASE` to the public API URL; configure `DIETER_CORS_ORIGINS` on the backend so only your UI origin can call the gateway.

## Mureka path (AI music)

Typical client flow:

1. `POST /api/mureka/song/generate` (alias: `POST /api/generate`) with prompt + optional lyrics.
2. Poll `GET /api/mureka/song/query/{task_id}` until a clip URL is returned.
3. Client plays the URL (with appropriate `crossOrigin` where needed).

The gateway may add **retry/backoff** on transient HTTP errors (`MUREKA_HTTP_RETRIES`, `MUREKA_BACKOFF_SEC`, `MUREKA_HTTP_TIMEOUT`). Keys belong in **environment variables** on the server for production; the Connections UI is a dev-friendly override only.

## Optional tRPC

In development, the app can use tRPC (`/trpc`) for typed calls. Production builds default to **REST** unless `VITE_USE_TRPC=true`. Both paths should hit the same backend semantics.

## Integrations & plugins (extension points)

Treat new models as **gateway routes**, not UI forks:

- Add a FastAPI router under `dieter-backend/app/` with a stable `/api/<provider>/…` prefix.
- Return **task id + poll URL** or **final URL** in the same JSON shape as existing Mureka helpers where possible so the UI can share `parseFetchJson` and retry helpers.
- Document env vars (`<PROVIDER>_API_KEY`) in `DIETER_ESQ_START.md`; never commit keys.

“Plugin” in this repo means: **new module mounted in `main.py`**, optional **feature flag env**, and **one React surface** (tab or panel) that only calls the new route.

## Learning / foundation (music)

There is no single built-in training loop in the OSS stack. A practical foundation looks like:

- **Telemetry:** optional `postStudioGrowth` / analytics hooks in the UI for engagement (no PII in payloads).
- **User content:** stems and mixes stored under server-managed paths (`GET /api/studio/storage` pattern); users export for offline training elsewhere.
- **Future RAG / finetune:** gateway could accept uploads, fingerprint metadata, and call a separate **ML service** (GPU worker) — keep that worker behind internal networking, not in the browser.

## Related docs

- [`DIETER_ESQ_START.md`](../DIETER_ESQ_START.md) — run and deploy
- [`ICLOUD_AND_STORAGE.md`](./ICLOUD_AND_STORAGE.md) — where files actually live vs iCloud expectations
