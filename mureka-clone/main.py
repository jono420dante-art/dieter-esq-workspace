"""
DIETER Beat Lab + **Pure Song** (Coqui TTS + librosa + FFmpeg).

Quick dev:

  uvicorn main:app --reload --port 8000

Production stack may use **app.main:app** — add routes there if you deploy that entrypoint.

**Pure song** needs optional deps: `pip install -r requirements.txt` (includes TTS + torch).
Ethics: only clone / synthesize voices you have rights to use.
"""

from __future__ import annotations

import io
import logging
import os
import uuid
from pathlib import Path
from typing import Any, Callable

import librosa
import numpy as np
import soundfile as sf
from fastapi import Body, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from audio_pro import pro_ffmpeg_master
from beat_analysis import analyze, waveform_peaks_base64
from beat_sync import pure_beat_sync, resample_if_needed, split_lyrics_pro, wrap_singing_prompt
from mureka_sync import (
    MurekaSync,
    MurekaSyncError,
    download_audio_url,
    extract_audio_url,
)
from scripts.vocal_pipeline_stub import full_pipeline_stub

try:
    import voice_clone_pipeline as vcp
except ImportError:
    vcp = None

logger = logging.getLogger(__name__)

app = FastAPI(title="DIETER Beat Lab", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_UPLOAD_BYTES = 80 * 1024 * 1024

ROOT = Path(__file__).resolve().parent
STATIC_DIR = ROOT / "static"
STATIC_DIR.mkdir(parents=True, exist_ok=True)
TEMP_VOICE_DIR = ROOT / "temp_voice_clone"

# --- Lazy Coqui TTS (heavy import) ------------------------------------------
_tts_model: Any = None
_tts_sr: int = 22050
_get_device: Callable[[], str] | None = None


def _device() -> str:
    global _get_device
    if _get_device is None:
        try:
            import torch

            _get_device = lambda: "cuda" if torch.cuda.is_available() else "cpu"  # noqa: E731
        except ImportError:
            _get_device = lambda: "cpu"  # noqa: E731
    return _get_device()


def get_tts_engine():
    """Load Coqui TTS once. Raises ImportError if TTS/torch not installed."""
    global _tts_model, _tts_sr
    if _tts_model is not None:
        return _tts_model, _tts_sr
    from TTS.api import TTS

    model_name = "tts_models/en/ljspeech/glow-tts"
    try:
        engine = TTS(model_name=model_name).to(_device())
    except AttributeError:
        # Older Coqui builds use `gpu=` instead of `.to()`
        import torch

        engine = TTS(model_name=model_name, gpu=torch.cuda.is_available())
    _tts_model = engine
    syn = getattr(engine, "synthesizer", None)
    sr = getattr(syn, "output_sample_rate", None) if syn is not None else None
    _tts_sr = int(sr) if sr else 22050
    logger.info("Coqui TTS ready: %s @ %d Hz (%s)", model_name, _tts_sr, _device())
    return _tts_model, _tts_sr


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"ok": "true", "service": "beat-lab"}


@app.post("/api/analyze-beats")
async def analyze_beats(file: UploadFile = File(...)) -> dict[str, Any]:
    """
    Multipart file field name: `file` (same as FastAPI default).
    Returns bpm, all beat times in seconds, base64 float32 peaks for waveform UI.
    """
    raw = await file.read()
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max ~80MB)")
    if len(raw) < 256:
        raise HTTPException(status_code=400, detail="Audio too short or empty")

    try:
        y, sr = librosa.load(io.BytesIO(raw), sr=None, mono=True)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not decode audio: {e}") from e

    if len(y) < sr * 0.05:
        raise HTTPException(status_code=400, detail="Audio shorter than ~50ms")

    r = analyze(y, sr, max_beats_report=None)
    wf_b64 = waveform_peaks_base64(y, sr, n_points=2048)
    beats = r["beats_all"]
    if len(beats) > 20000:
        beats = beats[:20000]

    return {
        "bpm": r["tempo_bpm"],
        "beats": beats,
        "duration": r["duration_s"],
        "sample_rate": r["sr"],
        "waveform": wf_b64,
    }


class SyncVocalsBody(BaseModel):
    bpm: float = Field(..., ge=20, le=400)
    beats: list[float] = Field(default_factory=list)
    lyrics: str = ""


@app.post("/api/sync-vocals-stub")
def sync_vocals_stub(body: SyncVocalsBody) -> dict[str, Any]:
    """Placeholder until Tortoise/RVC are wired; documents contract for the frontend."""
    import tempfile

    tmp = Path(tempfile.mkdtemp(prefix="dieter_vocal_"))
    stub = full_pipeline_stub(body.lyrics or "[stub]", tmp / "beat_placeholder.wav", tmp)
    return {
        "status": "stub",
        "message": "Vocal pipeline not implemented — Tortoise-TTS + RVC run locally.",
        "bpm": body.bpm,
        "beat_count": len(body.beats),
        "pipeline": stub,
    }


@app.post("/pure-song")
@app.post("/api/pure-song")
async def pure_song_generator(
    beat: UploadFile = File(...),
    lyrics: str = Form(...),
) -> dict[str, Any]:
    """
    FREE local pipeline: beat upload + lyrics → Coqui TTS vocals aligned to librosa beats,
    FFmpeg master to MP3 under ``/static``.

    Form fields: ``beat`` (file), ``lyrics`` (text).
    """
    try:
        tts, tts_sr = get_tts_engine()
    except ImportError as e:
        raise HTTPException(
            status_code=503,
            detail="Coqui TTS not installed. Run: pip install TTS torch --upgrade",
        ) from e
    except Exception as e:
        logger.exception("TTS init failed")
        raise HTTPException(status_code=503, detail=f"TTS init failed: {e}") from e

    raw = await beat.read()
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Beat file too large (max ~80MB)")
    if len(raw) < 256:
        raise HTTPException(status_code=400, detail="Beat audio too short or empty")

    job = uuid.uuid4().hex[:12]
    beat_suffix = Path(beat.filename or "beat").suffix.lower() or ".wav"
    if beat_suffix not in {".wav", ".mp3", ".flac", ".ogg", ".m4a", ".aac", ".webm"}:
        beat_suffix = ".wav"

    beat_path = STATIC_DIR / f"_beat_{job}{beat_suffix}"
    vocal_path = STATIC_DIR / f"_vocal_{job}.wav"
    out_mp3 = STATIC_DIR / f"master_pro_{job}.mp3"

    try:
        beat_path.write_bytes(raw)
        y_beat, sr_beat = librosa.load(str(beat_path), sr=None, mono=True)
        analysis = analyze(y_beat, sr_beat, max_beats_report=None)
        bpm = float(analysis["tempo_bpm"])
        beat_times = analysis["beats_all"]

        parts = split_lyrics_pro(lyrics)
        vocal_chunks: list[np.ndarray] = []
        ref_bpm = 120.0
        rate = max(0.85, min(1.25, (bpm / ref_bpm) if ref_bpm else 1.0))

        for part in parts:
            prompt = wrap_singing_prompt(part)
            try:
                wav = tts.tts(text=prompt)
            except TypeError:
                wav = tts.tts(prompt)
            if isinstance(wav, list):
                wav = np.concatenate(
                    [np.asarray(x, dtype=np.float32).reshape(-1) for x in wav]
                )
            arr = np.asarray(wav, dtype=np.float32).reshape(-1)
            if rate != 1.0:
                arr = librosa.effects.time_stretch(arr, rate=rate)
            vocal_chunks.append(arr)

        synced = pure_beat_sync(vocal_chunks, beat_times, sr=tts_sr)
        synced = resample_if_needed(synced, tts_sr, sr_beat)
        # Match beat length for cleaner mix
        target_len = min(len(synced), len(y_beat))
        synced = synced[:target_len]
        sf.write(str(vocal_path), synced, sr_beat, subtype="PCM_16")

        pro_ffmpeg_master(
            beat_path,
            vocal_path,
            out_mp3,
            target_length_sec=min(180.0, float(analysis["duration_s"])),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("pure_song failed")
        raise HTTPException(status_code=500, detail=str(e)) from e
    finally:
        for p in (beat_path, vocal_path):
            try:
                if p.exists():
                    p.unlink()
            except OSError:
                pass

    public_name = out_mp3.name
    return {
        "song": f"/static/{public_name}",
        "bpm": bpm,
        "pure": True,
        "beats_detected": len(beat_times),
        "chunks": len(parts),
    }


@app.post("/pure-song-mureka")
@app.post("/api/pure-song-mureka")
async def pure_song_mureka(
    beat: UploadFile = File(...),
    lyrics: str = Form(...),
    mureka_style: str = Form("pop"),
) -> dict[str, Any]:
    """
    **Mode 1 — Mureka → dieter-backend:** Mureka ``/v1/song/generate`` (lyrics + style prompt),
    poll ``/v1/song/query``, download result, mix with **your** beat via ``pro_ffmpeg_master``.

    Form fields: ``beat`` (file), ``lyrics``, ``mureka_style`` (e.g. rap / pop / edm).

    Requires env **MUREKA_API_KEY**. Key stays on the server — do not put it in the browser.

    Note: Mureka typically returns a **full mix**; layering it on your beat is experimental.
    Prefer instrumental beats or use Mureka stems if/when the API exposes them.
    """
    api_key = (os.environ.get("MUREKA_API_KEY") or "").strip()
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="Set MUREKA_API_KEY in the environment for Mureka generation.",
        )

    raw = await beat.read()
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Beat file too large (max ~80MB)")
    if len(raw) < 256:
        raise HTTPException(status_code=400, detail="Beat audio too short or empty")

    job = uuid.uuid4().hex[:12]
    beat_suffix = Path(beat.filename or "beat").suffix.lower() or ".wav"
    if beat_suffix not in {".wav", ".wave", ".mp3", ".flac", ".ogg", ".m4a", ".aac", ".webm"}:
        beat_suffix = ".wav"

    beat_path = STATIC_DIR / f"_mureka_beat_{job}{beat_suffix}"
    mureka_audio = STATIC_DIR / f"_mureka_raw_{job}.audio"
    out_mp3 = STATIC_DIR / f"master_mureka_{job}.mp3"

    bpm = 0.0
    n_beats = 0

    try:
        beat_path.write_bytes(raw)
        y_beat, sr_beat = librosa.load(str(beat_path), sr=None, mono=True)
        analysis = analyze(y_beat, sr_beat, max_beats_report=None)
        bpm = float(analysis["tempo_bpm"])
        n_beats = len(analysis["beats_all"])

        sync = MurekaSync(api_key)
        try:
            audio_url, _mureka_final = await sync.generate_track_url(
                lyrics,
                mureka_style,
                model="auto",
            )
        except MurekaSyncError as e:
            raise HTTPException(status_code=502, detail=str(e)) from e
        except TimeoutError as e:
            raise HTTPException(status_code=504, detail=str(e)) from e

        ext = Path(audio_url.split("?", 1)[0]).suffix.lower() or ".mp3"
        if ext not in {".mp3", ".wav", ".flac", ".ogg", ".m4a", ".aac"}:
            ext = ".mp3"
        mureka_audio = mureka_audio.with_suffix(ext)

        await download_audio_url(audio_url, str(mureka_audio))

        pro_ffmpeg_master(
            beat_path,
            mureka_audio,
            out_mp3,
            target_length_sec=min(180.0, float(analysis["duration_s"])),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("pure_song_mureka failed")
        raise HTTPException(status_code=500, detail=str(e)) from e
    finally:
        for p in (beat_path, mureka_audio):
            try:
                if p.exists():
                    p.unlink()
            except OSError:
                pass

    name = out_mp3.name
    return {
        "song": f"/static/{name}",
        "song_url": f"/static/{name}",
        "bpm": bpm,
        "beats_detected": n_beats,
        "pure": False,
        "source": "mureka",
    }


@app.post("/api/mureka/clone")
async def api_mureka_clone(
    voice_sample: UploadFile = File(...),
    voice_name: str = Form("Custom Voice"),
) -> dict[str, Any]:
    """
    Register a voice sample: F0 profile + temp WAV (Coqui lab — not true Mureka/RVC clone).
    Falls back to a stub id if ``voice_clone_pipeline`` is unavailable.
    """
    raw = await voice_sample.read()
    if len(raw) < 512:
        raise HTTPException(status_code=400, detail="Voice sample too small.")
    if vcp is not None:
        try:
            out = vcp.clone_voice_from_upload(
                sample_bytes=raw,
                voice_name=voice_name,
                temp_dir=TEMP_VOICE_DIR,
            )
            out["voice_name"] = voice_name
            return out
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e
    return {
        "voice_id": f"stub_{uuid.uuid4().hex}",
        "voice_name": voice_name,
        "status": "stub",
        "bytes_received": len(raw),
        "note": "Install Coqui stack or use full dieter-backend deps for F0-based registration.",
    }


@app.post("/api/mureka/generate")
async def api_mureka_generate(
    voice_id: str = Form(...),
    lyrics: str = Form(...),
    beat_file: UploadFile = File(...),
) -> dict[str, Any]:
    """Coqui TTS + F0 nudge + beat mix → ``/static/*.wav`` when TTS is installed; else stub JSON."""
    beat_raw = await beat_file.read()
    if len(beat_raw) < 256:
        raise HTTPException(status_code=400, detail="Beat file too small.")
    if not (lyrics or "").strip():
        raise HTTPException(status_code=400, detail="Lyrics required.")

    if vcp is not None and vcp.pipeline_available():
        try:
            return vcp.generate_song_with_clone(
                voice_id=voice_id,
                lyrics=lyrics,
                beat_bytes=beat_raw,
                temp_dir=TEMP_VOICE_DIR,
                output_dir=STATIC_DIR,
                url_prefix="/static",
            )
        except KeyError:
            raise HTTPException(status_code=404, detail="Voice not found — clone again.") from None
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e
        except Exception as e:
            logger.exception("mureka generate pipeline failed")
            raise HTTPException(status_code=500, detail=str(e)) from e

    return {
        "stub": True,
        "song_url": None,
        "voice_id": voice_id,
        "message": "Coqui TTS not installed — pip install TTS torch (see requirements.txt).",
        "beat_bytes": len(beat_raw),
    }


@app.post("/mureka-webhook")
@app.post("/api/mureka-webhook")
async def mureka_webhook(data: dict[str, Any] = Body(...)) -> dict[str, Any]:
    """
    Optional callback endpoint if Mureka (or a proxy) POSTs completion payloads.

    Body should include a downloadable URL (``audio_url`` or nested fields we can parse).
    Saves under ``/static`` — **no** automatic beat mix (beat context is unknown here).
    """
    url = None
    if isinstance(data, dict):
        url = data.get("audio_url") or extract_audio_url(data)
    if not url or not isinstance(url, str):
        raise HTTPException(
            status_code=400,
            detail="Expected JSON with an http(s) audio URL (e.g. audio_url).",
        )

    job = uuid.uuid4().hex[:10]
    dest = STATIC_DIR / f"webhook_mureka_{job}.mp3"

    async def _save() -> None:
        await download_audio_url(url, str(dest))

    await _save()
    return {
        "status": "received",
        "file": f"/static/{dest.name}",
        "message": "Downloaded audio only; mix with your beat via /api/pure-song-mureka or FFmpeg.",
    }


app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
