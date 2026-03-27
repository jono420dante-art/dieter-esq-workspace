"""
Dieter studio positioning: what this gateway can do vs. cloud-only products.

This is factual capability metadata for the UI — not a claim about beating any
vendor's proprietary models. Dieter wins on **control**, **routing**, **stems/QC**,
and **optional local / multi-provider** paths.
"""
from __future__ import annotations

import os
from typing import Any, Literal

from .local_pipeline import local_capabilities

try:
    import voice_clone_pipeline as _vcp
except ImportError:
    _vcp = None


def _mureka_configured() -> bool:
    return bool((os.environ.get("MUREKA_API_KEY") or "").strip())


def _musicgen_flag() -> dict[str, Any]:
    try:
        from .musicgen_engine import get_musicgen_load_error, is_musicgen_loaded, musicgen_enabled
    except Exception:
        return {"enabled": False, "loaded": False, "error": "musicgen module unavailable"}
    return {
        "enabled": musicgen_enabled(),
        "loaded": is_musicgen_loaded(),
        "error": get_musicgen_load_error(),
    }


def _teal_coqui() -> bool:
    if _vcp is None:
        return False
    try:
        return bool(_vcp.pipeline_available())
    except Exception:
        return False


def dieter_edge_manifest() -> dict[str, Any]:
    """Aggregate live server facts + product pillars for `GET /api/studio/dieter-edge`."""
    caps = local_capabilities()
    mureka = _mureka_configured()
    musicgen = _musicgen_flag()
    coqui = bool(caps.get("coqui_tts_installed"))
    audio_engine = (os.environ.get("DIETER_AUDIO_ENGINE") or "procedural").strip().lower()

    pillars = [
        {
            "id": "ownership",
            "title": "You own the stack",
            "body": "Run the gateway on your infra. Files land under predictable storage paths; export stems, masters, and QC JSON without a single-vendor lock-in.",
            "dieter": 5,
            "cloud_only_typical": 2,
        },
        {
            "id": "routing",
            "title": "One router, many engines",
            "body": "Same API surface can call local procedural jobs, optional MusicGen, Teal/Coqui WAV, Mureka, lyrics LLMs, FFmpeg mastering — swap providers without redesigning your app.",
            "dieter": 5,
            "cloud_only_typical": 2,
        },
        {
            "id": "stems_qc",
            "title": "Stems + vocal science",
            "body": "Librosa vocal analysis, stem splits, beat detect, pitch tooling — built for producers who iterate in a DAW, not only in a single generate button.",
            "dieter": 5,
            "cloud_only_typical": 3,
        },
        {
            "id": "fidelity_vocal_ai",
            "title": "Chart-grade AI vocals",
            "body": "Highest perceived vocal realism still comes from frontier cloud song models. Dieter integrates them (e.g. Mureka) while keeping everything else yours.",
            "dieter": 4 if mureka else 3,
            "cloud_only_typical": 5,
        },
        {
            "id": "latency_cost",
            "title": "Local demos, cloud polish",
            "body": "Procedural + local pipelines ship ideas fast with no per-minute bill; route premium passes to cloud when the key is configured.",
            "dieter": 5,
            "cloud_only_typical": 3,
        },
    ]

    return {
        "version": 1,
        "tagline": "Dieter — your studio OS. Cloud models when you want them; your pipes, stems, and data always.",
        "live": {
            "audioEngine": audio_engine,
            "ffmpeg": caps.get("ffmpeg"),
            "ffmpegRubberband": caps.get("ffmpeg_rubberband_filter"),
            "coquiTts": coqui,
            "tealPipelineReady": _teal_coqui(),
            "murekaApiKeyConfigured": mureka,
            "musicgen": musicgen,
            "openaiConfigured": bool((os.environ.get("OPENAI_API_KEY") or "").strip()),
            "anthropicConfigured": bool((os.environ.get("ANTHROPIC_API_KEY") or "").strip()),
        },
        "pillars": pillars,
        "featureRoutes": {
            "health": "GET /api/health · GET /health",
            "localCaps": "GET /api/local/capabilities",
            "vocalAnalyze": "POST /api/vocal/analyze",
            "tealStatus": "GET /api/tealvoices/status",
            "tealSing": "POST /api/tealvoices/sing",
            "productionVocals": "POST /api/vocals (alias → Teal)",
            "productionMusic": "POST /api/music (MusicGen when enabled)",
            "productionSong": "POST /api/song (vocals + optional MusicGen + optional Supabase)",
            "musicGen": "GET /api/musicgen/status · POST /api/musicgen/generate",
            "voices": "GET /api/voices/list · POST /api/voices/upload · static /voices/man|woman/*.wav",
            "murekaSong": "POST /api/mureka/song/generate · POST /api/mureka (compat: lyrics + style)",
            "musicJob": "POST /api/music/generate",
        },
        "honestNote": (
            "No open-source wrapper replaces every closed model overnight. "
            "Dieter is built to surpass closed platforms on workflow, ownership, and extensibility — "
            "and to fold in the best generators (including commercial APIs) on your terms."
        ),
    }


def studio_recommend_workflow(
    goal: Literal["chart_vocal", "demo_fast", "private_stems", "train_voice", "instrumental_bed"],
    privacy_first: bool,
    *,
    mureka: bool,
    musicgen_on: bool,
    coqui: bool,
) -> dict[str, Any]:
    """Lightweight routing hints for the UI (no automatic job execution)."""
    steps: list[str] = []
    primary = "local_procedural"

    if goal == "train_voice":
        steps = [
            "Capture clean dry takes; label with POST /api/vocal/analyze JSON.",
            "Optional: register clone voice profiles when Coqui path is enabled.",
            "Train heavy models on GPU hosts; expose inference via new /api routes on this gateway.",
        ]
        primary = "dataset_and_gateway"
    elif goal == "private_stems" or privacy_first:
        steps = [
            "Use Local / Beat lab + procedural or MusicGen (if enabled on your server).",
            "Render WAV stems; keep audio off third parties unless you opt in.",
        ]
        primary = "dieter_local"
    elif goal == "chart_vocal" and mureka:
        steps = [
            "Draft lyrics in Dieter; polish with your LLM keys if configured.",
            "Run Mureka song generation through this API; download mix URL; master with /api/audio or DAW.",
        ]
        primary = "mureka_via_dieter"
    elif goal == "chart_vocal" and not mureka:
        steps = [
            "Set MUREKA_API_KEY on the gateway for cloud song+vocal quality.",
            "Until then: Teal Voices WAV + instrumental bed, or enable MusicGen if installed.",
        ]
        primary = "needs_cloud_key_or_musicgen"
    elif goal == "instrumental_bed":
        steps = [
            "POST /api/music/generate (local job) or MusicGen for longer beds.",
            "Layer Teal or cloud vocals later.",
        ]
        primary = "instrumental_local" if not musicgen_on else "instrumental_musicgen"
    else:  # demo_fast
        steps = [
            "POST /api/music/generate for immediate WAV mix (procedural engine by default).",
            "Iterate arrangement in Mixer / Beats; optional Mureka pass when configured.",
        ]
        primary = "local_then_optional_cloud"

    return {
        "goal": goal,
        "privacyFirst": privacy_first,
        "recommendedPrimary": primary,
        "steps": steps,
        "engines": {
            "murekaConfigured": mureka,
            "musicgenEnabled": musicgen_on,
            "coquiReady": coqui,
        },
    }
