"""Objective vocal / monophonic descriptors via librosa — for labeling data and conditioning vectors.

These features describe how a take *sounds* (spectrum, dynamics, gross pitch), not lyrics.
Pair exported JSON lines with your own genre/style tags for finetuning or contrastive training.
"""

from __future__ import annotations

import io
from typing import Any

import numpy as np


def analyze_vocal_audio_bytes(raw: bytes, *, sr: int | None = 22050, max_analyze_sec: float = 180.0) -> dict[str, Any]:
    import librosa

    y, sr = librosa.load(io.BytesIO(raw), sr=sr, mono=True, duration=max_analyze_sec)
    if y.size == 0:
        raise ValueError("empty or unreadable audio")

    duration_sec = float(librosa.get_duration(y=y, sr=sr))
    hop_length = 512
    cent = librosa.feature.spectral_centroid(y=y, sr=sr, hop_length=hop_length)[0]
    bw = librosa.feature.spectral_bandwidth(y=y, sr=sr, hop_length=hop_length)[0]
    rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr, hop_length=hop_length, roll_percent=0.85)[0]
    zcr = librosa.feature.zero_crossing_rate(y, hop_length=hop_length)[0]
    rms = librosa.feature.rms(y=y, frame_length=hop_length * 2, hop_length=hop_length)[0]
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13, hop_length=hop_length)
    mfcc_mean = [float(x) for x in np.mean(mfcc, axis=1)]
    mfcc_std = [float(x) for x in np.std(mfcc, axis=1)]

    def _summarize_band(x: np.ndarray) -> dict[str, float]:
        x = x[np.isfinite(x)]
        if x.size == 0:
            return {"mean": 0.0, "std": 0.0, "p10": 0.0, "p90": 0.0}
        return {
            "mean": float(np.mean(x)),
            "std": float(np.std(x)),
            "p10": float(np.percentile(x, 10)),
            "p90": float(np.percentile(x, 90)),
        }

    f0_summary: dict[str, Any] = {
        "mean_hz": None,
        "median_hz": None,
        "std_hz": None,
        "min_hz": None,
        "max_hz": None,
        "voiced_fraction": 0.0,
        "method": None,
    }
    try:
        f0, _, _ = librosa.pyin(
            y,
            fmin=librosa.note_to_hz("C2"),
            fmax=librosa.note_to_hz("C6"),
            sr=sr,
            frame_length=2048,
        )
        if f0 is not None:
            mask = np.isfinite(f0)
            fv = f0[mask]
            f0_summary["voiced_fraction"] = float(np.mean(mask)) if f0.size else 0.0
            if fv.size:
                f0_summary["mean_hz"] = float(np.mean(fv))
                f0_summary["median_hz"] = float(np.median(fv))
                f0_summary["std_hz"] = float(np.std(fv))
                f0_summary["min_hz"] = float(np.min(fv))
                f0_summary["max_hz"] = float(np.max(fv))
                f0_summary["method"] = "pyin"
    except Exception:
        f0_summary["method"] = "unavailable"

    return {
        "sample_rate": int(sr),
        "duration_sec": duration_sec,
        "spectral_centroid_hz": _summarize_band(cent),
        "spectral_bandwidth_hz": _summarize_band(bw),
        "spectral_rolloff_hz": _summarize_band(rolloff),
        "zero_crossing_rate": _summarize_band(zcr),
        "rms": _summarize_band(rms),
        "mfcc_mean": mfcc_mean,
        "mfcc_std": mfcc_std,
        "f0": f0_summary,
    }
