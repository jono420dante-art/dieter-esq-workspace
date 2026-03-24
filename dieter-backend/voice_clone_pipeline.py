"""
Local "voice clone" lab: Coqui Glow-TTS + librosa F0 hint + simple mix.

This is **not** true Mureka / RVC cloning — it stores a rough F0 profile from the
uploaded sample and uses it to nudge TTS pitch before mixing with the beat.

Requires: TTS, torch, librosa, soundfile (see requirements.txt).
"""

from __future__ import annotations

import io
import json
import logging
import re
import shutil
import uuid
from pathlib import Path
from typing import Any

import numpy as np

logger = logging.getLogger(__name__)

VOICE_LIBRARY: dict[str, dict[str, Any]] = {}

_tts_model: Any = None
_tts_sr: int = 22050


def _get_device() -> str:
    try:
        import torch

        return "cuda" if torch.cuda.is_available() else "cpu"
    except ImportError:
        return "cpu"


def get_coqui_tts() -> tuple[Any, int]:
    """Lazy-load Coqui TTS (same model family as ``main.get_tts_engine``)."""
    global _tts_model, _tts_sr
    if _tts_model is not None:
        return _tts_model, _tts_sr
    from TTS.api import TTS

    model_name = "tts_models/en/ljspeech/glow-tts"
    try:
        engine = TTS(model_name=model_name).to(_get_device())
    except AttributeError:
        import torch

        engine = TTS(model_name=model_name, gpu=torch.cuda.is_available())
    _tts_model = engine
    syn = getattr(engine, "synthesizer", None)
    sr = getattr(syn, "output_sample_rate", None) if syn is not None else None
    _tts_sr = int(sr) if sr else 22050
    logger.info("Coqui TTS loaded for voice-clone pipeline @ %d Hz", _tts_sr)
    return _tts_model, _tts_sr


def _slug(s: str, max_len: int = 24) -> str:
    t = re.sub(r"[^a-zA-Z0-9_]+", "_", (s or "voice").strip())[:max_len]
    return t or "voice"


def _f0_stats(y: np.ndarray, sr: int) -> tuple[float, str]:
    """Median F0 (Hz) from yin + coarse gender label."""
    if len(y) < sr * 0.15:
        return 150.0, "unknown"
    f0 = librosa_yin(y, sr)
    clean = f0[np.isfinite(f0) & (f0 > 0)]
    if len(clean) < 5:
        return 150.0, "unknown"
    med = float(np.median(clean))
    gender = "male" if med < 165 else "female"
    return med, gender


def librosa_yin(y: np.ndarray, sr: int) -> np.ndarray:
    import librosa

    return librosa.yin(
        y.astype(np.float32),
        fmin=librosa.note_to_hz("C2"),
        fmax=librosa.note_to_hz("C6"),
        sr=sr,
        frame_length=2048,
    )


def adjust_pitch_to_target(vocals: np.ndarray, sr: int, target_f0_hz: float) -> np.ndarray:
    """Pitch-shift TTS output toward ``target_f0_hz`` (semitones, clamped)."""
    import librosa

    v = np.asarray(vocals, dtype=np.float32).reshape(-1)
    if len(v) < sr * 0.05 or target_f0_hz <= 0:
        return v
    f0 = librosa_yin(v, sr)
    clean = f0[np.isfinite(f0) & (f0 > 0)]
    if len(clean) < 5:
        return v
    cur = float(np.median(clean))
    if cur < 1e-3:
        return v
    ratio = float(np.clip(target_f0_hz / cur, 0.55, 1.85))
    n_steps = 12.0 * np.log2(ratio)
    n_steps = float(np.clip(n_steps, -10.0, 10.0))
    if abs(n_steps) < 0.35:
        return v
    return librosa.effects.pitch_shift(v, sr=sr, n_steps=n_steps).astype(np.float32)


def _write_beat_temp(beat_bytes: bytes, temp_dir: Path) -> Path:
    """Write bytes to a temp file with an extension librosa can open."""
    import librosa

    for suf in (".mp3", ".wav", ".flac", ".ogg", ".m4a"):
        p = temp_dir / f"beat_{uuid.uuid4().hex[:10]}{suf}"
        p.write_bytes(beat_bytes)
        try:
            y, _sr = librosa.load(str(p), sr=None, mono=True, duration=0.5)
            if len(y) > 0:
                return p
        except Exception:
            pass
        try:
            p.unlink(missing_ok=True)
        except OSError:
            pass
    raise ValueError("Could not decode beat — try WAV or MP3")


def mix_vocal_beat(vocals: np.ndarray, sr_v: int, beat_path: Path, v_weight: float = 0.68) -> np.ndarray:
    import librosa

    v = np.asarray(vocals, dtype=np.float32).reshape(-1)
    b, _ = librosa.load(str(beat_path), sr=sr_v, mono=True)
    L = min(len(v), len(b))
    if L == 0:
        raise ValueError("Empty vocal or beat after load")
    out = v_weight * v[:L] + (1.0 - v_weight) * b[:L]
    peak = float(np.max(np.abs(out))) + 1e-9
    return (out / peak * 0.95).astype(np.float32)


def _voice_registry_path(library_root: Path) -> Path:
    return library_root / "library.json"


def save_voice_registry(library_root: Path) -> None:
    """Persist ``VOICE_LIBRARY`` so voices survive server restarts."""
    library_root.mkdir(parents=True, exist_ok=True)
    path = _voice_registry_path(library_root)
    serializable = {k: dict(v) for k, v in VOICE_LIBRARY.items()}
    path.write_text(json.dumps(serializable, indent=2), encoding="utf-8")


def load_voice_library(library_root: Path) -> int:
    """Load registered voices from disk. Returns number of voices loaded."""
    path = _voice_registry_path(library_root)
    if not path.is_file():
        return 0
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return 0
    n = 0
    for vid, meta in raw.items():
        if not isinstance(meta, dict):
            continue
        sp = meta.get("sample_path")
        if not sp or not Path(sp).is_file():
            continue
        VOICE_LIBRARY[str(vid)] = {
            "sample_path": str(Path(sp).resolve()),
            "f0_mean": float(meta.get("f0_mean") or 150.0),
            "gender": str(meta.get("gender") or "unknown"),
            "voice_name": str(meta.get("voice_name") or "Custom"),
            "sr": int(meta.get("sr") or 22050),
        }
        n += 1
    return n


def clone_voice_from_upload(
    *,
    sample_bytes: bytes,
    voice_name: str,
    temp_dir: Path,
    library_root: Path | None = None,
) -> dict[str, Any]:
    """
    Save sample, estimate F0, register in ``VOICE_LIBRARY``.
    Returns JSON-serializable dict for the API response.
    """
    import librosa

    if len(sample_bytes) < 1024:
        raise ValueError("Voice sample too small")

    temp_dir.mkdir(parents=True, exist_ok=True)
    sid = uuid.uuid4().hex[:12]
    sample_path = temp_dir / f"voice_{sid}.wav"

    # Try decode; keep original bytes if already wav
    try:
        y, sr = librosa.load(io.BytesIO(sample_bytes), sr=22050, mono=True)
    except Exception as e:
        raise ValueError(f"Could not decode audio: {e}") from e

    if len(y) < sr * 0.2:
        raise ValueError("Need at least ~0.2s of audio")

    import soundfile as sf

    sf.write(str(sample_path), y, sr, subtype="PCM_16")

    f0_mean, gender = _f0_stats(y, sr)
    slug = _slug(voice_name)
    voice_id = f"mureka_{slug}_{sid}"

    VOICE_LIBRARY[voice_id] = {
        "sample_path": str(sample_path.resolve()),
        "f0_mean": f0_mean,
        "gender": gender,
        "voice_name": voice_name,
        "sr": sr,
    }

    if library_root is not None:
        samples_dir = library_root / "samples"
        samples_dir.mkdir(parents=True, exist_ok=True)
        final_path = samples_dir / f"{voice_id}.wav"
        try:
            shutil.copy2(sample_path, final_path)
            VOICE_LIBRARY[voice_id]["sample_path"] = str(final_path.resolve())
            try:
                sample_path.unlink(missing_ok=True)
            except OSError:
                pass
            save_voice_registry(library_root)
        except OSError as e:
            logger.warning("Could not persist voice sample to %s: %s", final_path, e)

    return {
        "voice_id": voice_id,
        "f0_mean": f0_mean,
        "gender": gender,
        "status": "registered",
    }


def generate_song_with_clone(
    *,
    voice_id: str,
    lyrics: str,
    beat_bytes: bytes,
    temp_dir: Path,
    output_dir: Path,
    url_prefix: str = "/static",
) -> dict[str, Any]:
    """TTS → pitch nudge → mix with beat → WAV in ``static_dir``."""
    import librosa
    import soundfile as sf

    meta = VOICE_LIBRARY.get(voice_id)
    if not meta:
        raise KeyError("Voice not found")

    text = (lyrics or "").strip()
    if not text:
        raise ValueError("Lyrics required")

    if len(beat_bytes) < 256:
        raise ValueError("Beat file too small")

    tts, sr_tts = get_coqui_tts()
    try:
        wav = tts.tts(text=text)
    except TypeError:
        wav = tts.tts(text)
    if isinstance(wav, list):
        wav = np.concatenate([np.asarray(x, dtype=np.float32).reshape(-1) for x in wav])
    vocals = np.asarray(wav, dtype=np.float32).reshape(-1)

    target_f0 = float(meta.get("f0_mean") or 150.0)
    vocals = adjust_pitch_to_target(vocals, sr_tts, target_f0)

    temp_dir.mkdir(parents=True, exist_ok=True)
    beat_path = _write_beat_temp(beat_bytes, temp_dir)

    mix = mix_vocal_beat(vocals, sr_tts, beat_path)

    output_dir.mkdir(parents=True, exist_ok=True)
    out_name = f"clone_mix_{uuid.uuid4().hex[:12]}.wav"
    out_path = output_dir / out_name
    sf.write(str(out_path), mix, sr_tts, subtype="PCM_16")

    # Cleanup temp beat
    try:
        beat_path.unlink(missing_ok=True)
    except OSError:
        pass

    base = url_prefix.rstrip("/")
    return {
        "song_url": f"{base}/{out_name}",
        "stub": False,
        "voice_id": voice_id,
        "f0_mean_applied": target_f0,
    }


def pipeline_available() -> bool:
    try:
        import TTS  # noqa: F401

        return True
    except ImportError:
        return False
