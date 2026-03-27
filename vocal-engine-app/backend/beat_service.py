"""
Beat detection on backing tracks: Librosa HPSS + beat_track on the percussive layer.
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import numpy as np

logger = logging.getLogger(__name__)


def _scalar_tempo(tempo: np.ndarray | float) -> float:
    t = np.asarray(tempo, dtype=np.float64).reshape(-1)
    if t.size == 0:
        return 0.0
    return float(t[0]) if np.isfinite(t[0]) else 0.0


def analyze_backing_track(file_path: str | Path) -> dict[str, Any]:
    """
    Extract BPM, beat timestamps (``beat_intervals``), and track duration.

    Uses harmonic–percussive separation so ``beat_track`` runs on the **percussive**
    component for cleaner onsets.
    """
    import librosa

    path = Path(file_path)
    if not path.is_file():
        raise FileNotFoundError(str(path))

    y, sr = librosa.load(str(path), sr=None, mono=True)
    total_duration = float(librosa.get_duration(y=y, sr=sr))

    _, y_percussive = librosa.effects.hpss(y)

    tempo, beat_frames = librosa.beat.beat_track(y=y_percussive, sr=sr)
    beat_times = librosa.frames_to_time(beat_frames, sr=sr)
    beats_arr = np.asarray(beat_times, dtype=np.float64)

    bpm = _scalar_tempo(tempo)

    if not np.isfinite(bpm) or bpm <= 0 or beats_arr.size < 2:
        onset_env = librosa.onset.onset_strength(y=y_percussive, sr=sr)
        tempo2, beat_frames2 = librosa.beat.beat_track(onset_envelope=onset_env, sr=sr)
        beats_arr = librosa.frames_to_time(beat_frames2, sr=sr)
        bpm = _scalar_tempo(tempo2)

    meter = _guess_meter(beats_arr, total_duration)
    bpm_rounded = round(float(bpm), 2) if np.isfinite(bpm) else 0.0

    intervals = beats_arr.tolist()
    return {
        "bpm": bpm_rounded,
        "beat_intervals": intervals,
        "total_duration": total_duration,
        # Aliases / backward compatibility for pipeline + tests
        "beat_times_sec": intervals,
        "beat_count": int(len(intervals)),
        "duration_sec": round(total_duration, 3),
        "sr": int(sr),
        "meter": {"numerator": meter[0], "denominator": meter[1]},
        "anchor_beat_sec": float(intervals[0]) if intervals else 0.0,
    }


def analyze_beat_track(audio_path: str | Path) -> dict[str, Any]:
    """Same as ``analyze_backing_track`` (name kept for existing imports)."""
    return analyze_backing_track(audio_path)


def _guess_meter(beat_times: np.ndarray, duration: float) -> tuple[int, int]:
    if beat_times.size < 8 or duration <= 0:
        return 4, 4
    dt = np.diff(beat_times[beat_times > 0])
    if dt.size < 2:
        return 4, 4
    ibi = float(np.median(dt))
    if not np.isfinite(ibi) or ibi <= 0:
        return 4, 4
    nbeats = beat_times.size
    mod3 = nbeats % 3
    mod4 = nbeats % 4
    if mod3 < mod4 and nbeats >= 12:
        return 3, 4
    return 4, 4


def detect_bpm(audio_path: str | Path) -> float:
    """Convenience for tests and one-liners."""
    return float(analyze_backing_track(audio_path)["bpm"])
