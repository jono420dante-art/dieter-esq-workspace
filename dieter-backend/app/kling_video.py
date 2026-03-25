"""
Kling-family AI video via AI/ML API (AIMLAPI) — same flow as Kling 2.6 Pro text-to-video.

Set ``AIMLAPI_KEY`` or ``KLING_API_KEY``. Optional ``KLING_VIDEO_MODEL`` (default
``klingai/video-v2-6-pro-text-to-video``). When Kling 3.0 ids ship from your provider,
point ``KLING_VIDEO_MODEL`` at the new model string.

Pipeline: text-to-video clip (``generate_audio=false``) → loop clip to song length →
mux **your** mastered/generate audio so the release is in sync with a beat-aware prompt.
"""

from __future__ import annotations

import json
import logging
import os
import shutil
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Literal, Optional

logger = logging.getLogger(__name__)

DurationSec = Literal[5, 10]
AspectRatio = Literal["16:9", "9:16", "1:1"]


def aiml_api_config() -> tuple[str, str, str]:
    key = (os.environ.get("AIMLAPI_KEY") or os.environ.get("KLING_API_KEY") or "").strip()
    base = (
        os.environ.get("AIMLAPI_BASE", "https://api.aimlapi.com/v2").strip().rstrip("/")
    )
    model = (
        os.environ.get("KLING_VIDEO_MODEL", "klingai/video-v2-6-pro-text-to-video")
        .strip()
    )
    return key, base, model


def kling_configured() -> bool:
    return bool(aiml_api_config()[0])


def _post_json(url: str, headers: dict[str, str], body: dict[str, Any]) -> dict[str, Any]:
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        url, data=data, headers=headers, method="POST"
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _get_json(url: str, headers: dict[str, str]) -> dict[str, Any]:
    req = urllib.request.Request(url, headers=headers, method="GET")
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))


def create_text_to_video_task(
    *,
    prompt: str,
    aspect_ratio: AspectRatio = "16:9",
    duration_sec: DurationSec = 10,
    negative_prompt: str = "",
    generate_audio: bool = False,
    cfg_scale: Optional[float] = None,
) -> dict[str, Any]:
    key, base, model = aiml_api_config()
    if not key:
        raise RuntimeError("Set AIMLAPI_KEY or KLING_API_KEY for Kling-class video.")
    url = f"{base}/video/generations"
    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    body: dict[str, Any] = {
        "model": model,
        "prompt": prompt[:2500],
        "aspect_ratio": aspect_ratio,
        "duration": int(duration_sec),
        "generate_audio": bool(generate_audio),
    }
    if negative_prompt.strip():
        body["negative_prompt"] = negative_prompt[:2000]
    if cfg_scale is not None and 0 <= cfg_scale <= 1:
        body["cfg_scale"] = float(cfg_scale)
    try:
        return _post_json(url, headers, body)
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(err or f"AIMLAPI HTTP {e.code}") from e


def poll_generation(generation_id: str, *, timeout_sec: float = 900.0, interval_sec: float = 15.0) -> dict[str, Any]:
    key, base, _ = aiml_api_config()
    if not key:
        raise RuntimeError("Missing AIMLAPI_KEY / KLING_API_KEY")
    gid = urllib.parse.quote(generation_id, safe="")
    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    deadline = time.time() + timeout_sec
    last: dict[str, Any] = {}
    while time.time() < deadline:
        url = f"{base}/video/generations?generation_id={gid}"
        try:
            last = _get_json(url, headers)
        except urllib.error.HTTPError as e:
            err = e.read().decode("utf-8", errors="replace")
            raise RuntimeError(err or f"poll HTTP {e.code}") from e
        status = (last.get("status") or "").lower()
        if status in ("completed", "error", "failed"):
            return last
        time.sleep(interval_sec)
    raise TimeoutError(f"Kling/AIML poll timeout after {timeout_sec}s: {last!r}")


def download_video(url: str, dest: Path) -> Path:
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, method="GET")
    with urllib.request.urlopen(req, timeout=300) as resp:
        dest.write_bytes(resp.read())
    return dest


def loop_video_and_mux_audio(
    video_clip: Path,
    audio_track: Path,
    out_mp4: Path,
) -> Path:
    ff = shutil.which("ffmpeg")
    if not ff:
        raise RuntimeError("ffmpeg not found on PATH")
    out_mp4.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        ff,
        "-hide_banner",
        "-y",
        "-stream_loop",
        "-1",
        "-i",
        str(video_clip),
        "-i",
        str(audio_track),
        "-map",
        "0:v:0",
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
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-shortest",
        "-movflags",
        "+faststart",
        str(out_mp4),
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        err = (r.stderr or r.stdout or "").strip()
        raise RuntimeError(err or "ffmpeg mux failed")
    return out_mp4


def build_kling_prompt_from_song(
    *,
    style: str,
    title: str,
    lyrics: str,
    bpm: float,
    beat_count: int,
) -> str:
    """Scene prompt: beat-aware copy for the video model (no on-screen lyrics)."""
    snippet = " ".join((lyrics or "").replace("\n", " ").split())[:400]
    mood = f"{style}. Song ~{bpm:.0f} BPM, {beat_count} beats detected — cuts and motion feel rhythmic and cinematic."
    parts = [
        f"Music video visuals for track titled «{title.strip() or 'Untitled'}».",
        mood,
        "Abstract cinematic lighting, fluid camera, emotional performance energy, high production value.",
        "No readable text, no subtitles, no logos.",
    ]
    if snippet:
        parts.insert(2, f"Mood inspired by lyrics (do not display text): {snippet}")
    prompt = " ".join(parts)
    return prompt[:2500]


def maybe_post_colab_webhook(payload: dict[str, Any]) -> None:
    url = (os.environ.get("COLAB_VIDEO_WEBHOOK_URL") or "").strip()
    if not url:
        return
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        urllib.request.urlopen(req, timeout=12)
    except Exception:
        logger.warning("COLAB_VIDEO_WEBHOOK_URL post failed", exc_info=True)
