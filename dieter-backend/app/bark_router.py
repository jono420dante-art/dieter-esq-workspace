"""
Optional Suno **Bark** text-to-audio (transformers ``suno/bark``).

- Enable with env ``DIETER_ENABLE_BARK=1`` (heavy: GPU strongly recommended).
- **Dieter routes** (prefixed ``/api/bark``): ``GET /status``, ``POST /generate``
- **Tutorial-compatible routes** (mounted at app **root** when enabled):
  ``POST /generate-vocal-layer``, ``GET /download/{file_name}`` — same idea as a standalone
  ``main.py`` on port 8000, but integrated with this API and safe paths under ``storage/local/bark_exports/``.
"""
from __future__ import annotations

import logging
import os
import re
import threading
import uuid
from pathlib import Path
from typing import Any

import numpy as np
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from scipy.io import wavfile

logger = logging.getLogger(__name__)

_BACKEND_ROOT = Path(__file__).resolve().parent.parent
STORAGE_LOCAL = (_BACKEND_ROOT / "storage" / "local").resolve()
BARK_EXPORTS = (STORAGE_LOCAL / "bark_exports").resolve()
STORAGE_LOCAL.mkdir(parents=True, exist_ok=True)
BARK_EXPORTS.mkdir(parents=True, exist_ok=True)

router = APIRouter(prefix="/bark", tags=["bark"])
# Mounted without prefix from main.py — matches tutorial ``POST /generate-vocal-layer``.
compat_router = APIRouter(tags=["vocal-engine"])

_MODEL_ID = os.environ.get("DIETER_BARK_MODEL", "suno/bark").strip() or "suno/bark"
_MAX_LYRICS_CHARS = int(os.environ.get("DIETER_BARK_MAX_CHARS", "500"))
_SAFE_WAV = re.compile(r"^vocal_[a-f0-9]{32}\.wav$")


def _vocal_pedalboard_enabled() -> bool:
    return os.environ.get("DIETER_VOCAL_PEDALBOARD", "").strip().lower() in ("1", "true", "yes")


def _apply_vocal_chain_inplace(dest: Path) -> None:
    """If enabled and pedalboard is installed, replace ``dest`` with wet-processed audio."""
    if not _vocal_pedalboard_enabled():
        return
    try:
        from .vocal_processor import apply_studio_effects, pedalboard_available

        if not pedalboard_available():
            logger.warning("DIETER_VOCAL_PEDALBOARD is set but pedalboard is not installed")
            return
        tmp = dest.with_suffix(".pb_tmp.wav")
        apply_studio_effects(str(dest), str(tmp))
        dest.unlink(missing_ok=True)
        tmp.replace(dest)
    except Exception as e:  # noqa: BLE001
        logger.warning("Vocal pedalboard chain failed (keeping dry render): %s", e)

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


def _synthesize_wav(
    *,
    lyrics: str,
    voice_preset: str,
    use_music_notes: bool,
    dest_dir: Path,
    filename_prefix: str,
    exact_filename: str | None = None,
) -> tuple[Path, int, str]:
    text = lyrics.strip()
    if len(text) > _MAX_LYRICS_CHARS:
        text = text[:_MAX_LYRICS_CHARS]

    singing_prompt = f"♪ {text} ♪" if use_music_notes else text
    processor, model = _get_engine()

    import torch

    device = next(model.parameters()).device
    inputs = processor(singing_prompt, voice_preset=voice_preset.strip())
    if hasattr(inputs, "to"):
        inputs = inputs.to(device)
    else:
        inputs = {k: v.to(device) if hasattr(v, "to") else v for k, v in dict(inputs).items()}

    with torch.no_grad():
        audio_tensor = model.generate(**inputs)

    audio_np = audio_tensor.detach().cpu().float().numpy().squeeze()
    if audio_np.ndim > 1:
        audio_np = audio_np.flatten()

    audio_np = np.clip(audio_np, -1.0, 1.0)
    pcm = (audio_np * 32767.0).astype(np.int16)
    sr = int(getattr(model.generation_config, "sample_rate", None) or 24000)

    dest_dir.mkdir(parents=True, exist_ok=True)
    if exact_filename:
        fname = exact_filename
    else:
        out_id = uuid.uuid4().hex[:12]
        fname = f"{filename_prefix}_{out_id}_vocals.wav"
    dest = (dest_dir / fname).resolve()
    if not str(dest).startswith(str(dest_dir.resolve())):
        raise HTTPException(status_code=400, detail="invalid path")
    wavfile.write(str(dest), sr, pcm)
    _apply_vocal_chain_inplace(dest)
    return dest, sr, fname


@router.get("/status")
def bark_status() -> dict[str, Any]:
    enabled = _env_enabled()
    out: dict[str, Any] = {
        "enabled": enabled,
        "modelId": _MODEL_ID if enabled else None,
        "loaded": _processor is not None,
        "loadError": _load_error,
        "endpoints": {
            "dieter": "POST /api/bark/generate",
            "tutorial": "POST /generate-vocal-layer · GET /download/{file_name}",
        },
        "vocalPedalboard": _vocal_pedalboard_enabled(),
        "note": "Experimental Bark — use Mureka for production singing.",
    }
    if enabled and _model is not None:
        try:
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


class ViralLyricRequest(BaseModel):
    """Same shape as common tutorial snippets."""

    lyrics: str = Field(..., min_length=1, max_length=8000)
    voice_preset: str = Field("v2/en_speaker_6", max_length=120)


@router.post("/generate")
def bark_generate(body: BarkGenerateBody) -> dict[str, Any]:
    try:
        _, sr, fname = _synthesize_wav(
            lyrics=body.lyrics,
            voice_preset=body.voice_preset,
            use_music_notes=body.use_music_notes,
            dest_dir=STORAGE_LOCAL,
            filename_prefix="bark",
            exact_filename=None,
        )
        out_id = fname.removeprefix("bark_").removesuffix("_vocals.wav")
        return {
            "barkId": out_id,
            "engine": "bark",
            "voicePreset": body.voice_preset.strip(),
            "url": f"/api/storage/local/{fname}",
            "filename": fname,
            "sampleRate": sr,
            "note": "Local Bark render — use Mureka for chart vocals; trim lyrics if CUDA OOM.",
        }
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        logger.exception("Bark generate failed")
        raise HTTPException(status_code=500, detail=str(e)) from e


@compat_router.post("/generate-vocal-layer")
def generate_vocal_layer_compat(request: ViralLyricRequest) -> dict[str, Any]:
    """
    Drop-in style API: returns ``file_path`` (under repo ``storage/``) and ``url`` for ``GET /download/...``.
    """
    try:
        dest, _sr, fname = _synthesize_wav(
            lyrics=request.lyrics,
            voice_preset=request.voice_preset,
            use_music_notes=True,
            dest_dir=BARK_EXPORTS,
            filename_prefix="vocal",
            exact_filename=f"vocal_{uuid.uuid4().hex}.wav",
        )
        rel = dest.relative_to(_BACKEND_ROOT).as_posix()
        return {
            "status": "success",
            "file_path": rel,
            "url": f"/download/{fname}",
        }
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        logger.exception("Bark generate-vocal-layer failed")
        raise HTTPException(status_code=500, detail=str(e)) from e


@compat_router.get("/download/{file_name}")
def download_vocal_compat(file_name: str):
    base = file_name.strip()
    if not _SAFE_WAV.match(base):
        raise HTTPException(status_code=400, detail="Invalid file name")
    path = (BARK_EXPORTS / base).resolve()
    if not str(path).startswith(str(BARK_EXPORTS.resolve())) or not path.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(str(path), media_type="audio/wav", filename=base)
