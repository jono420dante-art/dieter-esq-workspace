"""Beat / tempo analysis with librosa (+ optional madmom)."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import librosa
import numpy as np

try:
    import madmom  # type: ignore

    _MADMOM = True
except ImportError:
    _MADMOM = False


def analyze_beats(audio_path: str | Path) -> dict[str, Any]:
    """
    Extract tempo and beat times (seconds) from an audio file.
    """
    path = Path(audio_path)
    y, sr = librosa.load(str(path), sr=None, mono=True)

    # Primary: librosa beat tracker
    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr, tightness=100)
    tempo_val = float(np.asarray(tempo).flatten()[0]) if np.size(tempo) else 120.0
    beat_times = librosa.frames_to_time(beat_frames, sr=sr)
    beat_times_list = [float(t) for t in beat_times]

    onset_env = librosa.onset.onset_strength(y=y, sr=sr)
    onset_frames = librosa.onset.onset_detect(onset_envelope=onset_env, sr=sr)
    onset_times_arr = librosa.frames_to_time(onset_frames, sr=sr)
    onset_times = [float(x) for x in onset_times_arr][:512]

    out: dict[str, Any] = {
        "bpm": round(tempo_val, 2),
        "duration_sec": round(float(len(y) / sr), 3),
        "sample_rate": int(sr),
        "beat_times_sec": beat_times_list,
        "beat_count": len(beat_times_list),
        "onset_times_sec": onset_times[:512],
        "engine": "librosa",
    }

    if _MADMOM:
        out["madmom_available"] = True
        out["note"] = "Install madmom processors separately for downbeat detection."
    else:
        out["madmom_available"] = False

    return out


def snap_lyrics_lines_to_beats(
    beat_times_sec: list[float], duration_sec: float, line_count: int
) -> list[dict[str, float]]:
    """
    Placeholder grid: distribute lyric lines evenly across detected beats (for UI sync).
    """
    if not beat_times_sec or line_count <= 0:
        return []
    beats = sorted(beat_times_sec)
    n = min(line_count, len(beats))
    idx = np.linspace(0, len(beats) - 1, n).astype(int)
    return [{"line": i, "start_sec": float(beats[j])} for i, j in enumerate(idx)]
