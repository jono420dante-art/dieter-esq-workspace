"""
Lyrics generation + optimization: OpenAI and/or Anthropic (Claude) when keys are available
(env or request), otherwise deterministic local templates (same spirit as mureka-clone lyricsHelpers).

Order: ``DIETER_LYRICS_AI_ORDER`` (default ``openai,anthropic``) — first successful provider wins.
"""

from __future__ import annotations

import json
import logging
import os
import re
import urllib.error
import urllib.request
from typing import Literal, Optional, Tuple

logger = logging.getLogger(__name__)

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


def _anthropic_messages(api_key: str, system: str, user: str) -> str:
    """Claude Messages API (no extra Python deps)."""
    url = "https://api.anthropic.com/v1/messages"
    model = os.environ.get("ANTHROPIC_MODEL", "claude-3-5-haiku-20241022").strip()
    body = {
        "model": model,
        "max_tokens": 2048,
        "system": system,
        "messages": [{"role": "user", "content": user}],
    }
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Content-Type": "application/json",
            "x-api-key": api_key.strip(),
            "anthropic-version": "2023-06-01",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            raw = resp.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8", errors="replace")
        raise ValueError(err or f"Anthropic HTTP {e.code}") from e
    j = json.loads(raw)
    blocks = j.get("content")
    if not isinstance(blocks, list) or not blocks:
        raise ValueError("empty Anthropic response")
    text = blocks[0].get("text") if isinstance(blocks[0], dict) else None
    if not isinstance(text, str) or not text.strip():
        raise ValueError("empty Anthropic text")
    return text.strip()


def _resolve_openai_key(explicit: Optional[str]) -> Optional[str]:
    if explicit and explicit.strip():
        return explicit.strip()
    env = os.environ.get("OPENAI_API_KEY", "").strip()
    return env or None


def _resolve_anthropic_key(explicit: Optional[str]) -> Optional[str]:
    if explicit and explicit.strip():
        return explicit.strip()
    return os.environ.get("ANTHROPIC_API_KEY", "").strip() or None


LyricsSource = Literal["openai", "anthropic", "local"]


def _lyrics_provider_order() -> list[str]:
    raw = os.environ.get("DIETER_LYRICS_AI_ORDER", "openai,anthropic")
    return [p.strip().lower() for p in raw.split(",") if p.strip()]


def _log_provider_fail(provider: str, exc: BaseException, warnings: list[str]) -> None:
    detail = str(exc).strip().replace("\n", " ")[:240]
    tag = f"{provider}_failed:{detail or type(exc).__name__}"
    warnings.append(tag)
    logger.warning("Lyrics provider %s failed: %s", provider, detail or type(exc).__name__)


def generate_lyrics(
    style: str,
    title: str,
    vocal: str,
    openai_key: Optional[str],
    anthropic_key: Optional[str] = None,
) -> Tuple[str, LyricsSource, list[str]]:
    warnings: list[str] = []
    sys = (
        "You write concise song lyrics with [Verse] / [Chorus] section tags. "
        "No explanations, lyrics only."
    )
    user = f"Style: {style}. Title hint: {title or 'untitled'}. Vocal: {vocal}. Write 16–24 lines."
    oa = _resolve_openai_key(openai_key)
    an = _resolve_anthropic_key(anthropic_key)
    for provider in _lyrics_provider_order():
        if provider == "openai" and oa:
            try:
                return _openai_chat(oa, sys, user), "openai", warnings
            except (ValueError, OSError, urllib.error.URLError, json.JSONDecodeError) as e:
                _log_provider_fail("openai", e, warnings)
                continue
        if provider == "anthropic" and an:
            try:
                return _anthropic_messages(an, sys, user), "anthropic", warnings
            except (ValueError, OSError, urllib.error.URLError, json.JSONDecodeError) as e:
                _log_provider_fail("anthropic", e, warnings)
                continue
    text, src = generate_local(style, title, vocal), "local"
    if warnings:
        warnings.append("fallback:local_template_after_ai_errors")
    elif not oa and not an:
        warnings.append("fallback:local_no_openai_or_anthropic_key")
    return text, src, warnings


def optimize_lyrics(
    lyrics: str,
    openai_key: Optional[str],
    anthropic_key: Optional[str] = None,
) -> Tuple[str, LyricsSource, list[str]]:
    warnings: list[str] = []
    raw = lyrics.strip()
    if not raw:
        return "", "local", warnings
    sys = (
        "You improve song lyrics: tighter rhyme, clearer imagery, same language. "
        "Keep [Section] tags. Output lyrics only."
    )
    oa = _resolve_openai_key(openai_key)
    an = _resolve_anthropic_key(anthropic_key)
    for provider in _lyrics_provider_order():
        if provider == "openai" and oa:
            try:
                return _openai_chat(oa, sys, raw), "openai", warnings
            except (ValueError, OSError, urllib.error.URLError, json.JSONDecodeError) as e:
                _log_provider_fail("openai", e, warnings)
                continue
        if provider == "anthropic" and an:
            try:
                return _anthropic_messages(an, sys, raw), "anthropic", warnings
            except (ValueError, OSError, urllib.error.URLError, json.JSONDecodeError) as e:
                _log_provider_fail("anthropic", e, warnings)
                continue
    out = optimize_local(raw)
    if warnings:
        warnings.append("fallback:local_formatter_after_ai_errors")
    elif not oa and not an:
        warnings.append("fallback:local_no_openai_or_anthropic_key")
    return out, "local", warnings
