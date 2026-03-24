from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Tuple

from .synth import TrackStats, render_multitrack_wav


@dataclass(frozen=True)
class EngineResult:
    mix_path: Path
    stem_paths: Dict[str, Path]
    stats: Dict[str, TrackStats]


class AudioEngine:
    """
    Adapter interface for local generation backends.

    Today: procedural fallback engine (always available).
    Next: MusicGen/AudioCraft, custom checkpoints, etc.
    """

    name: str = "base"

    def generate(
        self,
        *,
        out_dir: Path,
        prompt: str,
        lyrics: str,
        language: str,
        vocal_preset: str,
        bpm: int,
        duration_s: int,
        seed: int,
        render_stems: bool,
    ) -> EngineResult:
        raise NotImplementedError


class ProceduralFallbackEngine(AudioEngine):
    name = "procedural_fallback"

    def generate(
        self,
        *,
        out_dir: Path,
        prompt: str,
        lyrics: str,
        language: str,
        vocal_preset: str,
        bpm: int,
        duration_s: int,
        seed: int,
        render_stems: bool,
    ) -> EngineResult:
        mix_path, stem_paths, stats = render_multitrack_wav(
            out_dir=out_dir,
            prompt=prompt,
            lyrics=lyrics or "",
            language=language or "en",
            vocal_preset=vocal_preset or "Radio",
            bpm=bpm,
            duration_s=duration_s,
            seed=seed,
            render_stems=render_stems,
        )
        return EngineResult(mix_path=mix_path, stem_paths=stem_paths, stats=stats)


class AudioCraftMusicGenEngine(AudioEngine):
    """
    Placeholder adapter for MusicGen/AudioCraft.

    When you install dependencies + models locally, this can switch on via env:
    DIETER_AUDIO_ENGINE=audiocraft
    """

    name = "audiocraft_musicgen"

    def generate(self, **kwargs) -> EngineResult:  # type: ignore[override]
        # We keep this as a stub to avoid heavyweight deps in the repo by default.
        raise RuntimeError(
            "AudioCraft/MusicGen engine not installed. "
            "Install audiocraft + torch, then implement AudioCraftMusicGenEngine.generate(). "
            "For now DIETER uses the procedural fallback engine."
        )


def get_engine(engine_name: str) -> AudioEngine:
    key = (engine_name or "").strip().lower()
    if key in ("audiocraft", "musicgen", "audiocraft_musicgen"):
        return AudioCraftMusicGenEngine()
    return ProceduralFallbackEngine()

