"""
Integration checks: beat detection, lyric↔beat plan, mixer, optional full Bark+RVC path.

Run from ``backend/``:
  pytest tests/test_integration.py -v

Heavy checks (Bark GPU/RAM) are skipped unless ``RUN_BARK_INTEGRATION=1``.
"""
from __future__ import annotations

import os
from pathlib import Path

import numpy as np
import pytest
import soundfile as sf


def _click_track_wav(path: Path, *, bpm: float = 120.0, seconds: float = 10.0, sr: int = 22050) -> None:
    interval = 60.0 / bpm
    n = int(seconds * sr)
    y = np.zeros(n, dtype=np.float32)
    k = 0
    t = 0.0
    while t < seconds:
        start = int(t * sr)
        end = min(start + 1000, n)
        y[start:end] = 0.45
        k += 1
        t = k * interval
    sf.write(str(path), y, sr)


@pytest.fixture
def beat_wav(tmp_path: Path) -> Path:
    p = tmp_path / "lofi_beat.wav"
    _click_track_wav(p, bpm=120.0, seconds=8.0)
    return p


def test_detect_bpm(beat_wav: Path) -> None:
    from beat_service import detect_bpm

    bpm = detect_bpm(beat_wav)
    assert 90.0 < bpm < 150.0, f"BPM {bpm} outside expected range for 120 BPM clicks"


def test_lyric_sync_plan(beat_wav: Path) -> None:
    from beat_service import analyze_beat_track
    from lyric_sync import plan_lyric_beat_alignment

    info = analyze_beat_track(beat_wav)
    lyrics = "[Verse]\nGoeie môre, die son trek water.\n[Chorus]\nOns sing saam."
    plan = plan_lyric_beat_alignment(lyrics, info["beat_times_sec"])
    assert len(plan) >= 2
    assert all(p.target_duration_sec > 0 for p in plan)


def test_mixer(tmp_path: Path) -> None:
    from mixer import mix_vocal_and_backing

    sr = 44100
    n = sr * 2
    v = tmp_path / "v.wav"
    b = tmp_path / "b.wav"
    sf.write(str(v), (np.random.randn(n).astype(np.float32) * 0.02), sr)
    sf.write(str(b), (np.random.randn(n).astype(np.float32) * 0.02), sr)
    out = tmp_path / "mix.wav"
    mix_vocal_and_backing(v, b, out)
    assert out.is_file() and out.stat().st_size > 1000


@pytest.mark.skipif(os.environ.get("RUN_BARK_INTEGRATION") != "1", reason="Set RUN_BARK_INTEGRATION=1 to run Bark (slow).")
def test_full_vocal_generation_live(beat_wav: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """
    Mirrors the user's success test: BPM → Bark (nl) → optional RVC → polish → optional mix.
    Requires RVC model only if RVC_MODEL_NAME is set.
    """
    from beat_service import detect_bpm
    from generator import generate_bark_wav
    from pipeline import run_full_vocal_pipeline
    from processor import EXPORTS_DIR, polish_only, rvc_available

    lyrics = "Goeie môre, die son trek water."
    bpm = detect_bpm(beat_wav)
    print(f"Success: Beat detected at {bpm} BPM")

    monkeypatch.setenv("BARK_MAX_LYRIC_CHARS", "500")
    raw_vocal = generate_bark_wav(lyrics, "v2/nl_speaker_0", use_music_notes=True)

    rvc_name = os.environ.get("RVC_MODEL_NAME", "").strip() or None
    if rvc_name and rvc_available():
        from processor import transform_to_real_vocal

        human_vocal = transform_to_real_vocal(raw_vocal, rvc_name, f0_up_key=0)
    else:
        human_vocal = polish_only(raw_vocal)

    try:
        raw_vocal.unlink(missing_ok=True)
    except OSError:
        pass

    assert Path(human_vocal).is_file()
    print(f"BUILD SUCCESS: Vocal layer at {human_vocal}")

    # Full pipeline wrapper (sync segments — exercises beat + plan + assemble)
    rvc_arg = rvc_name if rvc_name and rvc_available() else None
    res = run_full_vocal_pipeline(
        f"[Verse]\n{lyrics}",
        beat_wav,
        lang="nl",
        voice_preset="v2/nl_speaker_0",
        rvc_model=rvc_arg,
        mix_with_backing=True,
        auto_lang_detect=False,
    )
    vocal_name = res["vocal_filename"]
    assert (EXPORTS_DIR / vocal_name).is_file()


@pytest.mark.skipif(os.environ.get("RUN_BARK_INTEGRATION") == "1", reason="Light test only.")
def test_full_pipeline_mocked_bark(beat_wav: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Fast path: mock Bark segments so CI can validate glue without loading transformers."""
    import pipeline as pl

    def fake_assemble(
        lyrics_structured: str,
        beat_times_sec: list[float],
        **kwargs: object,
    ) -> tuple[np.ndarray, int]:
        _ = lyrics_structured
        sr = 24000
        total = max(int((beat_times_sec[-1] + 0.5) * sr), sr)
        audio = (np.random.randn(total).astype(np.float32) * 0.02).clip(-0.2, 0.2)
        return audio, sr

    monkeypatch.setattr(pl, "assemble_synced_vocal_lines", fake_assemble)

    res = pl.run_full_vocal_pipeline(
        "[Verse]\nOne line here\n[Chorus]\nSecond line",
        beat_wav,
        lang="en",
        voice_preset="v2/en_speaker_6",
        rvc_model=None,
        mix_with_backing=True,
        auto_lang_detect=False,
    )
    from processor import EXPORTS_DIR

    assert (EXPORTS_DIR / res["vocal_filename"]).is_file()
    assert "mix_filename" in res
    assert (EXPORTS_DIR / res["mix_filename"]).is_file()
