from __future__ import annotations

from typing import Any

from ..lyrics_analyze import analyze_lyrics
from ..seo_service import build_seo_pack


def list_agents() -> list[dict[str, Any]]:
    return [
        {
            "id": "lyrics_lint",
            "title": "Lyrics lint + bar overflow hints",
            "description": "Validates length, section tags, rough syllable/bar density for a given BPM.",
            "payload": {
                "lyrics": "string (required)",
                "bpm": "integer 40–240 (optional, default 128)",
                "beatsPerBar": "integer 1–16 (optional, default 4)",
            },
        },
        {
            "id": "seo_pack",
            "title": "Release SEO pack (YouTube / TikTok / web)",
            "description": "Keywords, meta description, titles, captions; uses OpenAI when key is present.",
            "payload": {
                "title": "string (required)",
                "description": "optional string",
                "lyrics": "optional string",
                "tags": "optional string[]",
                "genre": "optional string",
                "openaiApiKey": "optional string (else OPENAI_API_KEY on server)",
            },
        },
    ]


def run_agent(agent_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    aid = (agent_id or "").strip().lower()
    if aid == "lyrics_lint":
        lyrics = str(payload.get("lyrics") or "")
        bpm = payload.get("bpm")
        bpm_i = int(bpm) if bpm is not None and str(bpm).strip() != "" else None
        beats = payload.get("beatsPerBar", payload.get("beats_per_bar", 4))
        try:
            bp = int(beats)
        except (TypeError, ValueError):
            bp = 4
        return analyze_lyrics(lyrics, bpm=bpm_i, beats_per_bar=bp)
    if aid == "seo_pack":
        title = str(payload.get("title") or "").strip()
        if not title:
            raise ValueError("seo_pack requires title")
        pack, source = build_seo_pack(
            title=title,
            description=payload.get("description"),
            lyrics=payload.get("lyrics"),
            tags=payload.get("tags"),
            genre=payload.get("genre"),
            openai_api_key=payload.get("openaiApiKey"),
        )
        return {"pack": pack, "source": source}
    raise ValueError(f"Unknown agent: {agent_id!r}")
