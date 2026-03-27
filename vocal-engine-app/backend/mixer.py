"""
Final mixdown: vocal stem + backing beat → single WAV (level-adjusted).
"""
from __future__ import annotations

import logging
from pathlib import Path

import numpy as np
import soundfile as sf

logger = logging.getLogger(__name__)


def _to_mono_float(x: np.ndarray) -> np.ndarray:
    y = np.asarray(x, dtype=np.float32)
    if y.ndim == 2:
        y = np.mean(y, axis=1)
    return np.clip(y, -1.0, 1.0)


def _resample_linear(x: np.ndarray, orig_sr: int, target_sr: int) -> np.ndarray:
    if orig_sr == target_sr:
        return x
    duration = len(x) / float(orig_sr)
    new_len = int(round(duration * target_sr))
    if new_len <= 0:
        return x[:0].astype(np.float32)
    t_old = np.linspace(0.0, duration, num=len(x), endpoint=False)
    t_new = np.linspace(0.0, duration, num=new_len, endpoint=False)
    return np.interp(t_new, t_old, x.astype(np.float64)).astype(np.float32)


def mix_vocal_and_backing(
    vocal_path: str | Path,
    backing_path: str | Path,
    out_path: str | Path,
    *,
    target_sr: int = 44100,
    vocal_gain_lin: float = 0.85,
    beat_gain_lin: float = 0.55,
) -> Path:
    """
    Length-pad to the longer of the two signals, then sum with headroom limiting.
    """
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    v, sr_v = sf.read(str(vocal_path), always_2d=False)
    b, sr_b = sf.read(str(backing_path), always_2d=False)

    v = _to_mono_float(v)
    b = _to_mono_float(b)

    v = _resample_linear(v, sr_v, target_sr)
    b = _resample_linear(b, sr_b, target_sr)

    n = max(len(v), len(b))
    if len(v) < n:
        v = np.pad(v, (0, n - len(v)))
    if len(b) < n:
        b = np.pad(b, (0, n - len(b)))

    mix = v * float(vocal_gain_lin) + b * float(beat_gain_lin)
    peak = float(np.max(np.abs(mix))) if mix.size else 0.0
    if peak > 1.0:
        mix = mix / peak * 0.98

    sf.write(str(out_path), mix, target_sr, subtype="PCM_16")
    return out_path
