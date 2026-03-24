"""
Local TTS / vocal pipeline — placeholders only (no external APIs).

Wire later: Tortoise-TTS, RVC, Bark, etc. All I/O stays on disk or bytes.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass
class TTSRequest:
    text: str
    voice_id: str = "default"
    language: str = "en"


@dataclass
class RVCRequest:
    """Voice conversion: dry vocal → target timbre."""

    input_wav: Path
    model_path: Path
    output_wav: Path


def synthesize_speech_tortoise_placeholder(req: TTSRequest, out_wav: Path) -> dict[str, Any]:
    """
    Placeholder for Tortoise-TTS (or any local TTS).

    Returns metadata; does not call the network. Implement by shelling out
    to your tortoise install or importing their API in-process.
    """
    out_wav = Path(out_wav)
    return {
        "status": "not_implemented",
        "message": "Install Tortoise-TTS locally and implement synthesis here.",
        "would_write": str(out_wav.resolve()),
        "chars": len(req.text),
        "voice_id": req.voice_id,
    }


def convert_voice_rvc_placeholder(req: RVCRequest) -> dict[str, Any]:
    """
    Placeholder for RVC (Retrieval-based Voice Conversion).

    Train models from consented clips; run RVC-WebUI or CLI separately.
    """
    return {
        "status": "not_implemented",
        "message": "Point at RVC inference CLI or HTTP sidecar.",
        "input": str(req.input_wav),
        "model": str(req.model_path),
        "output": str(req.output_wav),
    }


def mix_with_ffmpeg_placeholder(
    beat_path: Path,
    vocal_path: Path,
    out_path: Path,
) -> dict[str, Any]:
    """
    Real mixing belongs in FastAPI (ffmpeg on PATH) or use ffmpeg-python here.

    This stub only documents the contract.
    """
    return {
        "status": "delegate_to_ffmpeg",
        "hint": "Use merge_two_audio_mp3 in app.local_pipeline or subprocess ffmpeg.",
        "beat": str(beat_path),
        "vocal": str(vocal_path),
        "out": str(out_path),
    }


def full_pipeline_stub(lyrics: str, beat_wav: Path, work_dir: Path) -> dict[str, Any]:
    """End-to-end placeholder: lyrics + beat → future vocal + mix."""
    work_dir = Path(work_dir)
    work_dir.mkdir(parents=True, exist_ok=True)
    tts = synthesize_speech_tortoise_placeholder(TTSRequest(text=lyrics), work_dir / "dry.wav")
    rvc = convert_voice_rvc_placeholder(
        RVCRequest(
            input_wav=work_dir / "dry.wav",
            model_path=work_dir / "model.pth",
            output_wav=work_dir / "vocal.wav",
        )
    )
    mix = mix_with_ffmpeg_placeholder(beat_wav, work_dir / "vocal.wav", work_dir / "mix.mp3")
    return {"tts": tts, "rvc": rvc, "mix": mix}
