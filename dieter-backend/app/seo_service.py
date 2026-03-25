"""
SEO packs for releases: heuristics + optional OpenAI (same key resolution as lyrics).
"""

from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.request
from typing import Any, Literal, Optional, Tuple

from .lyrics_service import _openai_chat, _resolve_openai_key


def seo_suggest_heuristic(
    *,
    title: str,
    description: Optional[str],
    lyrics: Optional[str],
    tags: Optional[list[str]],
    genre: Optional[str],
) -> dict[str, Any]:
    tags = tags or []
    genre = genre or "music"
    title = title.strip()
    keywords: list[str] = []
    for t in [genre, description or "", title, *tags]:
        parts = re.split(r"[^a-z0-9]+", str(t).lower())
        for w in parts:
            if len(w) >= 3 and w not in keywords:
                keywords.append(w)
            if len(keywords) >= 22:
                break
        if len(keywords) >= 22:
            break

    keywords = keywords[:22]
    desc = (description or "").strip()[:160] if description else ""
    if not desc:
        desc = f"{title} — {genre} track with vivid lyrics and modern production."

    slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:72]

    return {
        "metaDescription": desc,
        "keywords": keywords,
        "h1": title,
        "h2Ideas": [
            f"Behind the sound — {genre} vibe and story",
            "Stream / download — links in release notes",
            "Lyrics + meaning",
        ],
        "slugSuggestions": [slug] if slug else [],
        "youtubeTitle": f"{title} (Official Audio)"[:100],
        "youtubeDescription": f"{title}\n\n{desc}\n\n#{re.sub(r'[^a-z0-9]+', '', genre.lower()) or 'music'} #newmusic",
        "tiktokCaption": f"{title} · {genre} · new drop",
        "hashtags": [f"#{genre.lower().replace(' ', '')}", "#newmusic", "#fyp"][:8],
        "source": "heuristic",
    }


def _seo_openai_pack(
    api_key: str,
    *,
    title: str,
    description: Optional[str],
    lyrics: Optional[str],
    tags: Optional[list[str]],
    genre: Optional[str],
) -> dict[str, Any]:
    sys = (
        "You are a music marketing SEO assistant. Return ONLY valid JSON, no markdown. "
        "Schema: {\"metaDescription\": string max 160 chars, \"keywords\": string[≤25], "
        "\"h1\": string, \"h2Ideas\": string[3], \"slugSuggestions\": string[2], "
        "\"youtubeTitle\": string max 100 chars, \"youtubeDescription\": string max 4500 chars, "
        "\"tiktokCaption\": string max 220 chars, \"hashtags\": string[12] each starting with #}."
    )
    user = json.dumps(
        {
            "title": title,
            "description": description or "",
            "lyrics_excerpt": (lyrics or "")[:1200],
            "tags": tags or [],
            "genre": genre or "music",
        },
        ensure_ascii=False,
    )
    raw = _openai_chat(api_key, sys, user)
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        m = re.search(r"\{[\s\S]*\}", raw)
        if not m:
            raise ValueError("OpenAI SEO: not JSON") from None
        data = json.loads(m.group(0))
    if not isinstance(data, dict):
        raise ValueError("OpenAI SEO: expected object")
    data["source"] = "openai"
    return data


def build_seo_pack(
    *,
    title: str,
    description: Optional[str] = None,
    lyrics: Optional[str] = None,
    tags: Optional[list[str]] = None,
    genre: Optional[str] = None,
    openai_api_key: Optional[str] = None,
) -> Tuple[dict[str, Any], Literal["openai", "heuristic"]]:
    base = seo_suggest_heuristic(
        title=title,
        description=description,
        lyrics=lyrics,
        tags=tags,
        genre=genre,
    )
    key = _resolve_openai_key(openai_api_key)
    if not key:
        return base, "heuristic"
    try:
        enriched = _seo_openai_pack(
            key,
            title=title.strip(),
            description=description,
            lyrics=lyrics,
            tags=tags,
            genre=genre,
        )
        merged = {**base, **enriched}
        merged["source"] = "openai"
        return merged, "openai"
    except (ValueError, OSError, urllib.error.URLError, json.JSONDecodeError, TypeError):
        return base, "heuristic"
