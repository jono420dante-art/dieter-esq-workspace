"""
Optional “studio” vocal chain on a dry WAV using Spotify `pedalboard`.

Enable when generating: set ``DIETER_VOCAL_PEDALBOARD=1`` and ``pip install pedalboard``.
"""
from __future__ import annotations

from typing import Any

# None = not tried yet; False = import failed; tuple = loaded plugin classes
_pedalboard_mod: Any | bool | None = None
_AudioFile_cls: Any = None


def pedalboard_available() -> bool:
    global _pedalboard_mod
    if _pedalboard_mod is False:
        return False
    if isinstance(_pedalboard_mod, tuple):
        return True
    return _try_import_pedalboard()


def _try_import_pedalboard() -> bool:
    global _pedalboard_mod, _AudioFile_cls
    try:
        from pedalboard import Pedalboard, Compressor, Gain, HighpassFilter, Reverb
        from pedalboard.io import AudioFile

        _pedalboard_mod = (Pedalboard, Compressor, Gain, HighpassFilter, Reverb)
        _AudioFile_cls = AudioFile
        return True
    except ImportError:
        _pedalboard_mod = False
        _AudioFile_cls = None
        return False


def apply_studio_effects(input_wav: str, output_wav: str) -> str:
    """
    Apply a simple vocal chain: HPF → compressor → reverb → gain.

    Input/output are file paths (WAV). Returns ``output_wav``.
    """
    if not pedalboard_available():
        raise RuntimeError("pedalboard is not installed; run: pip install pedalboard")

    Pedalboard, Compressor, Gain, HighpassFilter, Reverb = _pedalboard_mod
    AudioFile = _AudioFile_cls

    with AudioFile(input_wav) as f:
        audio = f.read(f.frames)
        samplerate = f.samplerate

    if audio.ndim == 1:
        audio = audio.reshape(1, -1)

    board = Pedalboard(
        [
            HighpassFilter(cutoff_frequency_hz=150),
            Compressor(threshold_db=-20, ratio=4),
            Reverb(room_size=0.45, wet_level=0.25, dry_level=0.8),
            Gain(gain_db=2),
        ]
    )

    effected = board(audio, samplerate)

    if effected.ndim == 1:
        effected = effected.reshape(1, -1)
    num_channels = int(effected.shape[0])

    with AudioFile(output_wav, "w", samplerate=samplerate, num_channels=num_channels) as f:
        f.write(effected.astype("float32", copy=False))

    return output_wav
