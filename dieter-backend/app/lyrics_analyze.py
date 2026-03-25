"""
Heuristic lyrics lint + timing hints for vocal alignment (not a substitute for real ASR).

Used by /api/lyrics/analyze and the lyrics_lint agent. Beat "overflow" = likely too many
syllables/characters for a single bar at the given BPM (rough singing-density estimate).
"""

from __future__ import annotations

import re
from typing import Any, Optional


MAX_LYRICS_CHARS = 12000
LONG_LINE_WARN = 72
VERY_LONG_LINE_ERROR = 140


def _non_empty_lines_fixed(text: str) -> list[str]:
    out = []
    for block in text.replace("\r\n", "\n").split("\n"):
        t = block.strip()
        if not t or re.match(r"^\[[^\]]+\]$", t):
            continue
        out.append(t)
    return out


def _estimate_syllables(line: str) -> int:
    """Very rough EN-ish syllable count for overflow heuristics."""
    s = re.sub(r"[^a-zA-Z']+", " ", line.lower()).strip()
    if not s:
        return max(1, len(line) // 5)
    parts = [p for p in s.split() if p]
    n = 0
    for w in parts:
        vowels = len(re.findall(r"[aeiouy]+", w))
        n += max(1, vowels)
    return n


def analyze_lyrics(
    lyrics: str,
    *,
    bpm: Optional[int] = None,
    beats_per_bar: int = 4,
    max_chars_per_bar_scale: float = 38.0,
) -> dict[str, Any]:
    text = (lyrics or "").strip()
    errors: list[str] = []
    warnings: list[str] = []
    metrics: dict[str, Any] = {
        "charCount": len(text),
        "lineCount": 0,
        "sectionTagCount": len(re.findall(r"^\s*\[[^\]]+\]\s*$", text, re.MULTILINE)),
    }

    if len(text) > MAX_LYRICS_CHARS:
        errors.append(f"Lyrics exceed maximum length ({MAX_LYRICS_CHARS} characters).")

    lines = _non_empty_lines_fixed(text)
    metrics["lineCount"] = len(lines)

    if not text:
        return {
            "ok": True,
            "errors": [],
            "warnings": ["Empty lyrics — fine for instrumental."],
            "metrics": metrics,
            "barsHint": None,
        }

    duplicate_sections = []
    seen: dict[str, int] = {}
    for m in re.finditer(r"^\s*\[([^\]]+)\]\s*$", text, re.MULTILINE):
        tag = m.group(1).strip().lower()
        seen[tag] = seen.get(tag, 0) + 1
        if seen[tag] == 2:
            duplicate_sections.append(tag)
    if duplicate_sections:
        warnings.append(
            "Repeated section tags (e.g. "
            + ", ".join(duplicate_sections[:4])
            + ") — ensure intentional repeats for the arrangement."
        )

    long_lines = 0
    overflow_lines: list[dict[str, Any]] = []

    bp_bar = max(1, min(16, int(beats_per_bar) or 4))
    bpm_v = int(bpm) if bpm is not None else 128
    bpm_v = max(40, min(240, bpm_v))
    seconds_per_bar = (60.0 / bpm_v) * bp_bar
    # Scale allowed density as tempo increases (faster → fewer chars per bar comfortably).
    ref_bpm = 128.0
    max_chars_bar = max_chars_per_bar_scale * (ref_bpm / bpm_v)

    for i, line in enumerate(lines):
        if len(line) >= VERY_LONG_LINE_ERROR:
            errors.append(f"Line {i + 1} is very long ({len(line)} chars) — split for vocal phrasing.")
        elif len(line) >= LONG_LINE_WARN:
            long_lines += 1
        syll = _estimate_syllables(line)
        # ~12–14 syllables per bar is crowded for pop; scale slightly with max_chars_bar
        max_syll = max(10, int(max_chars_bar * 0.35))
        if syll > max_syll:
            overflow_lines.append(
                {
                    "lineIndex": i + 1,
                    "syllablesEstimate": syll,
                    "maxSyllablesPerBarHint": max_syll,
                    "snippet": line[:80] + ("…" if len(line) > 80 else ""),
                }
            )

    if long_lines:
        warnings.append(
            f"{long_lines} line(s) are long (>{LONG_LINE_WARN} chars) — may crowd the bar."
        )

    if overflow_lines:
        warnings.append(
            f"{len(overflow_lines)} line(s) may overflow a typical {bp_bar}-beat bar at ~{bpm_v} BPM "
            "(syllable density heuristic). Use shorter phrases or raise BPM for the section."
        )

    if metrics["sectionTagCount"] == 0 and len(lines) > 6:
        warnings.append(
            "No [Verse]/[Chorus] style tags — providers parse structure better with section markers."
        )

    return {
        "ok": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
        "metrics": metrics,
        "barsHint": {
            "bpmAssumed": bpm_v,
            "beatsPerBar": bp_bar,
            "secondsPerBar": round(seconds_per_bar, 4),
            "charsPerBarHint": round(max_chars_bar, 1),
        },
        "overflowLines": overflow_lines[:24],
    }
