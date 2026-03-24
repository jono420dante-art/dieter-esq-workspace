#!/usr/bin/env python3
"""
Minimal beat detection — run this first to verify librosa + deps.

  python scripts/detect_beats.py --demo
  python scripts/detect_beats.py path/to/beat.wav
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np

# Repo root (parent of scripts/)
_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from beat_analysis import analyze, demo_signal


def main() -> int:
    p = argparse.ArgumentParser(description="Minimal librosa beat detection")
    p.add_argument("audio", nargs="?", type=Path, help="WAV/MP3/… path")
    p.add_argument("--demo", action="store_true", help="Use synthetic 120 BPM clicks (no file)")
    args = p.parse_args()

    if args.demo:
        sr = 22050
        y = demo_signal(sr=sr)
        print("Using built-in --demo signal (librosa metronome clicks ~120 BPM).")
    else:
        if not args.audio or not args.audio.is_file():
            print("Usage: python scripts/detect_beats.py [--demo] [AUDIO_FILE]", file=sys.stderr)
            print("  Try: python scripts/detect_beats.py --demo", file=sys.stderr)
            return 1
        import librosa

        y, sr = librosa.load(str(args.audio), sr=None, mono=True)
        print(f"Loaded: {args.audio}")

    r = analyze(y, sr, max_beats_report=32)
    print(f"tempo_bpm:   {r['tempo_bpm']}")
    print(f"duration_s:  {r['duration_s']}")
    print(f"sample_rate: {r['sr']}")
    print(f"beat_count:  {r['n_beats']}")
    print(f"first_beats: {r['beat_times_s'][:8]}")
    print("OK - environment looks good for librosa beat tracking.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
