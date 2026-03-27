"""
Multilingual Bark defaults: English, Dutch; Afrikaans uses Dutch phonetics (same voice preset family).
Override any time with an explicit ``voice_preset`` from the API/UI.
"""
from __future__ import annotations

# suno/bark multilingual presets — nl_* may not exist on all checkpoints; generator falls back to EN.
DEFAULT_VOICE_BY_LANG: dict[str, str] = {
    "en": "v2/en_speaker_6",
    "nl": "v2/nl_speaker_0",
    # Afrikaans: use nl_* Bark tokens (Dutch phonetics), not a separate af_* preset.
    "af": "v2/nl_speaker_0",
}

BARK_LANG_ALIASES: dict[str, str] = {
    "eng": "en",
    "english": "en",
    "nld": "nl",
    "dutch": "nl",
    "nederlands": "nl",
    "afr": "af",
    "afrikaans": "af",
}


def normalize_lang(code: str | None) -> str:
    if not code:
        return "en"
    c = code.strip().lower().replace("_", "-").split("-")[0]
    c = BARK_LANG_ALIASES.get(c, c)
    if c in DEFAULT_VOICE_BY_LANG:
        return c
    return "en"


def default_voice_for_lang(lang: str) -> str:
    return DEFAULT_VOICE_BY_LANG.get(normalize_lang(lang), DEFAULT_VOICE_BY_LANG["en"])


def optional_detect_language(text: str) -> str | None:
    try:
        from langdetect import detect_langs

        langs = detect_langs(text[:800] if text else "")
        if not langs:
            return None
        top = langs[0].lang.lower()
        if top in ("af",):
            return "af"
        if top in ("nl", "nld"):
            return "nl"
        return "en"
    except Exception:  # noqa: BLE001
        return None
