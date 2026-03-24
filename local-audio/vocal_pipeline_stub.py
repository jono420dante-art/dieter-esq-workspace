"""
Stub for local TTS / voice conversion (RVC, Tortoise-TTS, etc.).
No external APIs — wire real models here when GPU + weights are ready.

Ethical note: only train/convert voices you have rights to use.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any


def synthesize_speech_placeholder(text: str, voice_id: str = "default") -> Path:
    """
    Placeholder: would call Tortoise-TTS or similar.
    Returns path to a dummy marker file for pipeline testing.
    """
    out = Path("_stub_tts_output.txt")
    out.write_text(f"# TTS stub\nvoice={voice_id}\n{text[:500]!r}\n", encoding="utf-8")
    return out


def convert_voice_rvc_placeholder(
    source_wav: Path,
    rvc_model_path: Path,
    output_wav: Path,
) -> Path:
    """
    Placeholder: would run RVC inference (Retrieval-based Voice Conversion).
    """
    output_wav.parent.mkdir(parents=True, exist_ok=True)
    output_wav.write_text(
        f"# RVC stub\nsource={source_wav}\nmodel={rvc_model_path}\n",
        encoding="utf-8",
    )
    return output_wav


def mix_vocal_with_instrumental_placeholder(
    vocal_wav: Path,
    instrumental_wav: Path,
    output_wav: Path,
    ffmpeg_args: dict[str, Any] | None = None,
) -> Path:
    """
    Placeholder: would use ffmpeg-python or subprocess to mux/mix.
    Real implementation: ffmpeg filter_complex for levels, sync offset from beat_times.
    """
    output_wav.parent.mkdir(parents=True, exist_ok=True)
    output_wav.write_text(
        f"# mix stub\nvocal={vocal_wav}\ninst={instrumental_wav}\nargs={ffmpeg_args!r}\n",
        encoding="utf-8",
    )
    return output_wav


def full_pipeline_stub(lyrics: str, beat_audio_path: Path, style: str) -> dict[str, Any]:
    """
    End-to-end placeholder matching the product flow:
    lyrics + reference beat + style -> (future) vocals + sync + export.
    """
    return {
        "status": "stub",
        "lyrics_preview": lyrics[:200],
        "beat": str(beat_audio_path),
        "style": style,
        "next_steps": [
            "Implement Tortoise-TTS (or piper/coqui) for lyrics->wav",
            "Implement RVC for timbre conversion",
            "Use beat_detect.detect_beats() for alignment",
            "Use ffmpeg-python for final mix and stem export",
        ],
    }


if __name__ == "__main__":
    demo = full_pipeline_stub(
        "Hello from the stub pipeline",
        Path("beat.mp3"),
        "melodic trap",
    )
    print(demo)
