"""
Release-oriented pipeline: beat upload + lyrics → procedural vocal (local) → mix → pro master.
Distro / distributor metadata is **stub only** — no DistroKid API (they expect manual dashboard upload).
"""

from __future__ import annotations

import json
import os
import uuid
from pathlib import Path
from typing import Any

from .audio_master import pro_master_audio
from .engines import get_engine
from .local_pipeline import merge_two_audio_mp3, pitch_shift_semitones_preserve_duration
from .pitch_presets import resolve_pitch_semitones
from scripts.vocal_pipeline_stub import full_pipeline_stub


def distro_metadata_stub(
    title: str,
    artist: str,
    *,
    platforms: list[str] | None = None,
) -> dict[str, Any]:
    """JSON you can paste into a distributor UI — not sent anywhere automatically."""
    return {
        "title": (title or "Untitled")[:80],
        "artist": artist or "Independent Artist",
        "isrc": None,
        "note": "ISRC must be issued by your label/aggregator; DistroKid has no public REST upload API.",
        "platforms": platforms or ["spotify", "apple_music", "youtube_music"],
    }


def generate_master_pipeline(
    beat_data: bytes,
    beat_suffix: str,
    lyrics: str,
    *,
    artist: str = "Transparent Programs",
    title_hint: str | None = None,
    bpm: float = 120.0,
    duration_sec: int = 45,
    vocal_preset: str = "Radio",
    pitch_semitones: float = 0.0,
    pitch_preset: str = "",
    storage_root: Path,
) -> dict[str, Any]:
    """
    1. Save beat to storage/local
    2. Local procedural vocal (same engine as /api/local/procedural-vocal-layer) — swap for RVC/Tortoise later
    3. FFmpeg mix beat + vocal
    4. ``pro_master_audio`` (trim/fade/loudnorm/320k MP3)
    """
    storage_root = Path(storage_root)
    local_dir = storage_root / "local"
    local_dir.mkdir(parents=True, exist_ok=True)
    pipe_id = uuid.uuid4().hex[:12]
    suf = beat_suffix if beat_suffix.startswith(".") else f".{beat_suffix}"

    beat_path = local_dir / f"pipe_{pipe_id}_beat{suf}"
    beat_path.write_bytes(beat_data)

    stub_meta = full_pipeline_stub(
        lyrics or "[instrumental]",
        beat_path,
        local_dir / f"pipe_{pipe_id}_stub_work",
    )

    out_vocal_dir = local_dir / f"pipe_{pipe_id}_vocdir"
    out_vocal_dir.mkdir(parents=True, exist_ok=True)
    seed = abs(hash((lyrics, bpm))) % (16**8)
    engine_name = os.getenv("DIETER_AUDIO_ENGINE", "procedural")
    engine = get_engine(engine_name)
    bpm_i = int(round(max(40, min(240, bpm))))
    dur = int(max(5, min(240, duration_sec)))
    res = engine.generate(
        out_dir=out_vocal_dir,
        prompt="release pipeline vocal",
        lyrics=lyrics or "",
        language="en",
        vocal_preset=vocal_preset,
        bpm=bpm_i,
        duration_s=dur,
        seed=seed,
        render_stems=True,
    )
    vocal_src = res.stem_paths.get("vocals")
    if not vocal_src or not vocal_src.is_file():
        raise RuntimeError("Procedural vocal stem missing from engine output")
    vocal_dest = local_dir / f"pipe_{pipe_id}_vocals.wav"
    vocal_dest.write_bytes(vocal_src.read_bytes())

    try:
        resolved_pitch = resolve_pitch_semitones(
            pitch_preset=pitch_preset,
            pitch_semitones=float(pitch_semitones),
        )
    except KeyError as e:
        raise RuntimeError(str(e)) from e
    resolved_pitch = max(-12.0, min(12.0, resolved_pitch))

    vocal_for_mix = vocal_dest
    if abs(resolved_pitch) > 1e-6:
        vocal_pitched = local_dir / f"pipe_{pipe_id}_vocals_pitched.wav"
        _ = pitch_shift_semitones_preserve_duration(vocal_dest, vocal_pitched, resolved_pitch)
        vocal_for_mix = vocal_pitched

    mix_path = local_dir / f"pipe_{pipe_id}_mix.mp3"
    merge_two_audio_mp3(beat_path, vocal_for_mix, mix_path)

    master_path = local_dir / f"pipe_{pipe_id}_master.mp3"
    pro_master_audio(mix_path, master_path)

    title = (title_hint or (lyrics[:50] if lyrics else "") or "Untitled").strip() or "Untitled"
    meta = distro_metadata_stub(title, artist)

    return {
        "pipelineId": pipe_id,
        "beatKey": f"local/{beat_path.name}",
        "vocalKey": f"local/{vocal_for_mix.name}",
        "mixKey": f"local/{mix_path.name}",
        "masterKey": f"local/{master_path.name}",
        "masterUrl": f"/api/storage/local/{master_path.name}",
        "metadata": meta,
        "distro_ready": True,
        "vocal_chain_stub": stub_meta,
        "engine": engine.name,
        "bpm": bpm_i,
        "pitch_semitones": round(resolved_pitch, 4),
        "pitch_preset_applied": (pitch_preset or "").strip() or None,
    }


def save_distro_prep_upload(
    file_data: bytes,
    filename: str,
    metadata_json: str,
    storage_root: Path,
) -> dict[str, Any]:
    """Store audio + parsed metadata JSON for manual DistroKid / SoundOn upload."""
    storage_root = Path(storage_root)
    up_dir = storage_root / "distro_prep"
    up_dir.mkdir(parents=True, exist_ok=True)
    rid = uuid.uuid4().hex[:12]
    safe = Path(filename or "upload.bin").name
    path = up_dir / f"{rid}_{safe}"
    path.write_bytes(file_data)
    try:
        meta = json.loads(metadata_json) if metadata_json.strip() else {}
    except json.JSONDecodeError as e:
        raise ValueError(f"metadata_json is not valid JSON: {e}") from e
    sidecar = up_dir / f"{rid}_metadata.json"
    sidecar.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    return {
        "status": "ready_for_manual_upload",
        "file": str(path),
        "metadataPath": str(sidecar),
        "metadata": meta,
        "message": "Log into your distributor (e.g. distrokid.com) and upload this file in the browser.",
    }
