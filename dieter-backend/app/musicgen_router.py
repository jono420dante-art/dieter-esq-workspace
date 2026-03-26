"""REST routes for optional Audiocraft MusicGen (``/api/musicgen/*``)."""
from __future__ import annotations

import asyncio
import os
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from .musicgen_engine import (
    get_musicgen_engine,
    get_musicgen_load_error,
    is_musicgen_loaded,
    musicgen_enabled,
)

_BACKEND_ROOT = Path(__file__).resolve().parent.parent
STORAGE_DIR = _BACKEND_ROOT / "storage"

router = APIRouter(prefix="/musicgen", tags=["musicgen"])


class SongRequest(BaseModel):
    lyrics: str = Field(..., min_length=1)
    style: str = Field("pop", max_length=120)
    duration: int = Field(120, ge=5, le=600)


def _absolute_url(path: str) -> str:
    origin = os.environ.get("DIETER_PUBLIC_API_ORIGIN", "").strip().rstrip("/")
    if origin:
        return f"{origin}{path}"
    return path


@router.get("/status")
def musicgen_status() -> dict[str, Any]:
    """Does not load weights — safe to poll."""
    return {
        "enabled": musicgen_enabled(),
        "loaded": is_musicgen_loaded(),
        "error": get_musicgen_load_error(),
    }


@router.post("/generate")
async def generate_song(req: SongRequest) -> dict[str, Any]:
    if not musicgen_enabled():
        raise HTTPException(
            status_code=503,
            detail="MusicGen is disabled. Set DIETER_ENABLE_MUSICGEN=1 and install audiocraft.",
        )
    eng = get_musicgen_engine()
    if eng is None:
        raise HTTPException(
            status_code=503,
            detail=get_musicgen_load_error() or "MusicGen failed to load",
        )
    try:
        job_id, wav_rel = await asyncio.to_thread(
            eng.lyrics_to_song,
            req.lyrics,
            req.style,
            req.duration,
            storage_dir=STORAGE_DIR,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    wav_abs = _absolute_url(wav_rel)
    return {
        "status": "succeeded",
        "jobId": job_id,
        "wavUrl": wav_rel,
        "wavUrlAbsolute": wav_abs,
        "mix": {"wavUrl": wav_rel},
        "stems": [
            {
                "type": "mix",
                "wavUrl": wav_rel,
            }
        ],
    }
