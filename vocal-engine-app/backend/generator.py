"""
Bark-based singing stem: lyrics → dry ``.wav`` in ``cache/``.
"""
from __future__ import annotations

import logging
import os
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
_MAX_CHARS = int(os.environ.get("BARK_MAX_LYRIC_CHARS", "500"))

_processor: AutoProcessor | None = None
_model: BarkModel | None = None


def _bark_device() -> str:
    if torch.cuda.is_available():
        return "cuda"
    if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def _get_bark() -> tuple[AutoProcessor, BarkModel]:
    global _processor, _model
    if _processor is not None and _model is not None:
        return _processor, _model
    logger.info("Loading Bark %s…", BARK_MODEL_ID)
    _processor = AutoProcessor.from_pretrained(BARK_MODEL_ID)
    _model = BarkModel.from_pretrained(BARK_MODEL_ID)
    _model = _model.to(_bark_device())
    _model.eval()
    return _processor, _model


def generate_bark_wav(
    lyrics: str,
    voice_preset: str = "v2/en_speaker_6",
    *,
    use_music_notes: bool = True,
) -> Path:
    """
    Write a dry Bark vocal to ``cache/raw_<hex>.wav`` and return the path.
    """
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    text = lyrics.strip()
    if len(text) > _MAX_CHARS:
        text = text[:_MAX_CHARS]

    prompt = f"♪ {text} ♪" if use_music_notes else text
    processor, model = _get_bark()
    device = next(model.parameters()).device
    inputs = processor(prompt, voice_preset=voice_preset.strip())

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

    out = CACHE_DIR / f"raw_{uuid.uuid4().hex}.wav"
    wavfile.write(str(out), sr, pcm)
    return out
