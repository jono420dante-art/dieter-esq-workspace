"""
Vocal pitch presets (semitones). Use with ``pitch_shift_semitones_preserve_duration`` or the generate-master API.

These are **offsets** in semitones, not literal Hz ranges (the Hz comments in marketing copy are illustrative only).
"""

from __future__ import annotations

PITCH_PRESETS: dict[str, float] = {
    "deep_male": -8.0,
    "male": -4.0,
    "neutral": 0.0,
    "female": 4.0,
    "bright_female": 8.0,
}


def preset_semitones(name: str) -> float:
    """Return semitones for a preset key (case-insensitive, spaces -> underscores)."""
    key = (name or "").strip().lower().replace(" ", "_").replace("-", "_")
    if key not in PITCH_PRESETS:
        allowed = ", ".join(sorted(PITCH_PRESETS))
        raise KeyError(f"Unknown pitch preset {name!r}. Use one of: {allowed}")
    return float(PITCH_PRESETS[key])


def resolve_pitch_semitones(*, pitch_preset: str, pitch_semitones: float) -> float:
    """
    If ``pitch_preset`` is non-empty, return preset semitones + ``pitch_semitones`` (fine tune).
    Otherwise return ``pitch_semitones`` alone.
    """
    base = 0.0
    p = (pitch_preset or "").strip()
    if p:
        base = preset_semitones(p)
    return base + float(pitch_semitones)
