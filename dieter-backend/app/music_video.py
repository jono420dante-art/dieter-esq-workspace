"""
Beat-reactive waveform video (FFmpeg only — HeyGen/MAIVE-style AI clips are separate).

``showwaves`` builds a video from the audio; optional ``drawbox`` flashes on each beat time.
Requires ``ffmpeg`` on PATH.
"""

from __future__ import annotations

import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Sequence

from .audio_master import ffprobe_duration_seconds


def _which_ffmpeg() -> str:
    exe = shutil.which("ffmpeg")
    if not exe:
        raise RuntimeError("ffmpeg not found on PATH")
    return exe


def _subsample_beats(beats: Sequence[float], max_beats: int) -> list[float]:
    b = sorted(float(x) for x in beats if x >= 0)
    if len(b) <= max_beats:
        return b
    if max_beats <= 1:
        return [b[len(b) // 2]]
    n = len(b)
    seen: set[float] = set()
    out: list[float] = []
    for i in range(max_beats):
        idx = int(round(i * (n - 1) / (max_beats - 1)))
        idx = max(0, min(n - 1, idx))
        val = b[idx]
        key = round(val, 4)
        if key not in seen:
            seen.add(key)
            out.append(val)
    return out


def build_beat_reactive_filter(
    beats: Sequence[float],
    duration_sec: float,
    *,
    width: int = 1920,
    height: int = 1080,
    flash_sec: float = 0.07,
    max_beats: int = 150,
    wave_rate: int = 30,
) -> tuple[str, str]:
    """
    Build filter_complex text and the final video label (e.g. ``v42``).
    Commas inside ``between(t,...)`` are escaped for FFmpeg filter syntax.
    """
    w, h = int(width), int(height)
    if w < 16 or h < 16:
        raise ValueError("width/height too small")
    flash = max(0.02, min(0.25, float(flash_sec)))
    dur = max(0.1, float(duration_sec))

    b = _subsample_beats(beats, max_beats)
    b = [t for t in b if t < dur - 0.01]

    lines: list[str] = [
        f"[0:a]showwaves=s={w}x{h}:mode=cline:colors=0x00ff66|0xff00ff:"
        f"rate={wave_rate},format=yuv420p[v0];"
    ]
    cur = "v0"
    for i, bt in enumerate(b, start=1):
        t0 = max(0.0, bt)
        t1 = min(dur, t0 + flash)
        if t1 <= t0 + 1e-6:
            continue
        nxt = f"v{i}"
        # Commas inside between() must be escaped in filter graphs
        en = f"between(t\\,{t0:.6f}\\,{t1:.6f})"
        lines.append(
            f"[{cur}]drawbox=x=0:y=0:w=iw:h=ih:color=white@0.18:thickness=fill:enable='{en}'[{nxt}];"
        )
        cur = nxt

    return "\n".join(lines), cur


def build_image_beat_filter(
    beats: Sequence[float],
    duration_sec: float,
    *,
    width: int = 1920,
    height: int = 1080,
    flash_sec: float = 0.07,
    max_beats: int = 150,
) -> tuple[str, str]:
    """Scale/pad a looping still image (``[0:v]``) and optionally flash on beats — audio is input ``1``."""
    w, h = int(width), int(height)
    if w < 16 or h < 16:
        raise ValueError("width/height too small")
    flash = max(0.02, min(0.25, float(flash_sec)))
    dur = max(0.1, float(duration_sec))

    b = _subsample_beats(beats, max_beats)
    b = [t for t in b if t < dur - 0.01]

    lines: list[str] = [
        f"[0:v]scale={w}:{h}:force_original_aspect_ratio=decrease,"
        f"pad={w}:{h}:(ow-iw)/2:(oh-ih)/2,format=yuv420p[v0];"
    ]
    cur = "v0"
    for i, bt in enumerate(b, start=1):
        t0 = max(0.0, bt)
        t1 = min(dur, t0 + flash)
        if t1 <= t0 + 1e-6:
            continue
        nxt = f"v{i}"
        en = f"between(t\\,{t0:.6f}\\,{t1:.6f})"
        lines.append(
            f"[{cur}]drawbox=x=0:y=0:w=iw:h=ih:color=white@0.18:thickness=fill:enable='{en}'[{nxt}];"
        )
        cur = nxt

    return "\n".join(lines), cur


def generate_image_music_video(
    image_file: str | Path,
    song_file: str | Path,
    beats: Sequence[float],
    out_file: str | Path,
    *,
    width: int = 1920,
    height: int = 1080,
    flash_sec: float = 0.07,
    max_beats: int = 150,
) -> Path:
    """
    Still image (cover art) scaled to frame + full-length audio; optional beat flashes.
    Inputs: ``-loop 1`` image, then audio (map ``1:a``).
    """
    img = Path(image_file)
    inp = Path(song_file)
    out = Path(out_file)
    out.parent.mkdir(parents=True, exist_ok=True)
    if not img.is_file():
        raise FileNotFoundError(img)
    if not inp.is_file():
        raise FileNotFoundError(inp)

    dur = ffprobe_duration_seconds(inp)
    filt, vlabel = build_image_beat_filter(
        beats,
        dur,
        width=width,
        height=height,
        flash_sec=flash_sec,
        max_beats=max_beats,
    )
    ff = _which_ffmpeg()

    with tempfile.NamedTemporaryFile(
        mode="w",
        suffix=".txt",
        delete=False,
        encoding="utf-8",
        newline="\n",
    ) as tf:
        tf.write(filt)
        script_path = tf.name

    try:
        cmd = [
            ff,
            "-hide_banner",
            "-y",
            "-loop",
            "1",
            "-i",
            str(img),
            "-i",
            str(inp),
            "-filter_complex_script",
            script_path,
            "-map",
            f"[{vlabel}]",
            "-map",
            "1:a:0",
            "-c:v",
            "libx264",
            "-preset",
            "fast",
            "-crf",
            "20",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-shortest",
            str(out),
        ]
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode != 0:
            err = (r.stderr or r.stdout or "").strip()
            raise RuntimeError(err or "ffmpeg failed image music video")
    finally:
        Path(script_path).unlink(missing_ok=True)

    return out


def generate_music_video(
    song_file: str | Path,
    beats: Sequence[float],
    out_file: str | Path,
    *,
    width: int = 1920,
    height: int = 1080,
    flash_sec: float = 0.07,
    max_beats: int = 150,
) -> Path:
    """
    Render a beat-flashed waveform MP4 (H.264 + AAC), suitable for YouTube/TikTok upload.

    ``beats`` should be times in **seconds** (e.g. from librosa ``beat_times_seconds``).
    """
    inp = Path(song_file)
    out = Path(out_file)
    out.parent.mkdir(parents=True, exist_ok=True)
    if not inp.is_file():
        raise FileNotFoundError(inp)

    dur = ffprobe_duration_seconds(inp)
    filt, vlabel = build_beat_reactive_filter(
        beats,
        dur,
        width=width,
        height=height,
        flash_sec=flash_sec,
        max_beats=max_beats,
    )
    ff = _which_ffmpeg()

    with tempfile.NamedTemporaryFile(
        mode="w",
        suffix=".txt",
        delete=False,
        encoding="utf-8",
        newline="\n",
    ) as tf:
        tf.write(filt)
        script_path = tf.name

    try:
        cmd = [
            ff,
            "-hide_banner",
            "-y",
            "-i",
            str(inp),
            "-filter_complex_script",
            script_path,
            "-map",
            f"[{vlabel}]",
            "-map",
            "0:a",
            "-c:v",
            "libx264",
            "-preset",
            "fast",
            "-crf",
            "20",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-shortest",
            str(out),
        ]
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode != 0:
            err = (r.stderr or r.stdout or "").strip()
            raise RuntimeError(err or "ffmpeg failed generating music video")
    finally:
        Path(script_path).unlink(missing_ok=True)

    return out
