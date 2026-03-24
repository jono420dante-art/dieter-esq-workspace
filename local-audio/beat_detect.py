#!/usr/bin/env python3
"""
Minimal beat detection using librosa.
Run first to verify your environment:

  pip install -r requirements.txt
  # FFmpeg must be on PATH for many audio formats (mp3, etc.)
  python beat_detect.py path/to/beat.mp3

If you only have WAV, librosa/soundfile often work without ffmpeg for .wav.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def detect_beats(audio_path: str) -> dict:
    import librosa
    import numpy as np

    path = Path(audio_path)
    if not path.is_file():
        raise FileNotFoundError(f"Not a file: {audio_path}")

    y, sr = librosa.load(str(path), sr=None, mono=True)
    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
    beat_times = librosa.frames_to_time(beat_frames, sr=sr).tolist()

    bpm = float(np.asarray(tempo).squeeze())

    return {
        "file": str(path.resolve()),
        "sample_rate": int(sr),
        "duration_sec": round(float(len(y) / sr), 3),
        "bpm_estimate": round(bpm, 2),
        "beat_count": len(beat_times),
        "beat_times_sec": [round(t, 4) for t in beat_times],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Detect BPM and beat times with librosa.")
    parser.add_argument("audio", help="Path to audio file (wav/mp3/...)")
    parser.add_argument("--json", action="store_true", help="Print full JSON (all beats)")
    args = parser.parse_args()

    try:
        result = detect_beats(args.audio)
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 1

    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print(f"File:        {result['file']}")
        print(f"Duration:    {result['duration_sec']} s")
        print(f"BPM (est.):  {result['bpm_estimate']}")
        print(f"Beats:       {result['beat_count']}")
        preview = result["beat_times_sec"][:8]
        suffix = " ..." if len(result["beat_times_sec"]) > 8 else ""
        print(f"First beats: {preview}{suffix}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
