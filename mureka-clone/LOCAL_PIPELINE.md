# Local audio pipeline (no cloud APIs)

Self-contained path: **upload beat → librosa (+ optional madmom) BPM/onsets → vocal layer → FFmpeg mix → download**.

**Free vocal one-shots / phrases (external):** see [`FREE_VOCAL_SAMPLE_SOURCES.md`](FREE_VOCAL_SAMPLE_SOURCES.md) and [`docs/free-vocal-samples.html`](docs/free-vocal-samples.html) (open in a browser).

## What runs in this repo

| Piece | Role |
|--------|------|
| **FastAPI** | `/api/local/beat-detect`, `/api/local/procedural-vocal-layer`, `/api/local/tempo-align`, `/api/local/merge` |
| **librosa** | Tempo + beat frames + onset times |
| **madmom** (optional) | Uncomment in `requirements.txt`, reinstall — extra `madmom` block in beat JSON |
| **FFmpeg** | Mix beat + vocal; tempo alignment (`atempo` chain) |
| **Procedural engine** | Placeholder vocal stem (WAV) until RVC/Tortoise is wired |

## RVC (GPU workstation / ProDesk)

1. Clone [RVC-WebUI](https://github.com/RVC-Project/Retrieval-based-Voice-Conversion-WebUI).
2. Train on **10–30 minutes** of clean, **consented** voice audio.
3. Run the WebUI or a headless infer script; expose a small HTTP shim if you want the DIETER API to forward jobs (set `RVC_BASE_URL` when ready).

Example Docker direction (you must supply or build an image — upstream changes often):

```bash
docker run --gpus all -it -p 7865:7865 <your-rvc-image>
```

Template: `docker-compose.local.yml` (fill in `rvc` / `tortoise` services).

## Tortoise-TTS

Clone [tortoise-tts](https://github.com/neonbjb/tortoise-tts). Typical flow: **Tortoise (speech) → RVC (singing timbre)** or your own pitch pipeline.

## Beat sync

- **Detect**: `POST /api/local/beat-detect` (multipart `file`).
- **Align**: if your vocal render used a different BPM than the beat, `POST /api/local/tempo-align` with `audioKey`, `fromBpm`, `toBpm`.
- **Merge**: upload beat + vocal with `POST /api/upload`, then `POST /api/local/merge` with `{ beatKey, vocalKey }`.

## Frontend

`mureka-clone` → mode **Local (Librosa · RVC-ready)** uses the same `/api` proxy (Vite → FastAPI `8787`).

## Ethics

Only train voice models on audio you have **rights and consent** to use.
