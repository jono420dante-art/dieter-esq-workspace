# AI Beat Lab

**Upload track → auto BPM & beat detection → sync lyrics to vocals.**

- **100% local processing** — librosa on your server, **no external music APIs**.
- **Ready for your vocals tomorrow** — Tortoise / RVC / FFmpeg hooks are stubbed; drop in real engines when your GPU box is ready.

## Flow

1. User uploads audio (loop, full track, or stem).
2. Backend returns **BPM**, **beat times (seconds)**, and a **waveform** envelope (base64 float32 peaks).
3. React + **WaveSurfer.js** draws the wave with **beat markers**.
4. **Sync Vocals to Beat** calls the local stub (`/api/sync-vocals-stub`) until you wire real TTS/RVC.

## Endpoints (same FastAPI app as DIETER)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/analyze-beats` | multipart `file` |
| POST | `/api/sync-vocals-stub` | JSON `{ bpm, beats, lyrics }` |

Production serves the UI from **`/static`** (built `mureka-clone`) via Starlette `StaticFiles(html=True)`.
