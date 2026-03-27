# Vocal engine, real tone, and training path

This stack treats **“real tone”** for **lead vocals** as **Mureka (or future gateway-mounted voice models)**—trained models that sing your lyrics. Server **procedural** stems and browser buffers are **draft / layout tools only**, not substitutes for that vocal AI.

## What ships today (production-quality path)

1. **Mureka (cloud)** — Full mixes and AI vocals. The React **Create** and **Cloud** tabs call your FastAPI gateway, which proxies Mureka with retries and stable task polling (`/api/mureka/*`). This is the primary **music generation engine** for end users.
2. **FastAPI mix / master pipelines** — Beat + vocal stems, pitch engines (Rubberband / Librosa), and mastering run **on the server** where FFmpeg and libs are available.
3. **Objective vocal analysis (new)** — `POST /api/vocal/analyze` accepts an uploaded clip and returns Librosa-derived **spectral, MFCC, RMS, and F0** statistics. That JSON is suitable for:

   - Building **training datasets** (pair features with genre, artist, mic chain, language, etc.).
   - **Quality control** (compare takes before/after processing).
   - Future **conditioning vectors** for your own models (you consume these vectors in a separate training/service repo).

Payload size is capped (default **32 MiB** via `DIETER_VOCAL_ANALYZE_MAX_MB`).

## How vocal “formulation” fits (learning foundation)

Modern vocal synthesis is learned from **large paired data**: text ↔ audio, or audio ↔ timbre embeddings. This repository does **not** train a foundation model inside Docker by default (that needs GPU farms and curated datasets). Instead:

| Layer | Responsibility |
|--------|----------------|
| **This repo** | Gateway, routing, retries, storage paths, Librosa features, FFmpeg chains, Mureka integration. |
| **Your training job** | Export clips + `/api/vocal/analyze` JSON + labels → train RVC / diffusion TTS / proprietary checkpoints offline. |
| **Deployment** | Serve the new model behind a **new** FastAPI route (e.g. `/api/voice/custom-render`) and point the UI to it — same pattern as Mureka proxy. |

## Practical workflow

1. Collect dry vocal WAVs (or stems) and run them through `POST /api/vocal/analyze`.
2. Store one JSON line per file (`features` + your metadata).
3. Train or finetune your vocal model in a notebook or GPU pipeline **outside** this repo.
4. Expose inference via HTTP from your ML service; add a thin adapter in `dieter-backend/app/main.py` so the React app stays a single portal.

## Related

- [`GATEWAY_ARCHITECTURE.md`](./GATEWAY_ARCHITECTURE.md) — overall sync/portal layout  
- [`DIETER_ESQ_START.md`](../DIETER_ESQ_START.md) — run and deploy the API  

**Security:** Never commit API keys; use env vars and the Connections panel only for local dev.
