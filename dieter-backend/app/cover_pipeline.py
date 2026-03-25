from __future__ import annotations

import math
import os
import re
import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

import numpy as np


Instrument = Literal["electric_guitar", "violin", "brushed_snare", "synth_pluck", "sine_pad"]


@dataclass(frozen=True)
class CoverRender:
    wav_path: Path
    sample_rate: int
    seconds: float
    meta: dict[str, Any]


def _which_ffmpeg() -> str:
    exe = shutil.which("ffmpeg")
    if not exe:
        raise RuntimeError("ffmpeg not found on PATH — install ffmpeg and retry.")
    return exe


def _sanitize_name(s: str, max_len: int = 48) -> str:
    t = re.sub(r"[^a-zA-Z0-9_\\-]+", "_", (s or "").strip())[:max_len]
    return t or "audio"


def decode_to_wav(
    in_bytes: bytes,
    *,
    suffix: str,
    out_dir: Path,
    target_sr: int = 48000,
    mono: bool = True,
) -> Path:
    """
    Decode arbitrary audio bytes via ffmpeg into WAV PCM (target_sr, mono/stereo).
    """
    out_dir.mkdir(parents=True, exist_ok=True)
    fd, tmp_in = tempfile.mkstemp(suffix=suffix or ".bin", dir=str(out_dir))
    os.close(fd)
    in_path = Path(tmp_in)
    in_path.write_bytes(in_bytes)

    out_path = out_dir / f"{in_path.stem}_decoded.wav"
    ff = shutil.which("ffmpeg")
    if ff:
        ac = "1" if mono else "2"
        cmd = [
            ff,
            "-y",
            "-i",
            str(in_path),
            "-vn",
            "-ac",
            ac,
            "-ar",
            str(int(target_sr)),
            "-f",
            "wav",
            str(out_path),
        ]
        p = subprocess.run(cmd, capture_output=True, text=True)
        try:
            in_path.unlink(missing_ok=True)
        except OSError:
            pass
        if p.returncode != 0 or not out_path.is_file():
            raise RuntimeError((p.stderr or p.stdout or "ffmpeg decode failed").strip())
        return out_path

    # Fallback (no ffmpeg): only works for already-decodable formats (typically WAV).
    try:
        import soundfile as sf

        y, sr = sf.read(str(in_path), always_2d=False)
        if isinstance(y, np.ndarray) and y.ndim == 2:
            y = np.mean(y, axis=1)
        y = np.asarray(y, dtype=np.float32)
        # crude resample if needed (linear)
        if int(sr) != int(target_sr):
            x = np.linspace(0.0, 1.0, num=len(y), dtype=np.float32)
            xp = np.linspace(0.0, 1.0, num=int(len(y) * (float(target_sr) / float(sr))), dtype=np.float32)
            y = np.interp(xp, x, y).astype(np.float32)
        sf.write(str(out_path), y, int(target_sr), subtype="PCM_16")
        return out_path
    finally:
        try:
            in_path.unlink(missing_ok=True)
        except OSError:
            pass


def load_audio_mono(path: Path) -> tuple[np.ndarray, int]:
    import soundfile as sf

    y, sr = sf.read(str(path), always_2d=False)
    if isinstance(y, np.ndarray) and y.ndim == 2:
        y = np.mean(y, axis=1)
    y = np.asarray(y, dtype=np.float32)
    return y, int(sr)


def estimate_f0(y: np.ndarray, sr: int, *, hop_length: int = 256) -> tuple[np.ndarray, int]:
    """
    Return f0 array per frame (Hz) and hop_length.
    Uses librosa.pyin when available; falls back to librosa.yin.
    """
    import librosa

    f0 = None
    try:
        f0, _voiced, _prob = librosa.pyin(
            y,
            fmin=librosa.note_to_hz("C2"),
            fmax=librosa.note_to_hz("C6"),
            sr=sr,
            hop_length=hop_length,
        )
    except Exception:
        f0 = None
    if f0 is None:
        try:
            f0 = librosa.yin(
                y,
                fmin=librosa.note_to_hz("C2"),
                fmax=librosa.note_to_hz("C6"),
                sr=sr,
                hop_length=hop_length,
            )
        except Exception:
            f0 = None
    if f0 is None:
        raise RuntimeError("Could not estimate pitch (F0) from this clip.")
    f0 = np.asarray(f0, dtype=np.float32)
    # Fill gaps
    if np.isnan(f0).any():
        idx = np.arange(len(f0))
        good = np.isfinite(f0) & (f0 > 0)
        if good.sum() >= 4:
            f0[~good] = np.interp(idx[~good], idx[good], f0[good])
        else:
            f0 = np.nan_to_num(f0, nan=0.0)
    return f0, hop_length


def _rms_envelope(y: np.ndarray, sr: int, *, hop_length: int = 256) -> np.ndarray:
    import librosa

    rms = librosa.feature.rms(y=y, frame_length=hop_length * 4, hop_length=hop_length, center=True)[0]
    rms = np.asarray(rms, dtype=np.float32)
    if rms.size:
        rms /= float(np.max(rms) + 1e-6)
    return rms


def _upsample_env(env: np.ndarray, target_len: int) -> np.ndarray:
    if env.size <= 1:
        return np.ones((target_len,), dtype=np.float32)
    x = np.linspace(0.0, 1.0, num=env.size, dtype=np.float32)
    xp = np.linspace(0.0, 1.0, num=target_len, dtype=np.float32)
    return np.interp(xp, x, env).astype(np.float32)


def _hz_to_phase_inc(hz: np.ndarray, sr: int) -> np.ndarray:
    return (2.0 * math.pi * hz / float(sr)).astype(np.float32)


def _karplus_strong(note_hz: float, sr: int, dur_s: float, *, seed: int) -> np.ndarray:
    rng = np.random.default_rng(seed)
    n = int(max(1, dur_s * sr))
    if note_hz <= 0:
        return np.zeros((n,), dtype=np.float32)
    period = int(max(2, min(sr // 40, sr / note_hz)))
    buf = rng.uniform(-1.0, 1.0, size=period).astype(np.float32)
    out = np.zeros((n,), dtype=np.float32)
    damp = 0.996
    for i in range(n):
        out[i] = buf[i % period]
        nxt = damp * 0.5 * (buf[i % period] + buf[(i + 1) % period])
        buf[i % period] = nxt
    return out


def _synth_from_f0(
    f0_frame: np.ndarray,
    *,
    sr: int,
    hop_length: int,
    instrument: Instrument,
    seed: int,
) -> np.ndarray:
    rng = np.random.default_rng(seed)
    # Expand f0 to sample-rate
    frames = f0_frame.astype(np.float32)
    # Some inputs can have zeros; clamp to avoid NaNs
    frames = np.where(frames > 1.0, frames, 0.0)
    n_samples = int(max(1, len(frames) * hop_length))
    hz = np.repeat(frames, hop_length)[:n_samples]
    t = np.arange(n_samples, dtype=np.float32) / float(sr)

    if instrument in ("violin", "sine_pad"):
        vib = 5.5 + rng.uniform(-0.4, 0.4)
        vib_depth = 0.004 + rng.uniform(0.0, 0.003)
        hz2 = hz * (1.0 + vib_depth * np.sin(2.0 * math.pi * vib * t))
        inc = _hz_to_phase_inc(np.where(hz2 > 0, hz2, 0.0), sr)
        phase = np.cumsum(inc)
        saw = 2.0 * ((phase / (2.0 * math.pi)) % 1.0) - 1.0
        base = saw if instrument == "violin" else np.sin(phase)
        # gentle brightness
        out = 0.75 * base + 0.18 * np.sin(2.0 * phase) + 0.08 * np.sin(3.0 * phase)
        return out.astype(np.float32)

    if instrument in ("electric_guitar", "synth_pluck"):
        # crude note segmentation from f0 changes
        f = frames
        df = np.abs(np.diff(f, prepend=f[:1]))
        on = (df > 7.0) & (f > 20.0)
        # ensure some triggers
        if on.sum() < 3:
            on[:] = False
            on[:: max(1, len(on) // 24)] = True

        out = np.zeros((n_samples,), dtype=np.float32)
        for i, trig in enumerate(on):
            if not trig:
                continue
            hz0 = float(f[i])
            start = i * hop_length
            dur = min(0.25 + rng.uniform(0.0, 0.35), (n_samples - start) / sr)
            if dur <= 0:
                continue
            if instrument == "electric_guitar":
                note = _karplus_strong(hz0, sr, dur, seed=int(seed + i * 17))
            else:
                # synth pluck: sine with fast decay
                n = int(dur * sr)
                tt = np.arange(n, dtype=np.float32) / float(sr)
                note = np.sin(2.0 * math.pi * hz0 * tt).astype(np.float32)
                note *= np.exp(-tt * (9.0 + rng.uniform(0, 4.0))).astype(np.float32)
            end = min(n_samples, start + note.shape[0])
            out[start:end] += note[: end - start]
        return out

    # brushed snare: onset-driven noise bursts (use f0 energy)
    out = rng.normal(0.0, 0.25, size=n_samples).astype(np.float32)
    # simple band-limit via moving average
    k = 8
    out = np.convolve(out, np.ones((k,), dtype=np.float32) / float(k), mode="same").astype(np.float32)
    return out


def render_cover_two_takes(
    decoded_wav: Path,
    *,
    out_dir: Path,
    instrument: Instrument,
    style_prompt: str = "",
    harmony: Instrument | None = None,
    harmony_semitones: float = 4.0,
    seed: int = 1337,
) -> tuple[CoverRender, CoverRender]:
    y, sr = load_audio_mono(decoded_wav)
    if y.size < sr * 0.2:
        raise ValueError("Clip too short (need at least ~0.2s).")

    hop = 256
    f0, hop = estimate_f0(y, sr, hop_length=hop)
    env = _rms_envelope(y, sr, hop_length=hop)
    env_s = _upsample_env(env, int(len(f0) * hop))

    # Resample f0/envelope to 48k domain via simple repeat ratio
    target_sr = 48000
    ratio = float(target_sr) / float(sr)
    n_out = int(len(env_s) * ratio)
    env_out = _upsample_env(env_s, n_out)
    # upsample frames f0 for synth: keep frame count but scale hop length by ratio
    hop_out = int(max(1, hop * ratio))

    def _one_take(tseed: int) -> CoverRender:
        base = _synth_from_f0(f0, sr=target_sr, hop_length=hop_out, instrument=instrument, seed=tseed)
        base = base[:n_out] if base.shape[0] >= n_out else np.pad(base, (0, n_out - base.shape[0]))

        layers = [base]
        meta: dict[str, Any] = {"instrument": instrument, "seed": tseed, "style": (style_prompt or "")[:240]}

        if harmony:
            # shift f0 by semitones for harmony
            f0_h = f0 * (2.0 ** (float(harmony_semitones) / 12.0))
            harm = _synth_from_f0(f0_h.astype(np.float32), sr=target_sr, hop_length=hop_out, instrument=harmony, seed=tseed + 991)
            harm = harm[:n_out] if harm.shape[0] >= n_out else np.pad(harm, (0, n_out - harm.shape[0]))
            layers.append(0.7 * harm)
            meta["harmony"] = {"instrument": harmony, "semitones": float(harmony_semitones)}

        out = np.sum(np.stack(layers, axis=0), axis=0)
        # Apply rhythm envelope from original
        out *= (0.25 + 0.75 * env_out).astype(np.float32)
        # soft clip
        out = np.tanh(out * 1.15).astype(np.float32)
        # -6 dB default headroom
        out *= 0.5

        out_dir.mkdir(parents=True, exist_ok=True)
        import soundfile as sf

        name = _sanitize_name(f"{instrument}_{tseed}")
        wav_path = out_dir / f"cover_{name}.wav"
        sf.write(str(wav_path), out, target_sr, subtype="PCM_16")
        return CoverRender(wav_path=wav_path, sample_rate=target_sr, seconds=float(out.shape[0] / target_sr), meta=meta)

    return _one_take(seed), _one_take(seed + 1)


def mix_parallel(
    *,
    original_wav: Path,
    cover_wav: Path,
    out_path: Path,
    original_gain_db: float = 0.0,
    cover_gain_db: float = -6.0,
    cover_blend: float = 0.3,
) -> Path:
    """
    Parallel blend: output = orig*gain + cover*(blend*gain).
    """
    oy, osr = load_audio_mono(original_wav)
    cy, csr = load_audio_mono(cover_wav)
    if osr != csr:
        raise ValueError("Sample rate mismatch in mix_parallel (expected equal sr).")
    n = max(len(oy), len(cy))
    if len(oy) < n:
        oy = np.pad(oy, (0, n - len(oy)))
    if len(cy) < n:
        cy = np.pad(cy, (0, n - len(cy)))

    og = 10.0 ** (float(original_gain_db) / 20.0)
    cg = 10.0 ** (float(cover_gain_db) / 20.0)
    blend = float(max(0.0, min(1.0, cover_blend)))

    out = og * oy + (blend * cg) * cy
    out = np.tanh(out * 1.2).astype(np.float32)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    import soundfile as sf

    sf.write(str(out_path), out, osr, subtype="PCM_16")
    return out_path

