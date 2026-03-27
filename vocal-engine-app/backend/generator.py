"""
Bark-based singing stem: lyrics → dry ``.wav`` in ``cache/``.

Uses ♪ music tags for singing mode. On macOS, prefers **MPS** before CUDA when ``BARK_DEVICE`` is unset.
"""
from __future__ import annotations

import logging
import os
import platform
import uuid
from pathlib import Path

import numpy as np
import torch
from scipy.io import wavfile
from transformers import AutoProcessor, BarkModel

logger = logging.getLogger(__name__)

BACKEND_ROOT = Path(__file__).resolve().parent
CACHE_DIR = BACKEND_ROOT / "cache"
BARK_MODEL_ID = (os.environ.get("BARK_MODEL_ID") or "suno/bark").strip()
_MAX_CHARS = int(os.environ.get("BARK_MAX_LYRIC_CHARS", "2000"))

_processor: AutoProcessor | None = None
_model: BarkModel | None = None


def _bark_device() -> str:
    override = (os.environ.get("BARK_DEVICE") or os.environ.get("TORCH_BARK_DEVICE") or "").strip()
    if override:
        return override
    # Apple Silicon: default to MPS before CUDA (CUDA is absent on Mac).
    if platform.system() == "Darwin":
        if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
            return "mps"
        return "cpu"
    if torch.cuda.is_available():
        return "cuda"
    if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def _get_bark() -> tuple[AutoProcessor, BarkModel]:
    global _processor, _model
    if _processor is not None and _model is not None:
        return _processor, _model
    logger.info("Loading Bark %s on %s…", BARK_MODEL_ID, _bark_device())
    _processor = AutoProcessor.from_pretrained(BARK_MODEL_ID)
    _model = BarkModel.from_pretrained(BARK_MODEL_ID)
    _model = _model.to(_bark_device())
    _model.eval()
    return _processor, _model


def synthesize_bark_audio(
    lyrics: str,
    voice_preset: str,
    *,
    use_music_notes: bool = True,
) -> tuple[np.ndarray, int]:
    """
    Run Bark inference; return mono float32 audio in [-1, 1] and sample rate.
    Falls back to ``v2/en_speaker_6`` if a Dutch/Nl preset is rejected by the processor.
    """
    text = lyrics.strip()
    if len(text) > _MAX_CHARS:
        text = text[:_MAX_CHARS]

    prompt = f"♪ {text} ♪" if use_music_notes else text
    vp = voice_preset.strip()

    def _run(preset: str) -> tuple[np.ndarray, int]:
        processor, model = _get_bark()
        device = next(model.parameters()).device
        inputs = processor(prompt, voice_preset=preset)
        if hasattr(inputs, "to"):
            inputs = inputs.to(device)
        else:
            inputs = {k: v.to(device) if hasattr(v, "to") else v for k, v in dict(inputs).items()}
        with torch.no_grad():
            audio_tensor = model.generate(**inputs)
        audio_np = audio_tensor.detach().cpu().float().numpy().squeeze()
        if audio_np.ndim > 1:
            audio_np = audio_np.flatten()
        audio_np = np.clip(audio_np, -1.0, 1.0).astype(np.float32)
        sr = int(getattr(model.generation_config, "sample_rate", None) or 24000)
        return audio_np, sr

    try:
        return _run(vp)
    except Exception as e:  # noqa: BLE001
        if vp.startswith("v2/nl_") or vp.startswith("v2/af_"):
            logger.warning("Bark preset %s failed (%s); falling back to v2/en_speaker_6", vp, e)
            return _run("v2/en_speaker_6")
        raise


def write_wav_float(path: str | Path, mono_float: np.ndarray, sr: int) -> None:
    pcm = (np.clip(mono_float, -1.0, 1.0) * 32767.0).astype(np.int16)
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    wavfile.write(str(path), int(sr), pcm)


def generate_bark_wav(
    lyrics: str,
    voice_preset: str = "v2/en_speaker_6",
    *,
    use_music_notes: bool = True,
) -> Path:
    """Write a dry Bark vocal to ``cache/raw_<hex>.wav`` and return the path."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    audio_np, sr = synthesize_bark_audio(lyrics, voice_preset, use_music_notes=use_music_notes)
    out = CACHE_DIR / f"raw_{uuid.uuid4().hex}.wav"
    write_wav_float(out, audio_np, sr)
    return out
