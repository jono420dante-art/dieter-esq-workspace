"""
Lazy Coqui TTS (optional heavy deps: ``TTS``, ``torch``).

Used for lyric-driven speech synthesis. Model is configurable via ``COQUI_TTS_MODEL``.
Ethics: only synthesize with voices/models you have rights to use.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Callable, Tuple

import numpy as np
import soundfile as sf

_engine: Any = None
_sample_rate: int = 22050
_get_device: Callable[[], str] | None = None


def _device() -> str:
    global _get_device
    if _get_device is None:
        try:
            import torch

            _get_device = lambda: "cuda" if torch.cuda.is_available() else "cpu"  # noqa: E731
        except ImportError:
            _get_device = lambda: "cpu"  # noqa: E731
    return _get_device()


def get_coqui_tts() -> Tuple[Any, int]:
    """
    Return ``(TTS.api.TTS instance, sample_rate)``. Singleton; first call loads weights.

    Raises ``ImportError`` if ``TTS`` / ``torch`` are missing.
    """
    global _engine, _sample_rate
    if _engine is not None:
        return _engine, _sample_rate

    from TTS.api import TTS

    model_name = (os.environ.get("COQUI_TTS_MODEL") or "tts_models/en/ljspeech/glow-tts").strip()
    try:
        engine = TTS(model_name=model_name).to(_device())
    except AttributeError:
        import torch

        engine = TTS(model_name=model_name, gpu=torch.cuda.is_available())
    _engine = engine
    syn = getattr(engine, "synthesizer", None)
    sr = getattr(syn, "output_sample_rate", None) if syn is not None else None
    _sample_rate = int(sr) if sr else 22050
    return _engine, _sample_rate


def synthesize_wav_mono(text: str) -> Tuple[np.ndarray, int]:
    """Run TTS on ``text``; return float32 mono samples and sample rate."""
    tts, sr = get_coqui_tts()
    prompt = (text or "").strip() or "."
    try:
        wav = tts.tts(text=prompt)
    except TypeError:
        wav = tts.tts(prompt)
    if isinstance(wav, list):
        wav = np.concatenate([np.asarray(x, dtype=np.float32).reshape(-1) for x in wav])
    arr = np.asarray(wav, dtype=np.float32).reshape(-1)
    return arr, sr


def synthesize_to_wav_file(text: str, out_path: Path) -> int:
    """
    Write a WAV file; returns sample rate used.
    """
    arr, sr = synthesize_wav_mono(text)
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(out_path), arr, sr, subtype="PCM_16")
    return sr


def coqui_available() -> bool:
    try:
        from importlib.util import find_spec

        return find_spec("TTS") is not None and find_spec("torch") is not None
    except Exception:
        return False
