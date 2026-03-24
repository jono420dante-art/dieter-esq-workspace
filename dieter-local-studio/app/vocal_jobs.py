"""
Local vocal generation hooks: RVC + Tortoise-TTS (no cloud).

By default returns structured job info. Wire your installation via env:

- RVC_WEBUI_DIR: path to Retrieval-based-Voice-Conversion-WebUI repo (infer_cli.py)
- TORTOISE_DIR: path to tortoise-tts checkout
- DIETER_ETHICAL_VOICE_DIR: 10–30 min cleaned voice clips for training (user consent)

This module never ships pretrained voice data.
"""

from __future__ import annotations

import os
import subprocess
import uuid
from pathlib import Path
from typing import Any

JOBS: dict[str, dict[str, Any]] = {}


def _job(jid: str, **kw: Any) -> dict[str, Any]:
    JOBS[jid] = {"id": jid, **kw}
    return JOBS[jid]


def create_vocal_job(
    lyrics: str,
    beat_file_id: str,
    voice_profile: str = "default",
) -> dict[str, Any]:
    """
    Queue a local vocal job. Without RVC/Tortoise binaries, status stays 'needs_local_models'.
    """
    jid = f"voc_{uuid.uuid4().hex[:16]}"
    rvc_dir = os.environ.get("RVC_WEBUI_DIR", "").strip()
    tortoise_dir = os.environ.get("TORTOISE_DIR", "").strip()

    if rvc_dir and Path(rvc_dir).is_dir():
        status = "queued"
        message = "RVC WebUI path detected — implement infer_cli call in vocal_jobs.py for your GPU."
    elif tortoise_dir and Path(tortoise_dir).is_dir():
        status = "queued"
        message = "Tortoise path detected — wire read_tts.py / API for your setup."
    else:
        status = "needs_local_models"
        message = (
            "Clone RVC WebUI: git clone https://github.com/RVC-Project/Retrieval-based-Voice-Conversion-WebUI "
            "and set RVC_WEBUI_DIR. Add Tortoise-TTS for lyrics-to-speech, then RVC for singing conversion. "
            "Train only on ethically sourced 10–30 min clips."
        )

    return _job(
        jid,
        status=status,
        message=message,
        lyrics_preview=(lyrics or "")[:200],
        beat_file_id=beat_file_id,
        voice_profile=voice_profile,
        rvc_configured=bool(rvc_dir),
        tortoise_configured=bool(tortoise_dir),
    )


def get_job(jid: str) -> dict[str, Any] | None:
    return JOBS.get(jid)


def run_ffmpeg_mix(
    beat_path: Path,
    vocal_path: Path,
    out_path: Path,
    vocal_gain_db: float = -3.0,
    beat_gain_db: float = -6.0,
) -> dict[str, Any]:
    """Mix beat + vocal stem with FFmpeg (amix). Requires ffmpeg on PATH."""
    out_path.parent.mkdir(parents=True, exist_ok=True)
    # loudnorm optional; simple mixdown
    filter_complex = (
        f"[0:a]volume={beat_gain_db}dB[a0];[1:a]volume={vocal_gain_db}dB[a1];"
        "[a0][a1]amix=inputs=2:duration=longest:dropout_transition=2[aout]"
    )
    cmd = [
        "ffmpeg",
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
    try:
        subprocess.run(cmd, check=True, capture_output=True, text=True)
        return {"ok": True, "path": str(out_path), "message": "mixed"}
    except FileNotFoundError:
        return {"ok": False, "message": "ffmpeg not found on PATH"}
    except subprocess.CalledProcessError as e:
        return {"ok": False, "message": e.stderr or str(e)}
