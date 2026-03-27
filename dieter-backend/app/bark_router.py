"""
Optional Suno **Bark** text-to-audio (transformers ``suno/bark``).

- Enable with env ``DIETER_ENABLE_BARK=1`` (heavy: GPU strongly recommended, large model download on first run).
- ``♪`` around text is a common prompt hint for more melodic output; not guaranteed “studio singing.”
- For chart-grade vocals, keep using **Mureka** (``/api/mureka/*``) or **Teal Voices** (Coqui).
"""
from __future__ import annotations

import logging
import os
import threading
import uuid
from pathlib import Path
from typing import Any

import numpy as np
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from scipy.io import wavfile

logger = logging.getLogger(__name__)

_BACKEND_ROOT = Path(__file__).resolve().parent.parent
STORAGE_LOCAL = (_BACKEND_ROOT / "storage" / "local").resolve()
STORAGE_LOCAL.mkdir(parents=True, exist_ok=True)

router = APIRouter(prefix="/bark", tags=["bark"])

_MODEL_ID = os.environ.get("DIETER_BARK_MODEL", "suno/bark").strip() or "suno/bark"
_MAX_LYRICS_CHARS = int(os.environ.get("DIETER_BARK_MAX_CHARS", "500"))

_lock = threading.Lock()
_processor: Any = None
_model: Any = None
_load_error: str | None = None


def _env_enabled() -> bool:
    return os.environ.get("DIETER_ENABLE_BARK", "").strip().lower() in ("1", "true", "yes")


def _get_engine() -> tuple[Any, Any]:
    global _processor, _model, _load_error
    if not _env_enabled():
        raise HTTPException(
            status_code=503,
            detail="Bark is disabled. Set DIETER_ENABLE_BARK=1 on the server (see bark_router.py).",
        )
    with _lock:
        if _processor is not None and _model is not None:
            return _processor, _model
        if _load_error:
            raise HTTPException(status_code=503, detail=f"Bark failed to load: {_load_error}")
        try:
            import torch
            from transformers import AutoProcessor, BarkModel

            logger.info("Loading Bark model %s (first call may download several GB)…", _MODEL_ID)
            processor = AutoProcessor.from_pretrained(_MODEL_ID)
            model = BarkModel.from_pretrained(_MODEL_ID)
            device = "cuda" if torch.cuda.is_available() else "cpu"
            model = model.to(device)
            model.eval()
            _processor, _model = processor, model
            _load_error = None
            return processor, model
        except Exception as e:  # noqa: BLE001
            _load_error = str(e)
            logger.exception("Bark load failed")
            raise HTTPException(status_code=503, detail=f"Bark import/load failed: {_load_error}") from e


@router.get("/status")
def bark_status() -> dict[str, Any]:
    """Whether Bark is configured and (if already loaded) on which device."""
    enabled = _env_enabled()
    out: dict[str, Any] = {
        "enabled": enabled,
        "modelId": _MODEL_ID if enabled else None,
        "loaded": _processor is not None,
        "loadError": _load_error,
        "endpoint": "POST /api/bark/generate",
        "note": "Experimental local scratch vocoder — use Mureka for production singing.",
    }
    if enabled and _model is not None:
        try:
            import torch

            d = next(_model.parameters()).device
            out["device"] = str(d)
        except Exception:  # noqa: BLE001
            out["device"] = "unknown"
    return out


class BarkGenerateBody(BaseModel):
    lyrics: str = Field(..., min_length=1, max_length=8000)
    voice_preset: str = Field("v2/en_speaker_6", max_length=120)
    use_music_notes: bool = Field(
        True,
        description='Wrap text in ♪ … ♪ to nudge Bark toward melodic output.',
    )


@router.post("/generate")
def bark_generate(body: BarkGenerateBody) -> dict[str, Any]:
    """
    Render lyrics to a WAV under ``/api/storage/local/…`` (same static route as Teal Voices files).
    """
    text = body.lyrics.strip()
    if len(text) > _MAX_LYRICS_CHARS:
        text = text[:_MAX_LYRICS_CHARS]

    singing_prompt = f"♪ {text} ♪" if body.use_music_notes else text

    processor, model = _get_engine()
    try:
        import torch

        device = next(model.parameters()).device
        inputs = processor(singing_prompt, voice_preset=body.voice_preset.strip())
        if hasattr(inputs, "to"):
            inputs = inputs.to(device)
        else:
            inputs = {
                k: v.to(device) if hasattr(v, "to") else v for k, v in dict(inputs).items()
            }

        with torch.no_grad():
            audio_tensor = model.generate(**inputs)

        audio_np = audio_tensor.detach().cpu().float().numpy().squeeze()
        if audio_np.ndim > 1:
            audio_np = audio_np.flatten()

        audio_np = np.clip(audio_np, -1.0, 1.0)
        pcm = (audio_np * 32767.0).astype(np.int16)

        sr = getattr(model.generation_config, "sample_rate", None) or 24000

        out_id = uuid.uuid4().hex[:12]
        fname = f"bark_{out_id}_vocals.wav"
        dest = STORAGE_LOCAL / fname
        wavfile.write(str(dest), sr, pcm)

        return {
            "barkId": out_id,
            "engine": "bark",
            "voicePreset": body.voice_preset.strip(),
            "url": f"/api/storage/local/{fname}",
            "filename": fname,
            "sampleRate": sr,
            "note": "Local Bark render — not a substitute for Mureka/Coqui quality; trim lyrics if CUDA OOM.",
        }
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        logger.exception("Bark generate failed")
        raise HTTPException(status_code=500, detail=str(e)) from e

