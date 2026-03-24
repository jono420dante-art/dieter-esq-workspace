# Vocal pitch shift — engine priority

Implemented in `app/local_pipeline.py` → `pitch_shift_semitones_preserve_duration`.

## `DIETER_PITCH_ENGINE=auto` (default)

1. **rubberband** — FFmpeg `rubberband` filter (best quality; needs FFmpeg built with librubberband).
2. **librosa** — `librosa.effects.pitch_shift` (no extra binary beyond Python deps).
3. **ffmpeg_ps** — FFmpeg `asetrate` + `atempo` (fast; less natural on vocals).
4. **original_unshifted** — If all fail, the **original WAV is copied** unchanged; response includes `pitchWarning` (HTTP **200**, not 500).

## Forced modes (`rubberband` | `librosa` | `ffmpeg_ps`)

No silent fallback: failures raise **`RuntimeError`** → API **`500`** with a **clear `detail` string**.

## API fields (procedural vocal)

When pitch is applied, JSON may include:

- `pitchEngine` — `rubberband` | `librosa` | `ffmpeg_ps` | `original_unshifted`
- `pitchWarning` — set when a fallback or unshifted copy was used

See also: `GET /api/local/capabilities` → `pitch_engine_priority_auto`, `ffmpeg_rubberband_filter`.
