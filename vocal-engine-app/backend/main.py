"""
FastAPI entry: lyrics → Bark → RVC + Pedalboard → downloadable WAV.
"""
from __future__ import annotations

import logging
import re

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from generator import generate_bark_wav
from processor import EXPORTS_DIR, transform_to_real_vocal

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def _cors_origins() -> list[str]:
    import os

    raw = os.environ.get("VOCAL_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
    return [o.strip() for o in raw.split(",") if o.strip()]


app = FastAPI(title="Vocal Engine", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class GenerateBody(BaseModel):
    lyrics: str = Field(min_length=1, max_length=4000)
    voice_preset: str = Field(default="v2/en_speaker_6", max_length=120)
    rvc_model: str = Field(..., min_length=1, max_length=120, description="Basename of .pth in models/rvc_voices/")
    f0_up_key: int = Field(default=0, ge=-12, le=12)
    use_music_notes: bool = True


_SAFE_FINAL = re.compile(r"^final_[0-9a-f]{32}\.wav$", re.IGNORECASE)


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/generate")
def generate(body: GenerateBody):
    try:
        raw = generate_bark_wav(
            body.lyrics,
            body.voice_preset,
            use_music_notes=body.use_music_notes,
        )
        final = transform_to_real_vocal(raw, body.rvc_model, f0_up_key=body.f0_up_key)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:  # noqa: BLE001
        logger.exception("generate failed")
        raise HTTPException(status_code=500, detail=str(e)) from e

    try:
        raw.unlink(missing_ok=True)
    except OSError:
        pass

    return {"download_url": f"/download/{final.name}", "filename": final.name}


@app.get("/download/{filename}")
def download(filename: str):
    if not _SAFE_FINAL.match(filename or ""):
        raise HTTPException(status_code=400, detail="invalid filename")
    path = (EXPORTS_DIR / filename).resolve()
    if not str(path).startswith(str(EXPORTS_DIR.resolve())) or not path.is_file():
        raise HTTPException(status_code=404, detail="not found")
    return FileResponse(path, media_type="audio/wav", filename=filename)
