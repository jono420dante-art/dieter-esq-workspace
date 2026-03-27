"""
Map structured lyrics to beat windows and prepare time-aligned vocal segments (4/4 or 3/4).

This uses a lightweight beat-synchronous plan (not a full CTCSEG/Reznet alignment).
For each sung line we target a duration derived from the assigned beat span, then
time-warp Bark output to that length so phrases land on the grid.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

import numpy as np

TAG_PATTERN = re.compile(r"^\s*\[([^\]]+)\]\s*", re.MULTILINE)


@dataclass
class LyricLine:
    role: str  # e.g. verse, chorus, or "line"
    text: str
    beat_start_idx: int
    beat_end_idx: int
    target_duration_sec: float


def strip_section_tags_for_display(text: str) -> str:
    """Remove [Verse] / [Chorus] style markers, keep line breaks."""
    lines_out = []
    for line in text.splitlines():
        cleaned = TAG_PATTERN.sub("", line)
        if cleaned.strip():
            lines_out.append(cleaned.rstrip())
    return "\n".join(lines_out)


def lyrics_to_singable_lines(text: str) -> list[tuple[str, str]]:
    """
    Parse lyrics into (role, line_text) pairs.
    Role carries the last seen [Tag]; default \"line\".
    """
    current_role = "line"
    pairs: list[tuple[str, str]] = []
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        m = TAG_PATTERN.match(raw)
        if m:
            current_role = m.group(1).strip().lower().replace(" ", "_")
            rest = TAG_PATTERN.sub("", raw).strip()
            if rest:
                pairs.append((current_role, rest))
            continue
        pairs.append((current_role, line))
    return pairs


def plan_lyric_beat_alignment(
    text: str,
    beat_times_sec: list[float],
    *,
    beats_per_measure: tuple[int, int] = (4, 4),
    beats_per_line: int | None = None,
) -> list[LyricLine]:
    """
    Assign each singable line to a contiguous beat span.
    ``beats_per_measure`` is (numerator, denominator); only numerator is used for span length.
    If ``beats_per_line`` is None, uses the numerator (e.g. 4 beats per line in 4/4).
    """
    bt = np.asarray(beat_times_sec, dtype=np.float64)
    if bt.size < 2:
        raise ValueError("Need at least two beat timestamps to align lyrics.")

    pairs = lyrics_to_singable_lines(text)
    if not pairs:
        raise ValueError("No lyric lines after parsing.")

    num = beats_per_measure[0]
    bpl = beats_per_line if beats_per_line is not None else num

    lines: list[LyricLine] = []
    beat_idx = 0
    ibi = float(np.median(np.diff(bt))) if bt.size > 1 else 0.5

    for role, line_text in pairs:
        start_i = min(beat_idx, bt.size - 1)
        end_i = min(beat_idx + bpl, bt.size - 1)
        if end_i <= start_i:
            end_i = min(start_i + 1, bt.size - 1)
        t0 = float(bt[start_i])
        t1 = float(bt[end_i])
        if t1 <= t0:
            t1 = t0 + bpl * ibi
        dur = max(t1 - t0, ibi * 0.25)
        lines.append(
            LyricLine(
                role=role,
                text=line_text,
                beat_start_idx=start_i,
                beat_end_idx=end_i,
                target_duration_sec=dur,
            )
        )
        beat_idx = end_i

    return lines


def time_stretch_waveform(mono_float: np.ndarray, target_len: int) -> np.ndarray:
    """Linear resample along time axis to ``target_len`` samples."""
    if target_len <= 0:
        return mono_float[:0]
    if mono_float.size <= 1:
        return np.zeros(target_len, dtype=np.float32)
    x_old = np.linspace(0.0, 1.0, num=mono_float.size, dtype=np.float64)
    x_new = np.linspace(0.0, 1.0, num=target_len, dtype=np.float64)
    return np.interp(x_new, x_old, mono_float.astype(np.float64)).astype(np.float32)
