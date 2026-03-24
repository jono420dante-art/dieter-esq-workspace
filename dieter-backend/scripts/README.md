# Local audio scripts (no cloud)

## 1. Verify environment

From `dieter-backend/` with venv activated:

```bash
cd dieter-backend
pip install -r requirements.txt
python scripts/detect_beats.py --demo
```

You should see a plausible `tempo_bpm` and non-zero `beat_count`.

Then try a real file:

```bash
python scripts/detect_beats.py /path/to/beat.wav
```

## 2. Beat API (port 8000) + React WaveSurfer

```bash
cd dieter-backend
uvicorn main:app --reload --port 8000
```

- `POST /api/analyze-beats` — multipart `file`
- `POST /api/sync-vocals-stub` — JSON `{ bpm, beats, lyrics }`

In `mureka-clone`, open **Beat lab (8000)** and set `VITE_BEAT_API_URL` if needed.

## 3. Vocal pipeline stub

`vocal_pipeline_stub.py` defines placeholder functions for Tortoise-TTS + RVC + FFmpeg mix — implement against your local installs.

## 4. One-shot lyrics + beat → mastered MP3 (`lyrics_to_song_pro.py`)

From `dieter-backend/` with venv + **ffmpeg** on PATH and a **beat** file (e.g. `beat.mp3`):

```bash
python scripts/lyrics_to_song_pro.py --beat ./beat.mp3 --lyrics "Drop the bass, feel the rhythm in the dark tonight"
```

Optional **`--pitch N`** (semitones, clamped ±12): applied to **each** vocal stem before mixing (rubberband → librosa → rate fallback — same as `app.local_pipeline.pitch_shift_semitones_preserve_duration`).

```bash
python scripts/lyrics_to_song_pro.py --beat beat.mp3 --lyrics "Your lyrics" --pitch -6   # deeper
python scripts/lyrics_to_song_pro.py --beat beat.mp3 --lyrics "Your lyrics" --pitch 4    # brighter
python scripts/lyrics_to_song_pro.py --beat beat.mp3 --lyrics "Your lyrics" --pitch 0
```

**Coqui TTS** (optional; `pip install` from `requirements.txt`): single speech vocal, then mix + master:

```bash
set DIETER_VOCAL_ENGINE=coqui
python scripts/lyrics_to_song_pro.py --beat beat.mp3 --lyrics "Your lyrics" --vocal-engine coqui
```

Override model: `COQUI_TTS_MODEL=tts_models/en/ljspeech/glow-tts` (default).

By default (**`--vocal-engine procedural`**) the script uses **librosa** on your beat, renders **three procedural vocal layers** (Trap / Radio / Female Bright), **FFmpeg-amixes** them with the beat, then **`pro_master_audio`**. JSON includes `honest_note` and stub metadata for future RVC/Tortoise wiring.

Default output: `out/transparent_programs_demo.mp3`.
