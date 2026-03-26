# Gateway architecture — Dieter Esq. music studio

This document describes how the **React UI** (`mureka-clone/`), **FastAPI gateway** (`dieter-backend/`), and **external AI providers** fit together. It is the structural reference for **sync**, **portal-style routing**, and future **plugins / learning** hooks.

## Layers

| Layer | Role |
|--------|------|
| **Browser** | Orchestration UI, waveform playback, localStorage for optional user keys in dev. No in-tab “toy” synthesis for the main Create flow — audio comes from URLs returned by the API / Mureka. |
| **Gateway (FastAPI)** | Single origin when deployed as one Docker image: `/api/*` proxies and normalizes provider calls, retries, timeouts, and file paths for labs. |
| **Providers** | **Mureka** (song + vocal models), optional **OpenAI** (lyrics), ffmpeg/librosa/rubberband stacks for **Local / Beat lab** pipelines. |

## Vocal analysis (training / QC)

`POST /api/vocal/analyze` (multipart audio upload) returns **Librosa-derived** spectral, MFCC, RMS, and F0 summaries. That is **objective signal math** — not generative AI — but it is the right glue for **labeling datasets** and comparing takes before you train or serve a custom vocal model. Cap: `DIETER_VOCAL_ANALYZE_MAX_MB` (default 32). Details: [`VOCAL_ENGINE_AND_TRAINING.md`](./VOCAL_ENGINE_AND_TRAINING.md).

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

There is no GPU training loop bundled in Docker. A practical foundation:

- **Telemetry:** optional `postStudioGrowth` / analytics hooks in the UI for engagement (no PII in payloads).
- **User content:** stems and mixes under server paths (`GET /api/studio/storage`); pair files with `/api/vocal/analyze` JSON for offline training jobs.
- **Generative “best engine” for listeners:** route production traffic through **Mureka** (and future providers) on the gateway — rank and A/B in your own analytics, not in-browser toy synths.
- **Custom models:** train externally; expose inference via a new `/api/...` route mounted like Mureka.

## Related docs

- [`DIETER_ESQ_START.md`](../DIETER_ESQ_START.md) — run and deploy
- [`VOCAL_ENGINE_AND_TRAINING.md`](./VOCAL_ENGINE_AND_TRAINING.md) — real tone path, Mureka + DSP, dataset labeling
- [`ICLOUD_AND_STORAGE.md`](./ICLOUD_AND_STORAGE.md) — where files actually live vs iCloud expectations
