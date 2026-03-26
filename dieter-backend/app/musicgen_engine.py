"""
Optional MusicGen (Audiocraft) lyrics→audio generation.

Enable with ``DIETER_ENABLE_MUSICGEN=1``. First load downloads model weights (large disk/GPU).
"""
from __future__ import annotations

import logging
import os
import uuid
from typing import Optional

logger = logging.getLogger(__name__)

_engine: Optional["DieterMusicEngine"] = None
_load_error: Optional[str] = None


def musicgen_enabled() -> bool:
    return os.environ.get("DIETER_ENABLE_MUSICGEN", "").strip().lower() in (
        "1",
        "true",
        "yes",
        "on",
    )


class DieterMusicEngine:
    def __init__(self) -> None:
        import torch
        from audiocraft.models import MusicGen

        logger.info("Initializing MusicGen (DIETER)")
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        model_id = os.environ.get(
            "DIETER_MUSICGEN_MODEL", "facebook/musicgen-large"
        ).strip()
        self.model = MusicGen.get_pretrained(model_id)
        self.model.set_generation_params(
            duration=30.0,
            use_sampling=True,
            top_k=250,
            cfg_coef=float(os.environ.get("DIETER_MUSICGEN_CFG", "7.0")),
            temperature=1.0,
        )
        self.model.to(self.device)
        logger.info("MusicGen loaded: %s on %s", model_id, self.device)

    def lyrics_to_song(
        self,
        lyrics: str,
        style: str = "pop",
        duration: int = 120,
        *,
        storage_dir,
    ) -> tuple[str, str]:
        """
        Generate WAV under ``storage_dir / 'musicgen' / {job_id}.wav``.

        Returns (job_id, relative_url_path starting with /api/storage/...)
        """
        import torch

        max_d = int(os.environ.get("DIETER_MUSICGEN_MAX_DURATION", "120"))
        duration = max(5, min(int(duration), max_d))
        prompt = (
            f"{style} full song with emotional vocals, structured verses and chorus. "
            f"Lyrics: {lyrics.strip()}"
        )

        self.model.set_generation_params(duration=float(duration))
        with torch.no_grad():
            wav = self.model.generate([prompt], progress=True)[0]
        wav = wav.detach().cpu()
        while wav.dim() > 2:
            wav = wav.squeeze(0)

        job_id = uuid.uuid4().hex[:16]
        out_dir = storage_dir / "musicgen"
        out_dir.mkdir(parents=True, exist_ok=True)
        out_path = out_dir / f"{job_id}.wav"

        try:
            from audiocraft.data.audio import audio_write

            audio_write(
                str(out_path.with_suffix("")),
                wav,
                self.model.sample_rate,
                strategy="loudness",
            )
        except Exception:
            import torchaudio

            torchaudio.save(str(out_path), wav, self.model.sample_rate)

        rel = f"/api/storage/musicgen/{job_id}.wav"
        logger.info("MusicGen wrote %s", out_path)
        return job_id, rel


def get_musicgen_engine():
    """Return singleton engine or None if disabled / import failed."""
    global _engine, _load_error
    if not musicgen_enabled():
        return None
    if _load_error is not None:
        return None
    if _engine is not None:
        return _engine
    try:
        _engine = DieterMusicEngine()
    except Exception as e:
        _load_error = str(e)
        logger.exception("MusicGen failed to load: %s", e)
        return None
    return _engine


def get_musicgen_load_error() -> Optional[str]:
    return _load_error
