# Local audio: beat detection + vocal pipeline stubs

**No cloud APIs.** Python backend pieces you can call from a React app via FastAPI/Flask later.

## 1) Setup

```bash
cd local-audio
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt
```

Install **FFmpeg** on your OS and ensure `ffmpeg` is on `PATH` (needed for many formats, especially MP3).

## 2) Run beat detection first (sanity check)

```bash
python beat_detect.py path/to/your_beat.wav
```

With full beat list as JSON:

```bash
python beat_detect.py path/to/your_beat.mp3 --json
```

## 3) Vocal pipeline stub

```bash
python vocal_pipeline_stub.py
```

Replace placeholder functions with:

- **Tortoise-TTS** (or lighter local TTS) for lyrics → WAV  
- **RVC** ([RVC-Project WebUI](https://github.com/RVC-Project/Retrieval-based-Voice-Conversion-WebUI)) for voice conversion  
- **librosa** beat times for alignment  
- **ffmpeg-python** for mixdown / stems  

## React frontend

Point your UI at a small local API (e.g. FastAPI) that wraps `detect_beats()` and future vocal endpoints — same origin or `localhost` during dev.
