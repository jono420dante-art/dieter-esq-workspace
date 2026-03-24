# DIETER Local Studio (self-contained, no cloud APIs)

Offline pipeline pieces:

| Component | Role |
|-----------|------|
| **Librosa** | BPM + beat times + onsets from uploaded beats |
| **FFmpeg** | Mix beat stem + vocal stem (`/api/local/mix/ffmpeg`) |
| **RVC WebUI** | Voice conversion / singing — [RVC-Project/Retrieval-based-Voice-Conversion-WebUI](https://github.com/RVC-Project/Retrieval-based-Voice-Conversion-WebUI) |
| **Tortoise-TTS** | Text-to-speech / melody scaffolding — pair with RVC for “singing” |
| **Madmom** | Optional extra beat/downbeat models (`pip install madmom` if build works) |

**Ethics:** Train only on **10–30 minutes** of **consented** voice clips. Never use third-party voices without license.

## Quick start (CPU)

```bash
cd dieter-local-studio
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8890
```

Health: `GET http://127.0.0.1:8890/api/local/health`

## Docker

```bash
docker compose up --build
```

GPU RVC (host): run the official RVC Docker or `docker run --gpus all ...` per RVC docs; set `RVC_WEBUI_DIR` to your checkout.

## API sketch

1. `POST /api/local/upload` — multipart audio (beat)
2. `POST /api/local/beats/analyze` — `{ "file_id": "xxx.wav" }` → BPM + `beat_times_sec`
3. `POST /api/local/vocal/job` — lyrics + `file_id` → job stub until RVC/Tortoise wired
4. `POST /api/local/mix/ffmpeg` — beat + vocal file IDs → mixed MP3 in `data/out/`

## React UI

`mureka-clone` defaults to **Local** tab: upload beat → Librosa BPM/beats → lyric sync grid → vocal job stub → (future) stems.

Set `VITE_LOCAL_STUDIO=http://127.0.0.1:8890` in `.env` (see `.env.example`).

## RVC WebUI (separate clone)

```bash
git clone https://github.com/RVC-Project/Retrieval-based-Voice-Conversion-WebUI
cd Retrieval-based-Voice-Conversion-WebUI
# Follow their README for GPU / conda / weights.
# Then export RVC_WEBUI_DIR=/path/to/that/repo
```

Optional GPU Docker (example only — use RVC project’s current image/docs):

```bash
# docker run --gpus all -it ...  # see RVC WebUI docs
```

## Tortoise-TTS

Clone [tortoise-tts](https://github.com/neonbjb/tortoise-tts) separately; set `TORTOISE_DIR` for future wiring in `vocal_jobs.py`.

## Test loop

1. `.\run-local-studio.ps1` (Windows) or `uvicorn app.main:app --port 8890`
2. `cd mureka-clone && npm run dev`
3. **Local** tab → upload beat → see BPM → **Build grid** → **Queue vocal job** (status until RVC/Tortoise connected)
