"""
Lyrics generation + optimization: OpenAI when a key is available (env or request),
otherwise deterministic local templates (same spirit as mureka-clone lyricsHelpers).
"""

from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.request
from typing import Literal, Optional, Tuple

VERSE_LINES = [
    "Walking through the static of a midnight dream",
    "Every echo tells me nothing's what it seems",
    "Hold the rhythm where the city meets the sea",
    "Paint the silence in a color only you can see",
]

CHORUS_LINES = [
    "We rise, we fall, we learn to feel alive",
    "Turn the page, rewrite the story line by line",
    "In the glow of every wrong-turned-right",
    "This is the moment we ignite",
]

STYLE_HINTS: dict[str, list[str]] = {
    "trap": ["808s", "hi-hats triplet feel", "sub-heavy", "dark room"],
    "piano": ["grand piano", "soft pedal", "intimate room", "melodic"],
    "rock": ["live drums", "crunch guitars", "arena energy", "anthem"],
    "jazz": ["swing", "walking bass", "brush kit", "smoky club"],
    "ambient": ["pads", "wide stereo", "slow evolution", "breath"],
    "phonk": ["memphis chops", "distorted 808", "night drive", "tape"],
}


def _tokens_from_style(style: str) -> list[str]:
    s = (style or "").lower()
    for key, arr in STYLE_HINTS.items():
        if key in s:
            return arr
    return ["modern mix", "wide vocals", "tight low end", "hook-first"]


def generate_local(style: str, title: str, vocal: str) -> str:
    hint = ", ".join(_tokens_from_style(style))
    v = "voice low in the mix" if vocal == "male" else "bright lead vocal"
    t = (title or "Untitled").strip()
    lines = [
        "[Verse 1]",
        f"{VERSE_LINES[0]},",
        f"{VERSE_LINES[1]}.",
        f"({hint}; {v})",
        "",
        "[Chorus]",
        f"{CHORUS_LINES[0]},",
        f"{CHORUS_LINES[1]}.",
        "",
        "[Verse 2]",
        f"{VERSE_LINES[2]},",
        f"{VERSE_LINES[3]}.",
        "",
        "[Chorus]",
        f"{CHORUS_LINES[2]},",
        f"{CHORUS_LINES[3]}.",
        "",
        "[Outro]",
        f'Carry "{t}" like a pulse beneath the skin…',
    ]
    return "\n".join(lines)


def optimize_local(lyrics: str) -> str:
    if not lyrics or not str(lyrics).strip():
        return ""
    s = str(lyrics).replace("\r\n", "\n")
    parts = [b.strip() for b in re.split(r"\n\s*\n+", s) if b.strip()]
    out_blocks = []
    for block in parts:
        lines = []
        for line in block.split("\n"):
            t = line.strip()
            if not t:
                continue
            if re.match(r"^[a-z]", t):
                t = t[0].upper() + t[1:]
            lines.append(t)
        if lines:
            out_blocks.append("\n".join(lines))
    return "\n\n".join(out_blocks)


def _openai_chat(api_key: str, system: str, user: str) -> str:
    url = "https://api.openai.com/v1/chat/completions"
    body = {
        "model": "gpt-4o-mini",
        "temperature": 0.9,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    }
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key.strip()}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            raw = resp.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8", errors="replace")
        raise ValueError(err or f"OpenAI HTTP {e.code}") from e
    j = json.loads(raw)
    text = j.get("choices", [{}])[0].get("message", {}).get("content")
    if not isinstance(text, str) or not text.strip():
        raise ValueError("empty OpenAI response")
    return text.strip()


def _resolve_openai_key(explicit: Optional[str]) -> Optional[str]:
    if explicit and explicit.strip():
        return explicit.strip()
    env = os.environ.get("OPENAI_API_KEY", "").strip()
    return env or None


def generate_lyrics(
    style: str,
    title: str,
    vocal: str,
    openai_key: Optional[str],
) -> Tuple[str, Literal["openai", "local"]]:
    key = _resolve_openai_key(openai_key)
    if key:
        sys = (
            "You write concise song lyrics with [Verse] / [Chorus] section tags. "
            "No explanations, lyrics only."
        )
        user = f"Style: {style}. Title hint: {title or 'untitled'}. Vocal: {vocal}. Write 16–24 lines."
        try:
            return _openai_chat(key, sys, user), "openai"
        except (ValueError, OSError, urllib.error.URLError, json.JSONDecodeError):
            pass
    return generate_local(style, title, vocal), "local"


def optimize_lyrics(
    lyrics: str,
    openai_key: Optional[str],
) -> Tuple[str, Literal["openai", "local"]]:
    raw = lyrics.strip()
    if not raw:
        return "", "local"
    key = _resolve_openai_key(openai_key)
    if key:
        sys = (
            "You improve song lyrics: tighter rhyme, clearer imagery, same language. "
            "Keep [Section] tags. Output lyrics only."
        )
        try:
            return _openai_chat(key, sys, raw), "openai"
        except (ValueError, OSError, urllib.error.URLError, json.JSONDecodeError):
            pass
    return optimize_local(raw), "local"
