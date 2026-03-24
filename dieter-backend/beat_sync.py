"""
Lyric chunking + coarse vocal / beat alignment helpers.

Full frame-perfect DAW sync is model-specific; this gives a usable first pass for mixing.
"""

from __future__ import annotations

import re

import numpy as np


def split_lyrics_pro(lyrics: str, *, max_chars: int = 240) -> list[str]:
    """
    Split lyrics into singable chunks: paragraphs first, then long lines, strip empties.

    Prompt tags like [verse] are kept — Coqui reads them as text (prosody hints).
    """
    text = (lyrics or "").strip()
    if not text:
        return ["[singing] [clear pronunciation, studio quality]"]

    # Normalize line endings
    text = text.replace("\r\n", "\n").replace("\r", "\n")

    parts: list[str] = []
    for block in re.split(r"\n\s*\n+", text):
        block = block.strip()
        if not block:
            continue
        for line in block.split("\n"):
            line = line.strip()
            if not line:
                continue
            while len(line) > max_chars:
                cut = line.rfind(" ", 0, max_chars)
                if cut < max_chars // 2:
                    cut = max_chars
                parts.append(line[:cut].strip())
                line = line[cut:].strip()
            if line:
                parts.append(line)

    if not parts:
        parts = [text[:max_chars]]
    return parts


def wrap_singing_prompt(part: str) -> str:
    """Light prompt wrapper — Coqui LJSpeech ignores bracket tags but they document intent."""
    p = part.strip()
    if not p.lower().startswith("[singing]"):
        p = f"[singing] {p}"
    if "[clear" not in p.lower():
        p = f"{p} [clear pronunciation, studio quality, no reverb]"
    return p


def pure_beat_sync(
    vocal_segments: list[np.ndarray],
    beat_times: list[float],
    sr: int,
) -> np.ndarray:
    """
    Place each vocal segment starting on successive beat onsets (simplified).

    If there are more segments than beats, remaining segments append sequentially.
    """
    if not vocal_segments:
        return np.zeros(1, dtype=np.float32)

    segs = [np.asarray(s, dtype=np.float32).reshape(-1) for s in vocal_segments]
    total_vocal = int(sum(len(s) for s in segs))
    if not beat_times:
        out = np.concatenate(segs) if segs else np.zeros(1, dtype=np.float32)
        return _normalize_peak(out)

    last_beat = float(beat_times[-1])
    # Pad timeline a bit after last beat for tail
    end_t = last_beat + 2.0
    n_out = int(end_t * sr) + total_vocal
    synced = np.zeros(n_out, dtype=np.float32)

    t_cursor = 0.0
    for i, seg in enumerate(segs):
        if i < len(beat_times):
            start_sample = int(float(beat_times[i]) * sr)
        else:
            start_sample = int(t_cursor * sr)
        end_sample = start_sample + len(seg)
        if end_sample > len(synced):
            synced = np.pad(synced, (0, end_sample - len(synced)))
        synced[start_sample:end_sample] += seg
        t_cursor = end_sample / sr

    return _normalize_peak(synced)


def _normalize_peak(y: np.ndarray, eps: float = 1e-9) -> np.ndarray:
    y = np.asarray(y, dtype=np.float32)
    peak = float(np.max(np.abs(y))) + eps
    return (y / peak).astype(np.float32)


def resample_if_needed(y: np.ndarray, sr_from: int, sr_to: int) -> np.ndarray:
    if sr_from == sr_to:
        return np.asarray(y, dtype=np.float32)
    import librosa

    return librosa.resample(np.asarray(y, dtype=np.float32), orig_sr=sr_from, target_sr=sr_to).astype(
        np.float32
    )
