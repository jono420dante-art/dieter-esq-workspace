# SDC420-style vocal API (integrated)

**Demo page:** `mureka-clone/public/sdc420-xtreme.html` → open as  
`http://127.0.0.1:5173/sdc420-xtreme.html` (uses **`POST /api/local/procedural-vocal-layer-form`** with `FormData`).

Do **not** replace `app/main.py` with a minimal standalone app — you would lose the rest of the DIETER routes (upload, merge, beat-detect, etc.).

Instead, use one of these:

## JSON (recommended for React / `fetch`)

`POST /api/local/procedural-vocal-layer`  
`Content-Type: application/json`

Body matches `LocalProceduralVocalBody` (`vocalPreset`, `pitchSemitones`, `lyrics`, `bpm`, `durationSec`, …).

## Multipart form (SDC420-style)

`POST /api/local/procedural-vocal-layer-form`  
`Content-Type: multipart/form-data`

| Field | Type | Notes |
|--------|------|--------|
| `voice_id` | string | e.g. `male2`, `female1` → maps to `Man-2`, `Woman-1` presets |
| `pitchSemitones` | float | −12 … +12, applied after render (rubberband / librosa / ffmpeg) |
| `lyrics` | string | optional |
| `beat_bpm` | int | optional; used when no `beat_file` |
| `vocal_duration_sec` | int | optional; 5–240 when no `beat_file` (default 45). With `beat_file`, duration comes from analysis. |
| `beat_file` | file | optional; if set, BPM + duration come from **librosa** beat detect |

Response includes the normal DIETER fields (`key`, `url`, `vocalLayerId`, …) plus `success`, `voice_id`, `vocal_path`, `duration` for compatibility with stub clients.

## Why the pasted stub was unsafe

1. **`TemporaryDirectory`**: returning `vocal_path` inside the `with` block invalidates the path after the function returns.
2. **`rubberband` CLI**: the example subprocess args were invalid; this repo uses **FFmpeg’s `rubberband` filter** or **librosa** via `pitch_shift_semitones_preserve_duration` in `local_pipeline.py`.
3. **Duplicating** numpy sine synthesis bypasses the real **procedural engine** in `app/synth.py` / `app/engines.py`.

Environment: `DIETER_PITCH_ENGINE=auto|rubberband|librosa|ffmpeg_ps` (see `/api/local/capabilities`).
