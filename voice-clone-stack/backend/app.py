from __future__ import annotations

import os
import shutil
import tempfile
import uuid
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import soundfile as sf
import numpy as np


APP_DIR = Path(__file__).resolve().parent
MODELS_DIR = APP_DIR / "models"
VOICES_DIR = APP_DIR / "voices"
OUT_DIR = APP_DIR / "generated"

MODELS_DIR.mkdir(parents=True, exist_ok=True)
VOICES_DIR.mkdir(parents=True, exist_ok=True)
OUT_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Voice Clone Stack API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _safe_name(name: str) -> str:
    return "".join(ch for ch in name if ch.isalnum() or ch in ("-", "_")).strip("-_") or "voice"


def _coqui_available() -> bool:
    try:
        from importlib.util import find_spec

        return find_spec("TTS") is not None and find_spec("torch") is not None
    except Exception:
        return False


@app.get("/health")
def health() -> dict:
    return {
        "ok": True,
        "coqui_available": _coqui_available(),
        "voices_dir": str(VOICES_DIR),
        "models_dir": str(MODELS_DIR),
    }


@app.post("/api/voices/register")
async def register_voice(
    voice_name: str = Form(...),
    reference_audio: UploadFile = File(...),
) -> dict:
    ext = Path(reference_audio.filename or "ref.wav").suffix.lower() or ".wav"
    if ext not in {".wav", ".mp3", ".flac", ".ogg", ".m4a"}:
        raise HTTPException(status_code=400, detail="Use wav/mp3/flac/ogg/m4a reference audio")

    voice_id = _safe_name(voice_name)
    target = VOICES_DIR / f"{voice_id}{ext}"
    data = await reference_audio.read()
    if len(data) < 64:
        raise HTTPException(status_code=400, detail="Reference audio is empty")
    target.write_bytes(data)

    return {"ok": True, "voiceId": voice_id, "path": str(target)}


@app.get("/api/voices")
def list_voices() -> dict:
    items = []
    for p in sorted(VOICES_DIR.glob("*")):
        if p.is_file():
            items.append({"voiceId": p.stem, "file": p.name})
    return {"ok": True, "voices": items}


@app.post("/api/synthesize")
async def synthesize(
    text: str = Form(...),
    voice_id: str = Form(...),
    language: str = Form("en"),
) -> dict:
    text = text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Missing text")

    voice_id = _safe_name(voice_id)
    refs = list(VOICES_DIR.glob(f"{voice_id}.*"))
    if not refs:
        raise HTTPException(status_code=404, detail=f"voice '{voice_id}' not found")
    ref = refs[0]

    out_id = f"{voice_id}_{uuid.uuid4().hex[:10]}"
    out_path = OUT_DIR / f"{out_id}.wav"

    if _coqui_available():
        try:
            from TTS.api import TTS

            model_name = os.getenv("COQUI_MODEL", "tts_models/multilingual/multi-dataset/xtts_v2")
            tts = TTS(model_name=model_name)
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                tmp_path = Path(tmp.name)
            try:
                tts.tts_to_file(
                    text=text,
                    speaker_wav=str(ref),
                    language=language,
                    file_path=str(tmp_path),
                )
                shutil.move(str(tmp_path), str(out_path))
            finally:
                tmp_path.unlink(missing_ok=True)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Coqui TTS synth failed: {e}") from e
    else:
        # Fallback for environments without TTS deps: create short tone so route still works.
        sr = 22050
        dur = max(1.0, min(20.0, len(text) / 16.0))
        n = int(sr * dur)
        t = np.arange(n, dtype=np.float32) / sr
        freq = 130.0 if "male" in voice_id.lower() else 220.0
        y = 0.12 * np.sin(2 * np.pi * freq * t)
        sf.write(str(out_path), y, sr, subtype="PCM_16")

    return {"ok": True, "voiceId": voice_id, "audioUrl": f"/api/audio/{out_path.name}", "file": out_path.name}


@app.get("/api/audio/{filename}")
def get_audio(filename: str):
    path = OUT_DIR / filename
    if not path.is_file():
        raise HTTPException(status_code=404, detail="audio not found")
    return FileResponse(str(path), media_type="audio/wav", filename=filename)
