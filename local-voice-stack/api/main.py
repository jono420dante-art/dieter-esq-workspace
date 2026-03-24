"""
DIETER local audio API — no cloud keys.
- Beat detection: librosa (working)
- RVC / Tortoise: stubs with clear integration notes
"""
from __future__ import annotations

import os
import tempfile
from pathlib import Path
from typing import Any

import librosa
import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="DIETER Local Voice Stack", version="0.1.0")

# Allow local React (Vite) and file:// experiments
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "service": "dieter-local-audio",
        "beat_detection": "librosa",
        "rvc": "stub — run RVC WebUI separately",
        "tortoise": "stub — install tortoise in venv/container",
    }


@app.post("/api/beat/detect")
async def beat_detect(file: UploadFile = File(...)) -> dict[str, Any]:
    """
    Upload audio (wav/mp3/flac). Returns estimated tempo and beat times in seconds.
    """
    suffix = Path(file.filename or "audio").suffix.lower() or ".wav"
    if suffix not in {".wav", ".mp3", ".flac", ".ogg", ".m4a", ".aac"}:
        raise HTTPException(400, f"Unsupported extension {suffix}")

    data = await file.read()
    if len(data) < 256:
        raise HTTPException(400, "File too small")

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(data)
        tmp_path = tmp.name

    try:
        y, sr = librosa.load(tmp_path, sr=None, mono=True)
        tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
        # librosa may return scalar or array for tempo depending on version
        if hasattr(tempo, "item"):
            tempo_val = float(np.asarray(tempo).reshape(-1)[0])
        else:
            tempo_val = float(tempo)
        beat_times = librosa.frames_to_time(beat_frames, sr=sr)
        return {
            "ok": True,
            "filename": file.filename,
            "sample_rate": int(sr),
            "duration_sec": float(len(y) / sr),
            "tempo_bpm": round(tempo_val, 2),
            "beat_times_seconds": [float(t) for t in beat_times],
            "beat_frames": [int(f) for f in beat_frames],
        }
    except Exception as e:
        raise HTTPException(500, f"beat_detect failed: {e}") from e
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


@app.post("/api/vocal/tortoise")
def vocal_tortoise_stub() -> dict[str, Any]:
    """
    Wire this to Tortoise-TTS in your environment.
    Expected body (JSON) later: { "text": "...", "voice": "..." } -> returns path/WAV bytes.
    """
    return {
        "ok": False,
        "message": "Stub: install Tortoise-TTS and call it from this route.",
        "docs": "https://github.com/neonbjb/tortoise-tts",
    }


@app.post("/api/vocal/rvc")
def vocal_rvc_stub() -> dict[str, Any]:
    """
    Wire this to RVC WebUI / inference script.
    Expected: source WAV + model id -> converted WAV.
    """
    return {
        "ok": False,
        "message": "Stub: run RVC WebUI or batch inference; POST result here.",
        "repo": "https://github.com/RVC-Project/Retrieval-based-Voice-Conversion-WebUI",
    }


@app.post("/api/suggest/words")
def suggest_words_local(body: dict) -> dict[str, Any]:
    """Offline-friendly placeholder so the React UI does not 404."""
    mood = (body.get("mood") or "dark").strip()
    topic = (body.get("topic") or "music").strip()
    return {
        "prompts": [
            f"Write about {topic} in a {mood} tone.",
            f"Describe {topic} using only color and motion.",
        ],
        "keywords": [mood, topic, "neon", "midnight", "bass"],
        "starterLines": [
            f"The city hums in {mood} keys tonight,",
            f"Every echo names the word {topic},",
            "The beat pulls the skyline into line.",
        ],
    }


@app.post("/api/generate/music")
def generate_music_local(body: dict) -> dict[str, Any]:
    """Stub: replace with your local MusicGen / DAC / own renderer."""
    pid = body.get("projectId") or "local"
    return {
        "ok": True,
        "message": "Local stub: connect your generator (e.g. AudioCraft) here.",
        "trackUrl": "",
        "stems": {},
        "projectId": pid,
    }
