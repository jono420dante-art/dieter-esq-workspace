"""
Optional Suno **Bark** text-to-audio (transformers ``suno/bark``).

Pipeline (when options are on): **Bark → optional RVC (``rvc-python`` + ``models/*.pth``) → optional Pedalboard**.

- Enable Bark: ``DIETER_ENABLE_BARK=1`` (heavy; GPU/MPS recommended).
- **Dieter routes** (``/api/bark``): ``GET /status``, ``POST /generate``
- **Tutorial routes** (app root when Bark on): ``POST /generate-vocal-layer``, ``GET /download/{file_name}``
  — audio under ``storage/local/bark_exports/``.
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

from . import rvc_layer

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
MODELS_ROOT = (_BACKEND_ROOT / "models").resolve()
MODELS_ROOT.mkdir(parents=True, exist_ok=True)


def _rvc_enabled() -> bool:
    return os.environ.get("DIETER_ENABLE_RVC", "").strip().lower() in ("1", "true", "yes")


def _resolve_rvc_model_path(basename_or_relative: str | None) -> Path | None:
    """Return a ``.pth`` under ``models/``, or ``None`` to skip RVC."""
    if not _rvc_enabled():
        return None
    env_default = os.environ.get("DIETER_RVC_MODEL_PATH", "").strip()
    raw = (basename_or_relative or env_default).strip()
    if not raw:
        return None
    p = Path(raw)
    if p.is_absolute():
        p = p.resolve()
    else:
        p = (MODELS_ROOT / raw).resolve()
    if not str(p).startswith(str(MODELS_ROOT.resolve())):
        raise HTTPException(
            status_code=400,
            detail="RVC model path must be inside the server's models/ directory.",
        )
    if p.suffix.lower() != ".pth":
        raise HTTPException(status_code=400, detail="RVC model must be a .pth file.")
    if not p.is_file():
        raise HTTPException(status_code=404, detail=f"RVC model not found: {p.name}")
    return p


def _apply_rvc_inplace(dest: Path, rvc_model: str | None, f0_up_key: int) -> None:
    """Bark dry vocal → RVC (optional). Runs before Pedalboard polish."""
    try:
        path = _resolve_rvc_model_path(rvc_model)
    except HTTPException:
        raise
    if path is None:
        return
    try:
        from .rvc_layer import apply_rvc_file, rvc_package_available

        if not rvc_package_available():
            logger.warning("DIETER_ENABLE_RVC is set but rvc-python is not installed")
            return
        tmp = dest.with_suffix(".rvc_tmp.wav")
        apply_rvc_file(str(dest), str(path), str(tmp), f0_up_key=f0_up_key)
        dest.unlink(missing_ok=True)
        tmp.replace(dest)
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        logger.warning("RVC conversion failed (keeping Bark vocal): %s", e)


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
    rvc_model: str | None = None,
    f0_up_key: int = 0,
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
    _apply_rvc_inplace(dest, rvc_model, f0_up_key)
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
        "rvc": {
            "enabled": _rvc_enabled(),
            "packageInstalled": rvc_layer.rvc_package_available(),
            "modelsDir": "models/",
            "defaultModelEnv": (os.environ.get("DIETER_RVC_MODEL_PATH") or "").strip() or None,
            "deviceEnv": (os.environ.get("DIETER_RVC_DEVICE") or "").strip() or "auto",
        },
        "pipeline": "Bark → optional RVC → optional Pedalboard",
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
    rvc_model: str | None = Field(
        None,
        max_length=260,
        description="RVC .pth under models/ (basename or subpath). Overrides DIETER_RVC_MODEL_PATH when set.",
    )
    f0_up_key: int = Field(0, ge=-24, le=24, description="RVC pitch shift in semitones.")


class ViralLyricRequest(BaseModel):
    """Same shape as common tutorial snippets."""

    lyrics: str = Field(..., min_length=1, max_length=8000)
    voice_preset: str = Field("v2/en_speaker_6", max_length=120)
    rvc_model: str | None = Field(None, max_length=260)
    f0_up_key: int = Field(0, ge=-24, le=24)


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
            rvc_model=body.rvc_model,
            f0_up_key=body.f0_up_key,
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
            rvc_model=request.rvc_model,
            f0_up_key=request.f0_up_key,
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
