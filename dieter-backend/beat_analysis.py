"""
Shared beat detection + waveform encoding for CLI script and FastAPI main.py.
"""

from __future__ import annotations

import base64

import numpy as np


def analyze(y: np.ndarray, sr: int, *, max_beats_report: int | None = 32) -> dict:
    """Librosa beat_track. max_beats_report limits beat_times_s for CLI; beats_all always full list."""
    import librosa

    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
    if hasattr(tempo, "__iter__") and not isinstance(tempo, (str, bytes)):
        tempo_val = float(tempo[0]) if len(tempo) else 120.0
    else:
        tempo_val = float(tempo)
    beat_times = librosa.frames_to_time(beat_frames, sr=sr)
    beat_list = [float(t) for t in beat_times]
    out = {
        "tempo_bpm": round(tempo_val, 2),
        "n_beats": len(beat_list),
        "beat_times_s": beat_list[:max_beats_report] if max_beats_report is not None else beat_list,
        "beats_all": beat_list,
        "duration_s": round(float(len(y) / sr), 3),
        "sr": sr,
    }
    return out


def waveform_peaks_base64(y: np.ndarray, sr: int, n_points: int = 2048) -> str:
    """Downsample |y| to n_points max-per-bin, normalize, base64 float32 LE."""
    y = np.asarray(y, dtype=np.float32)
    n = len(y)
    if n == 0:
        return base64.b64encode(np.zeros(1, dtype=np.float32).tobytes()).decode("ascii")
    n_points = max(64, min(n_points, 8192))
    if n <= n_points:
        env = np.abs(y)
    else:
        edges = np.linspace(0, n, n_points + 1, dtype=int)
        env = np.empty(n_points, dtype=np.float32)
        for i in range(n_points):
            sl = y[edges[i] : edges[i + 1]]
            env[i] = float(np.max(np.abs(sl))) if len(sl) else 0.0
    peak = float(env.max()) + 1e-9
    env = (env / peak).astype(np.float32)
    return base64.b64encode(env.tobytes()).decode("ascii")


def demo_signal(sr: int = 22050, duration_s: float = 8.0, bpm: float = 120.0) -> np.ndarray:
    import librosa

    n = int(sr * duration_s)
    interval = 60.0 / bpm
    times = np.arange(0.0, duration_s - 0.05, interval, dtype=np.float64)
    y = librosa.clicks(times=times, sr=sr, length=n, click_freq=1200.0, click_duration=0.05)
    return y.astype(np.float32)
