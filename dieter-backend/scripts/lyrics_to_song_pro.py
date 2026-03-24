#!/usr/bin/env python3
"""
Lyrics + beat -> layered mix -> mastered MP3 (DIETER local stack).

What this script *actually* does today
--------------------------------------
- Librosa beat analysis on your beat file (BPM + duration; drives vocal length / tempo).
- **Default** ``--vocal-engine procedural``: three procedural vocal layers + FFmpeg amix + pro_master_audio.
- **Optional** ``--vocal-engine coqui``: Coqui TTS speech (``app/coqui_tts.py``) + mix + master; requires ``TTS`` + ``torch``.

What is *not* included (wire your own GPU stack)
------------------------------------------------
- Full *singing* models (Tortoise/Bark) - see scripts/vocal_pipeline_stub.py.
- RVC - external WebUI/CLI.

Run from dieter-backend/ with venv + ffmpeg on PATH::

    python scripts/lyrics_to_song_pro.py --beat path/to/beat.mp3 \\
        --lyrics "Drop the bass, feel the rhythm in the dark tonight"

Pitch (semitones, applied to each of the 3 vocal stems before mix; clamped +/- 12)::

    # Deep male voice
    python scripts/lyrics_to_song_pro.py --beat beat.mp3 --lyrics "Your lyrics" --pitch -6

    # Female voice
    python scripts/lyrics_to_song_pro.py --beat beat.mp3 --lyrics "Your lyrics" --pitch 4

    # Neutral
    python scripts/lyrics_to_song_pro.py --beat beat.mp3 --lyrics "Your lyrics" --pitch 0

Default out: ./out/transparent_programs_demo.mp3
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

# Repo root = parent of scripts/
_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from app.audio_master import pro_master_audio, ffprobe_duration_seconds  # noqa: E402
from app.engines import get_engine  # noqa: E402
from app.local_pipeline import (  # noqa: E402
    detect_beats_from_path,
    merge_two_audio_mp3,
    pitch_shift_semitones_preserve_duration,
)
from scripts.vocal_pipeline_stub import full_pipeline_stub  # noqa: E402


# Three “characters”: procedural presets (timbre differs; not real rap/sung AI voices).
LAYERS: tuple[tuple[str, str], ...] = (
    ("rap", "Trap"),
    ("singer", "Radio"),
    ("female", "Female Bright"),
)


def _which_ffmpeg() -> str:
    ff = shutil.which("ffmpeg")
    if not ff:
        raise RuntimeError("ffmpeg not found on PATH — install ffmpeg and retry.")
    return ff


def mix_beat_and_vocal_wavs(
    beat: Path,
    vocals: list[Path],
    out_wav: Path,
    *,
    beat_db: float = -7.0,
    vocal_dbs: tuple[float, ...] = (-5.0, -6.5, -6.0),
) -> None:
    """FFmpeg amix: one beat + N vocal WAVs -> stereo WAV."""
    if len(vocals) != len(vocal_dbs):
        raise ValueError("vocal_dbs must match vocals count")
    n = len(vocals)
    ff = _which_ffmpeg()
    out_wav.parent.mkdir(parents=True, exist_ok=True)

    parts: list[str] = [f"[0:a]volume={beat_db}dB[b]"]
    labels: list[str] = ["[b]"]
    for i, db in enumerate(vocal_dbs):
        parts.append(f"[{i + 1}:a]volume={db}dB[v{i}]")
        labels.append(f"[v{i}]")

    n_inputs = n + 1
    mix_in = "".join(labels)
    parts.append(f"{mix_in}amix=inputs={n_inputs}:duration=longest:dropout_transition=0[aout]")
    filt = ";".join(parts)

    cmd: list[str] = [ff, "-y", "-i", str(beat)]
    for v in vocals:
        cmd.extend(["-i", str(v)])
    cmd.extend(
        [
            "-filter_complex",
            filt,
            "-map",
            "[aout]",
            "-c:a",
            "pcm_s16le",
            str(out_wav),
        ]
    )
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(r.stderr or r.stdout or "ffmpeg amix failed")


def run_pipeline(
    lyrics: str,
    beat_path: Path,
    out_mp3: Path,
    *,
    duration_cap: int = 180,
    pitch_semitones: float = 0.0,
    vocal_engine: str = "procedural",
) -> dict:
    beat_path = Path(beat_path).resolve()
    if not beat_path.is_file():
        raise FileNotFoundError(beat_path)

    ps = max(-12.0, min(12.0, float(pitch_semitones)))

    det = detect_beats_from_path(beat_path)
    bpm = int(round(float(det.get("tempo_bpm") or 120)))
    bpm = max(40, min(240, bpm))
    dur_s = float(det.get("duration_seconds") or ffprobe_duration_seconds(beat_path))
    duration_s = int(min(duration_cap, max(20, round(dur_s))))

    mode = (vocal_engine or "procedural").strip().lower()

    # Document the future chain (Tortoise + RVC) - returns placeholders only.
    stub_dir = Path(tempfile.mkdtemp(prefix="lyrics_pro_stub_"))
    try:
        stub_meta = full_pipeline_stub(lyrics, beat_path, stub_dir / "work")
    finally:
        shutil.rmtree(stub_dir, ignore_errors=True)

    work = Path(tempfile.mkdtemp(prefix="lyrics_pro_"))
    vocal_paths: list[Path] = []
    layer_meta: list[dict] = []

    try:
        if mode == "coqui":
            from app.coqui_tts import coqui_available, synthesize_to_wav_file

            if not coqui_available():
                raise RuntimeError(
                    "Coqui TTS not installed. From dieter-backend: pip install -r requirements.txt (TTS, torch).",
                )
            vocal_raw = work / "coqui_vocal.wav"
            synthesize_to_wav_file(lyrics, vocal_raw)
            vocal_for_mix = vocal_raw
            if abs(ps) > 1e-6:
                vocal_pitched = work / "coqui_vocal_pitched.wav"
                pitch_shift_semitones_preserve_duration(vocal_raw, vocal_pitched, ps)
                vocal_for_mix = vocal_pitched
            mix_mp3 = work / "premaster_mix.mp3"
            merge_two_audio_mp3(beat_path, vocal_for_mix, mix_mp3)
            out_mp3 = Path(out_mp3).resolve()
            pro_master_audio(mix_mp3, out_mp3, max_duration_sec=float(min(duration_cap, 180)))
            layer_meta = [
                {
                    "engine": "coqui",
                    "model": (os.environ.get("COQUI_TTS_MODEL") or "tts_models/en/ljspeech/glow-tts").strip(),
                    "path": str(vocal_for_mix),
                    "pitch_semitones": ps,
                }
            ]
            return {
                "output": str(out_mp3),
                "bpm": bpm,
                "duration_requested_s": duration_s,
                "beat_analysis": {
                    "beat_count": det.get("beat_count"),
                    "tempo_bpm": det.get("tempo_bpm"),
                },
                "layers": layer_meta,
                "pitch_semitones": ps,
                "engine": "coqui_tts",
                "vocal_engine": "coqui",
                "vocal_pipeline_stub": stub_meta,
                "honest_note": (
                    "Coqui TTS is speech-oriented (e.g. LJSpeech), not a full singing model. "
                    "For sung vocals, chain RVC or use Mureka/cloud paths."
                ),
            }

        engine_name = os.getenv("DIETER_AUDIO_ENGINE", "procedural")
        engine = get_engine(engine_name)

        for role, preset in LAYERS:
            seed = int(hashlib.sha256(f"{lyrics}:{role}:{preset}".encode()).hexdigest()[:8], 16) % (16**8)
            sub = work / f"layer_{role}"
            sub.mkdir(parents=True, exist_ok=True)
            res = engine.generate(
                out_dir=sub,
                prompt=f"lyrics_to_song_pro {role}",
                lyrics=lyrics,
                language="en",
                vocal_preset=preset,
                bpm=bpm,
                duration_s=duration_s,
                seed=seed,
                render_stems=True,
            )
            v = res.stem_paths.get("vocals")
            if not v or not v.is_file():
                raise RuntimeError(f"Missing vocals stem for layer {role}")
            dest = work / f"{role}_vocals.wav"
            dest.write_bytes(v.read_bytes())
            if abs(ps) > 1e-6:
                pitched = work / f"{role}_vocals_pitched.wav"
                pitch_shift_semitones_preserve_duration(dest, pitched, ps)
                vocal_paths.append(pitched)
                layer_meta.append(
                    {"role": role, "preset": preset, "seed": seed, "path": str(pitched), "pitch_semitones": ps}
                )
            else:
                vocal_paths.append(dest)
                layer_meta.append({"role": role, "preset": preset, "seed": seed, "path": str(dest), "pitch_semitones": 0})

        mix_wav = work / "premaster_mix.wav"
        mix_beat_and_vocal_wavs(beat_path, vocal_paths, mix_wav)

        out_mp3 = Path(out_mp3).resolve()
        pro_master_audio(mix_wav, out_mp3, max_duration_sec=float(min(duration_cap, 180)))

        return {
            "output": str(out_mp3),
            "bpm": bpm,
            "duration_requested_s": duration_s,
            "beat_analysis": {
                "beat_count": det.get("beat_count"),
                "tempo_bpm": det.get("tempo_bpm"),
            },
            "layers": layer_meta,
            "pitch_semitones": ps,
            "engine": engine.name,
            "vocal_engine": "procedural",
            "vocal_pipeline_stub": stub_meta,
            "honest_note": (
                "Vocal timbre is procedural synth-style. For REAL rap/sung AI, install Tortoise/Bark + RVC "
                "and replace the engine.generate() stage — see scripts/vocal_pipeline_stub.py."
            ),
        }
    finally:
        shutil.rmtree(work, ignore_errors=True)


def main() -> int:
    p = argparse.ArgumentParser(
        description="Lyrics + beat -> vocal mix + master MP3 (procedural 3-layer or Coqui TTS).",
    )
    p.add_argument(
        "--lyrics",
        default="Drop the bass, feel the rhythm in the dark tonight",
        help="Lyrics line(s) for the procedural vocalizer.",
    )
    p.add_argument("--lyrics-file", type=Path, help="Read lyrics from a UTF-8 file (overrides --lyrics).")
    p.add_argument("--beat", type=Path, default=Path("beat.mp3"), help="Path to beat/loop audio.")
    p.add_argument(
        "--out",
        type=Path,
        default=Path("out/transparent_programs_demo.mp3"),
        help="Output mastered MP3 path.",
    )
    p.add_argument("--duration-cap", type=int, default=180, help="Max generation length in seconds (default 180).")
    p.add_argument(
        "--pitch",
        type=float,
        default=0,
        metavar="N",
        help="Pitch shift in semitones (-12 deep male, +12 bright female). Applied to each vocal stem before mix.",
    )
    p.add_argument(
        "--vocal-engine",
        choices=("procedural", "coqui"),
        default=os.environ.get("DIETER_VOCAL_ENGINE", "procedural"),
        help="procedural = 3 local synth layers; coqui = Coqui TTS (requires pip install TTS torch).",
    )
    args = p.parse_args()

    lyrics = args.lyrics
    if args.lyrics_file:
        lyrics = args.lyrics_file.read_text(encoding="utf-8").strip()
    if not lyrics.strip():
        print("No lyrics.", file=sys.stderr)
        return 2

    print("--- Transparent Programs | lyrics_to_song_pro ---", file=sys.stderr)
    ve = args.vocal_engine
    print(
        f"  Beat sync: librosa  |  Mix/master: FFmpeg  |  Vocal engine: {ve}  |  Pitch: {args.pitch:+.1f} st",
        file=sys.stderr,
    )
    if ve == "procedural":
        print("  TTS: use --vocal-engine coqui for Coqui speech (requires TTS+torch).", file=sys.stderr)
    print("", file=sys.stderr)

    try:
        meta = run_pipeline(
            lyrics,
            args.beat,
            args.out,
            duration_cap=args.duration_cap,
            pitch_semitones=args.pitch,
            vocal_engine=ve,
        )
    except Exception as e:
        print(f"FAILED: {e}", file=sys.stderr)
        return 1

    print(json.dumps(meta, indent=2, ensure_ascii=False))
    print(f"\nOK Wrote: {meta['output']}", file=sys.stderr)
    print("   Open in your player - then wire Tortoise+RVC when you want real AI voices.", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
