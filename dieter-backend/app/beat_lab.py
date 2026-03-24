"""AI Beat Lab: analyze-beats + sync-vocals stub — 100% local (librosa), no external APIs."""

from __future__ import annotations

import io
import sys
import tempfile
from pathlib import Path
from typing import Any

import librosa
from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel, Field

_BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from beat_analysis import analyze, waveform_peaks_base64
from scripts.vocal_pipeline_stub import full_pipeline_stub

router = APIRouter(tags=["beat-lab"])

MAX_UPLOAD_BYTES = 80 * 1024 * 1024


@router.post("/analyze-beats")
async def analyze_beats(file: UploadFile = File(...)) -> dict[str, Any]:
    raw = await file.read()
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max ~80MB)")
    if len(raw) < 256:
        raise HTTPException(status_code=400, detail="Audio too short or empty")
    try:
        y, sr = librosa.load(io.BytesIO(raw), sr=None, mono=True)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not decode audio: {e}") from e
    if len(y) < sr * 0.05:
        raise HTTPException(status_code=400, detail="Audio shorter than ~50ms")
    r = analyze(y, sr, max_beats_report=None)
    wf_b64 = waveform_peaks_base64(y, sr, n_points=2048)
    beats = r["beats_all"]
    if len(beats) > 20000:
        beats = beats[:20000]
    return {
        "bpm": r["tempo_bpm"],
        "beats": beats,
        "duration": r["duration_s"],
        "sample_rate": r["sr"],
        "waveform": wf_b64,
    }


class SyncVocalsBody(BaseModel):
    bpm: float = Field(..., ge=20, le=400)
    beats: list[float] = Field(default_factory=list)
    lyrics: str = ""


@router.post("/sync-vocals-stub")
def sync_vocals_stub(body: SyncVocalsBody) -> dict[str, Any]:
    tmp = Path(tempfile.mkdtemp(prefix="dieter_vocal_"))
    stub = full_pipeline_stub(body.lyrics or "[stub]", tmp / "beat_placeholder.wav", tmp)
    return {
        "status": "stub",
        "message": "Vocal pipeline local-only — wire Tortoise/RVC when ready.",
        "bpm": body.bpm,
        "beat_count": len(body.beats),
        "pipeline": stub,
    }
