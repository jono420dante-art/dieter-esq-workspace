"""
Full vocal pipeline: beat analysis → lyric/beat plan → Bark (♪) → optional RVC → Pedalboard → optional mixdown.
"""
from __future__ import annotations

import logging
import uuid
from pathlib import Path
from typing import Any, Callable

import numpy as np

from beat_service import analyze_beat_track
from generator import synthesize_bark_audio, write_wav_float
from lyric_sync import plan_lyric_beat_alignment, time_stretch_waveform
from locales import default_voice_for_lang, normalize_lang, optional_detect_language
from mixer import mix_vocal_and_backing
from processor import CACHE_DIR, EXPORTS_DIR, polish_only, rvc_available, transform_to_real_vocal

logger = logging.getLogger(__name__)

ProgressFn = Callable[[str, float, str], None]


def _pipeline_label(use_rvc: bool, mix: bool) -> str:
    v = "rvc" if use_rvc else "polish"
    m = "mix" if mix else "vocal"
    return f"beat_sync_bark_{v}_{m}"


def _noop_progress(stage: str, progress: float, message: str) -> None:
    pass


def assemble_synced_vocal_lines(
    lyrics_structured: str,
    beat_times_sec: list[float],
    *,
    voice_preset: str,
    meter: tuple[int, int] = (4, 4),
    use_music_notes: bool = True,
    progress: ProgressFn | None = None,
) -> tuple[np.ndarray, int]:
    """
    For each lyric line, synthesize Bark and time-warp to the beat-assigned duration (stretch/compress to
    the grid). The final stem is **prepended with silence** so playback starts on the **first anchor beat**
    of the backing analysis (``beat_intervals[0]``).
    """
    progress = progress or _noop_progress
    plan = plan_lyric_beat_alignment(
        lyrics_structured,
        beat_times_sec,
        beats_per_measure=meter,
    )

    anchor_sec = float(beat_times_sec[0]) if beat_times_sec else 0.0

    progress("generating_melody", 0.35, f"Bark: {len(plan)} segments…")

    sr_v = 24000
    parts: list[np.ndarray] = []
    for i, line in enumerate(plan):
        audio, sr_b = synthesize_bark_audio(line.text, voice_preset, use_music_notes=use_music_notes)
        if sr_b != sr_v:
            target_len = int(round(line.target_duration_sec * sr_v))
            audio_rs = _resample_chunk(audio, sr_b, sr_v)
        else:
            audio_rs = audio
        target_len = max(1, int(round(line.target_duration_sec * sr_v)))
        stretched = time_stretch_waveform(audio_rs.astype(np.float64).flatten(), target_len)
        parts.append(stretched.astype(np.float32))
        p = 0.35 + 0.25 * (i + 1) / max(len(plan), 1)
        progress("generating_melody", min(p, 0.6), f"Segment {i + 1}/{len(plan)}")

    if not parts:
        return np.zeros(1, dtype=np.float32), sr_v

    out = np.concatenate(parts)
    lead = int(round(anchor_sec * sr_v))
    if lead > 0:
        out = np.concatenate([np.zeros(lead, dtype=np.float32), out])
    return out, sr_v


def _resample_chunk(mono: np.ndarray, sr_from: int, sr_to: int) -> np.ndarray:
    if sr_from == sr_to:
        return mono.astype(np.float32)
    d = len(mono) / float(sr_from)
    new_len = int(round(d * sr_to))
    if new_len <= 0:
        return mono[:0].astype(np.float32)
    t_old = np.linspace(0.0, d, num=len(mono), endpoint=False)
    t_new = np.linspace(0.0, d, num=new_len, endpoint=False)
    return np.interp(t_new, t_old, mono.astype(np.float64).astype(np.float32))


def run_full_vocal_pipeline(
    lyrics: str,
    beat_path: str | Path,
    *,
    lang: str = "en",
    voice_preset: str | None = None,
    rvc_model: str | None = None,
    mix_with_backing: bool = True,
    use_music_notes: bool = True,
    f0_up_key: int = 0,
    auto_lang_detect: bool = False,
    progress: ProgressFn | None = None,
) -> dict[str, Any]:
    """
    Execute detect BPM → align lyrics → Bark → RVC (optional) → polish → optional mix.
    Returns dict with paths (relative names), bpm, stages metadata.
    """
    progress = progress or _noop_progress
    beat_path = Path(beat_path)

    progress("analyzing_beat", 0.05, "Detecting BPM and beat grid…")
    beat_info = analyze_beat_track(beat_path)
    bpm = beat_info["bpm"]
    beats = beat_info.get("beat_intervals") or beat_info["beat_times_sec"]
    meter = (beat_info["meter"]["numerator"], beat_info["meter"]["denominator"])
    logger.info("Beat analysis: bpm=%s beats=%s", bpm, len(beats))

    lg = normalize_lang(lang)
    if auto_lang_detect:
        guessed = optional_detect_language(lyrics)
        if guessed:
            lg = guessed
            logger.info("langdetect → %s", lg)

    resolved_voice = (voice_preset or "").strip() or default_voice_for_lang(lg)

    progress("syncing_lyrics", 0.15, "Mapping lyrics to beat windows…")
    vocal_f, sr_v = assemble_synced_vocal_lines(
        lyrics,
        beats,
        voice_preset=resolved_voice,
        meter=meter,
        use_music_notes=use_music_notes,
        progress=progress,
    )

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    raw_path = CACHE_DIR / f"sync_raw_{uuid.uuid4().hex}.wav"
    write_wav_float(raw_path, vocal_f, sr_v)

    rm = (rvc_model or "").strip()
    use_rvc = bool(rm) and rvc_available()
    if rm and not rvc_available():
        logger.warning("RVC model %s requested but RVC is not installed; using polish only.", rm)
    if use_rvc:
        progress("applying_human_voice", 0.65, "RVC + studio chain…")
        final_v = transform_to_real_vocal(raw_path, rm, f0_up_key=f0_up_key)
    else:
        progress("applying_human_voice", 0.65, "Studio polish (Bark stem)…")
        final_v = polish_only(raw_path)

    try:
        raw_path.unlink(missing_ok=True)
    except OSError:
        pass

    progress("polishing_mix", 0.82, "Vocal chain complete.")

    out_export = Path(final_v)
    mix_path: Path | None = None
    if mix_with_backing:
        progress("mixing", 0.9, "Merging vocal + backing…")
        mix_name = EXPORTS_DIR / f"mix_{uuid.uuid4().hex}.wav"
        mix_path = mix_vocal_and_backing(out_export, beat_path, mix_name)
        logger.info("Mix written %s", mix_path)

    progress("done", 1.0, "BUILD SUCCESS: Real singing layer generated and synced.")

    result = {
        "bpm": bpm,
        "beat_count": beat_info["beat_count"],
        "meter": beat_info["meter"],
        "beat_times_preview_sec": list(beats[:48]),
        "anchor_beat_sec": beat_info.get("anchor_beat_sec", float(beats[0]) if beats else 0.0),
        "total_duration": beat_info.get("total_duration", beat_info.get("duration_sec")),
        "vocal_download": f"/download/{out_export.name}",
        "vocal_filename": out_export.name,
        "lang_resolved": lg,
        "voice_used": resolved_voice,
        "pipeline": _pipeline_label(use_rvc, mix_with_backing),
    }
    if mix_path is not None:
        result["mix_download"] = f"/download/{mix_path.name}"
        result["mix_filename"] = mix_path.name

    return result


# Allow tests to import a shorter name
def apply_studio_effects_to_file(wav_path: str | Path) -> Path:
    """Pedalboard-only polish on disk → exports/final_*.wav"""
    return polish_only(wav_path)
