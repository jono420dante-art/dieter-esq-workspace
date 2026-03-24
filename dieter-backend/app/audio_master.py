"""
Pro-style mastering: trim, fades, loudness normalize (FFmpeg).
Requires `ffmpeg` and `ffprobe` on PATH.

Typical targets: I=-14 LUFS (streaming), true peak -1 dBTP, LRA 11.
"""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path


def _which_ffmpeg() -> str:
    exe = shutil.which("ffmpeg")
    if not exe:
        raise RuntimeError("ffmpeg not found on PATH")
    return exe


def _which_ffprobe() -> str:
    exe = shutil.which("ffprobe")
    if not exe:
        raise RuntimeError("ffprobe not found on PATH")
    return exe


def ffprobe_duration_seconds(path: str | Path) -> float:
    cmd = [
        _which_ffprobe(),
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        str(path),
    ]
    r = subprocess.run(cmd, capture_output=True, text=True, check=True)
    return float(r.stdout.strip())


def ffprobe_sample_rate(path: str | Path) -> int:
    """First audio stream sample rate (Hz)."""
    cmd = [
        _which_ffprobe(),
        "-v",
        "error",
        "-select_streams",
        "a:0",
        "-show_entries",
        "stream=sample_rate",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        str(path),
    ]
    r = subprocess.run(cmd, capture_output=True, text=True, check=True)
    return int(round(float(r.stdout.strip())))


def pro_master_audio(
    input_file: str | Path,
    output_file: str | Path = "mastered.mp3",
    *,
    max_duration_sec: float = 180.0,
    fade_in_sec: float = 2.0,
    fade_out_sec: float = 3.0,
    loudnorm_i: float = -14.0,
    loudnorm_tp: float = -1.0,
    loudnorm_lra: float = 11.0,
    sample_rate: int = 44100,
    bitrate: str = "320k",
) -> Path:
    """
    Fade in + fade out + trim to max_duration + EBU R128-style loudnorm + high-quality MP3.

    ``-af`` must contain only filters; codec/bitrate/sample-rate are separate argv entries
    (your original snippet incorrectly placed ``-ar`` / ``-b:a`` inside ``-af``).
    """
    inp = Path(input_file)
    out = Path(output_file)
    out.parent.mkdir(parents=True, exist_ok=True)

    if not inp.is_file():
        raise FileNotFoundError(inp)

    dur = ffprobe_duration_seconds(inp)
    trim_len = min(dur, max_duration_sec)

    # Avoid overlapping fades on very short clips
    fi = min(fade_in_sec, trim_len * 0.2)
    fo = min(fade_out_sec, trim_len * 0.2)
    if trim_len < 0.5:
        fi, fo = 0.05, 0.05
    fade_out_start = max(fi, trim_len - fo)

    filters = ",".join(
        [
            f"atrim=0:{trim_len:.6f}",
            f"afade=t=in:st=0:d={fi:.6f}",
            f"afade=t=out:st={fade_out_start:.6f}:d={fo:.6f}",
            f"loudnorm=I={loudnorm_i}:TP={loudnorm_tp}:LRA={loudnorm_lra}",
        ]
    )

    cmd = [
        _which_ffmpeg(),
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        str(inp),
        "-af",
        filters,
        "-ar",
        str(sample_rate),
        "-c:a",
        "libmp3lame",
        "-b:a",
        bitrate,
        str(out),
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(r.stderr or r.stdout or "ffmpeg failed")
    return out


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python -m app.audio_master <input_audio> [output.mp3]", file=sys.stderr)
        sys.exit(1)
    inp = sys.argv[1]
    outp = sys.argv[2] if len(sys.argv) > 2 else "mastered.mp3"
    p = pro_master_audio(inp, outp)
    print(f"Pro mastered: {p}")
