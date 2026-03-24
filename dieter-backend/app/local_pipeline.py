"""
Offline audio pipeline: beat detection (librosa), optional FFmpeg mix.
RVC / Tortoise-TTS run as separate services — see docker-compose.local.yml and LOCAL_PIPELINE.md.
"""

from __future__ import annotations

import logging
import os
import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

from .audio_master import ffprobe_sample_rate

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class PitchShiftResult:
    """Which engine applied the shift (``auto`` mode may fall back to original file)."""

    engine_used: Literal[
        "rubberband",
        "librosa",
        "ffmpeg_ps",
        "original_unshifted",
        "copy_zero_shift",
    ]
    warning: str | None = None


def _try_madmom_beats(audio_path: Path) -> dict[str, Any] | None:
    try:
        from madmom.features.beats import DBNBeatTrackingProcessor, RNNBeatProcessor
    except Exception:
        return None
    try:
        import numpy as np

        act = RNNBeatProcessor()(str(audio_path))
        beats = DBNBeatTrackingProcessor(fps=100)(act)
        times = [float(t) for t in beats]
        tempo_val: float | None = None
        if len(times) >= 2:
            iv = np.diff(times)
            med = float(np.median(iv))
            if med > 1e-6:
                tempo_val = 60.0 / med
        return {
            "tempo_bpm": round(tempo_val, 2) if tempo_val else None,
            "beat_times_seconds": times,
            "beat_count": len(times),
            "engine": "madmom_rnn_dbn",
        }
    except Exception:
        return None


def detect_beats_from_path(audio_path: Path) -> dict[str, Any]:
    import librosa

    y, sr = librosa.load(str(audio_path), sr=None, mono=True)
    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
    if hasattr(tempo, "__iter__") and not isinstance(tempo, (str, bytes)):
        tempo_val = float(tempo[0]) if len(tempo) else 120.0
    else:
        tempo_val = float(tempo)
    beat_times = librosa.frames_to_time(beat_frames, sr=sr)
    onset_env = librosa.onset.onset_strength(y=y, sr=sr)
    onset_frames = librosa.onset.onset_detect(onset_envelope=onset_env, sr=sr, units="frames")
    onset_times = librosa.frames_to_time(onset_frames, sr=sr)
    out: dict[str, Any] = {
        "tempo_bpm": round(tempo_val, 2),
        "beat_times_seconds": [float(t) for t in beat_times],
        "onset_times_seconds": [float(t) for t in onset_times],
        "duration_seconds": round(float(len(y) / sr), 3),
        "sample_rate": int(sr),
        "beat_count": int(len(beat_times)),
        "librosa_engine": "beat_track",
    }
    mad = _try_madmom_beats(audio_path)
    if mad:
        out["madmom"] = mad
    return out


def _atempo_chain_filter(ratio: float) -> str:
    """FFmpeg atempo must stay within ~0.5–2.0 per filter; chain for extreme ratios."""
    parts: list[str] = []
    x = float(ratio)
    while x > 2.0 + 1e-9:
        parts.append("atempo=2.0")
        x /= 2.0
    while x < 0.5 - 1e-9:
        parts.append("atempo=0.5")
        x /= 0.5
    parts.append(f"atempo={max(0.5, min(2.0, x)):.6f}")
    return ",".join(parts)


def stretch_audio_to_bpm_ratio(in_path: Path, out_path: Path, *, from_bpm: float, to_bpm: float) -> None:
    """
    Resample playback speed so material paced at from_bpm matches to_bpm.
    ratio = from_bpm / to_bpm (speed up if from < to).
    """
    if from_bpm <= 0 or to_bpm <= 0:
        raise ValueError("BPM must be positive")
    ratio = from_bpm / to_bpm
    ff = _which_ffmpeg()
    if not ff:
        raise RuntimeError("ffmpeg not found on PATH — install ffmpeg and retry.")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    filt = _atempo_chain_filter(ratio)
    cmd = [
        ff,
        "-y",
        "-i",
        str(in_path),
        "-filter:a",
        filt,
        "-c:a",
        "libmp3lame",
        "-q:a",
        "2",
        str(out_path),
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(r.stderr or r.stdout or "ffmpeg atempo failed")


def _which_ffmpeg() -> str | None:
    return shutil.which("ffmpeg")


def _pitch_shift_ffmpeg_rubberband(in_path: Path, out_path: Path, semitones: float) -> bool:
    """
    FFmpeg ``rubberband`` filter (needs ffmpeg built with librubberband). Formant preservation, natural timbre.
    Returns True if the filter ran successfully.
    """
    ff = _which_ffmpeg()
    if not ff:
        return False
    ratio = 2 ** (semitones / 12.0)
    # formants=1 enables formant preservation (see ffmpeg docs; not "preserve" string)
    filt = f"rubberband=pitch={ratio:.10f}:formants=1"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        ff,
        "-y",
        "-i",
        str(in_path),
        "-af",
        filt,
        "-ar",
        "44100",
        "-c:a",
        "pcm_s16le",
        str(out_path),
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    return r.returncode == 0


def _pitch_shift_librosa(in_path: Path, out_path: Path, semitones: float) -> None:
    """librosa.effects.pitch_shift — CPU, no chipmunk as extreme as naive rate change; single pass only."""
    import librosa
    import soundfile as sf

    y, sr = librosa.load(str(in_path), sr=None, mono=True)
    y_s = librosa.effects.pitch_shift(y, sr=sr, n_steps=float(semitones))
    out_path.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(out_path), y_s, sr, subtype="PCM_16")


def _pitch_shift_ffmpeg_rate_compensated(in_path: Path, out_path: Path, semitones: float) -> None:
    """Fallback: asetrate + aresample + atempo — can sound less natural on vocals."""
    ff = _which_ffmpeg()
    if not ff:
        raise RuntimeError("ffmpeg not found on PATH — install ffmpeg and retry.")
    sr = ffprobe_sample_rate(in_path)
    ratio = 2 ** (semitones / 12.0)
    inv = 1.0 / ratio
    filt = f"asetrate={sr * ratio:.10f},aresample={sr},{_atempo_chain_filter(inv)}"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        ff,
        "-y",
        "-i",
        str(in_path),
        "-filter:a",
        filt,
        "-c:a",
        "pcm_s16le",
        str(out_path),
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(r.stderr or r.stdout or "ffmpeg pitch shift failed")


def pitch_shift_semitones_preserve_duration(
    in_path: Path,
    out_path: Path,
    semitones: float,
    *,
    engine: Literal["auto", "rubberband", "librosa", "ffmpeg_ps"] = "auto",
) -> PitchShiftResult:
    """
    Shift pitch by ``semitones`` while preserving duration.

    **Priority when ``engine="auto"``** (override with ``DIETER_PITCH_ENGINE``):

    1. FFmpeg **rubberband** (best quality; needs FFmpeg with rubberband filter).
    2. **librosa** ``pitch_shift`` (pure Python stack; slower).
    3. FFmpeg **asetrate** + **atempo** (``ffmpeg_ps``; fast, less natural on vocals).
    4. **Original file** copied to ``out_path`` — unshifted — if all engines fail (logged; ``warning`` set).

    Forced modes (``rubberband`` / ``librosa`` / ``ffmpeg_ps``) raise ``RuntimeError`` with a clear message
    on failure (no silent fallback).

    Returns :class:`PitchShiftResult` describing which path was used.
    """
    if abs(semitones) < 1e-6:
        shutil.copy2(in_path, out_path)
        return PitchShiftResult(engine_used="copy_zero_shift", warning=None)

    env_eng = (os.environ.get("DIETER_PITCH_ENGINE") or "").strip().lower()
    mode: Literal["auto", "rubberband", "librosa", "ffmpeg_ps"]
    if env_eng in ("rubberband", "librosa", "ffmpeg_ps"):
        mode = env_eng  # type: ignore[assignment]
    else:
        mode = engine

    if mode == "rubberband":
        if _pitch_shift_ffmpeg_rubberband(in_path, out_path, semitones):
            return PitchShiftResult(engine_used="rubberband")
        raise RuntimeError(
            "Pitch (rubberband): FFmpeg rubberband filter failed. "
            "Install FFmpeg built with librubberband, or set DIETER_PITCH_ENGINE=librosa or auto."
        )
    if mode == "librosa":
        try:
            _pitch_shift_librosa(in_path, out_path, semitones)
            return PitchShiftResult(engine_used="librosa")
        except Exception as e:
            raise RuntimeError(f"Pitch (librosa): {e}") from e
    if mode == "ffmpeg_ps":
        try:
            _pitch_shift_ffmpeg_rate_compensated(in_path, out_path, semitones)
            return PitchShiftResult(engine_used="ffmpeg_ps")
        except Exception as e:
            raise RuntimeError(f"Pitch (ffmpeg): {e}") from e

    # auto: rubberband → librosa → ffmpeg_ps → original (silent fallback)
    errs: list[str] = []
    if _pitch_shift_ffmpeg_rubberband(in_path, out_path, semitones):
        logger.info("pitch_shift: engine=rubberband")
        return PitchShiftResult(engine_used="rubberband")

    errs.append("rubberband unavailable or failed")

    try:
        _pitch_shift_librosa(in_path, out_path, semitones)
        logger.info("pitch_shift: engine=librosa (fallback)")
        return PitchShiftResult(
            engine_used="librosa",
            warning="Used librosa; rubberband was unavailable or failed.",
        )
    except Exception as e:
        errs.append(f"librosa: {e}")

    try:
        _pitch_shift_ffmpeg_rate_compensated(in_path, out_path, semitones)
        logger.info("pitch_shift: engine=ffmpeg_ps (fallback)")
        return PitchShiftResult(
            engine_used="ffmpeg_ps",
            warning="Used FFmpeg asetrate/atempo fallback; earlier stages failed: " + "; ".join(errs),
        )
    except Exception as e:
        errs.append(f"ffmpeg: {e}")

    shutil.copy2(in_path, out_path)
    w = (
        "Pitch shift unavailable — returned original vocal (unshifted). "
        "Tried: " + "; ".join(errs)
    )
    logger.warning("pitch_shift: %s", w)
    return PitchShiftResult(engine_used="original_unshifted", warning=w)


def merge_two_audio_mp3(
    beat_path: Path,
    vocal_path: Path,
    out_path: Path,
    *,
    vocal_gain_db: float = -3.0,
    beat_gain_db: float = -6.0,
) -> None:
    """Mix two tracks. Requires ffmpeg on PATH."""
    ff = _which_ffmpeg()
    if not ff:
        raise RuntimeError("ffmpeg not found on PATH — install ffmpeg and retry.")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    filter_complex = (
        f"[0:a]volume={beat_gain_db}dB[a0];[1:a]volume={vocal_gain_db}dB[a1];"
        "[a0][a1]amix=inputs=2:duration=longest:dropout_transition=0[aout]"
    )
    cmd = [
        ff,
        "-y",
        "-i",
        str(beat_path),
        "-i",
        str(vocal_path),
        "-filter_complex",
        filter_complex,
        "-map",
        "[aout]",
        "-c:a",
        "libmp3lame",
        "-q:a",
        "2",
        str(out_path),
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(r.stderr or r.stdout or "ffmpeg failed")


def _ffmpeg_has_rubberband_filter() -> bool:
    ff = _which_ffmpeg()
    if not ff:
        return False
    r = subprocess.run([ff, "-hide_banner", "-filters"], capture_output=True, text=True)
    out = (r.stdout or "") + (r.stderr or "")
    return "rubberband" in out.lower()


def local_capabilities() -> dict[str, Any]:
    from .pitch_presets import PITCH_PRESETS

    try:
        from .coqui_tts import coqui_available

        coqui_ok = coqui_available()
    except Exception:
        coqui_ok = False

    madmom_ok = False
    try:
        import madmom  # noqa: F401

        madmom_ok = True
    except Exception:
        pass
    return {
        "librosa": True,
        "ffmpeg": _which_ffmpeg() is not None,
        "ffmpeg_rubberband_filter": _ffmpeg_has_rubberband_filter(),
        "pitch_presets": dict(PITCH_PRESETS),
        "pitch_engine_env": "DIETER_PITCH_ENGINE=auto|rubberband|librosa|ffmpeg_ps",
        "pitch_engine_priority_auto": [
            "rubberband",
            "librosa",
            "ffmpeg_ps",
            "original_unshifted",
        ],
        "coqui_tts_installed": coqui_ok,
        "coqui_model_env": "COQUI_TTS_MODEL (default tts_models/en/ljspeech/glow-tts)",
        "madmom_installed": madmom_ok,
        "rvc": {
            "status": "external",
            "hint": "Run RVC-WebUI or the optional Docker service; expose HTTP and call from a future adapter.",
            "repo": "https://github.com/RVC-Project/Retrieval-based-Voice-Conversion-WebUI",
        },
        "tortoise": {
            "status": "external",
            "hint": "Tortoise-TTS for speech; chain with RVC for timbre — sidecar integration.",
            "repo": "https://github.com/neonbjb/tortoise-tts",
        },
    }
