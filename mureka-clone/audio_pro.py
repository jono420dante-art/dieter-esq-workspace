"""
FFmpeg mastering / mixdown: beat + vocal → MP3 (requires `ffmpeg` on PATH).
"""

from __future__ import annotations

import logging
import subprocess
import shutil
from pathlib import Path

logger = logging.getLogger(__name__)


def _which_ffmpeg() -> str:
    exe = shutil.which("ffmpeg")
    if not exe:
        raise RuntimeError("ffmpeg not found on PATH — install FFmpeg and restart.")
    return exe


def pro_ffmpeg_master(
    beat_file: str | Path,
    vocal_file: str | Path,
    out_file: str | Path,
    *,
    target_length_sec: float | None = 180.0,
    vocal_highpass_hz: int = 80,
    vocal_lowpass_hz: int = 16000,
) -> str:
    """
    Mix instrumental beat with vocal stem, apply broadcast-style chain, export MP3.

    Returns absolute path string to ``out_file``.
    """
    beat_file = Path(beat_file).resolve()
    vocal_file = Path(vocal_file).resolve()
    out_file = Path(out_file).resolve()
    out_file.parent.mkdir(parents=True, exist_ok=True)

    ffmpeg = _which_ffmpeg()

    # Vocal cleanup + gentle EQ + sidechain-ish level via weights in amix
    # Beat: light HPF to avoid mud clash; Vocal: HPF/LPF + compand + EQ + amix with beat
    vf_beat = f"highpass=f={vocal_highpass_hz},lowpass=f={vocal_lowpass_hz}"
    vf_vox = (
        f"highpass=f={vocal_highpass_hz},lowpass=f={vocal_lowpass_hz},"
        "compand=0.3|0.8:6:-70/-60/-20:-20|0.2|0.2,"
        "equalizer=f=200:width_type=q:width=1:gain=2,"
        "equalizer=f=4000:width_type=q:width=1:gain=2"
    )

    # Downmix to stereo fltp @ 44100 for loudnorm
    fc = (
        f"[0:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,{vf_beat}[b];"
        f"[1:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,{vf_vox}[v];"
        "[b][v]amix=inputs=2:duration=longest:weights=1 0.88:normalize=0[mix];"
        "[mix]loudnorm=I=-14:TP=-1.5:LRA=11[out]"
    )

    cmd: list[str] = [
        ffmpeg,
        "-y",
        "-i",
        str(beat_file),
        "-i",
        str(vocal_file),
        "-filter_complex",
        fc,
        "-map",
        "[out]",
        "-ar",
        "44100",
        "-b:a",
        "320k",
        str(out_file),
    ]

    logger.info("Running ffmpeg mix: %s", " ".join(cmd[:6]) + " ...")
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(f"ffmpeg failed ({proc.returncode}): {proc.stderr[-2000:]}")

    # Optional trim + fades (second pass — keeps filter graph simpler)
    if target_length_sec and target_length_sec > 0:
        tl = float(target_length_sec)
        faded = out_file.with_suffix(".faded.mp3")
        fade_st = max(0.0, tl - 3.0)
        af = f"afade=t=in:st=0:d=2,afade=t=out:st={fade_st}:d=3,atrim=0:{tl}"
        cmd2 = [
            ffmpeg,
            "-y",
            "-i",
            str(out_file),
            "-af",
            af,
            "-ar",
            "44100",
            "-b:a",
            "320k",
            str(faded),
        ]
        proc2 = subprocess.run(cmd2, capture_output=True, text=True)
        if proc2.returncode == 0:
            out_file.unlink(missing_ok=True)
            faded.rename(out_file)
        else:
            logger.warning("ffmpeg fade/trim pass failed, keeping unmoved mix: %s", proc2.stderr[-500:])

    return str(out_file)
