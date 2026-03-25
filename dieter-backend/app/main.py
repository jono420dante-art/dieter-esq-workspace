from __future__ import annotations

import json
import logging
import os
import re
import shutil
import tempfile
import threading
import time
import urllib.error
import urllib.request
import uuid
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Literal, Optional

from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .engines import get_engine
from .lyrics_service import generate_lyrics, optimize_lyrics
from .lyrics_analyze import analyze_lyrics as analyze_lyrics_text
from .agents import list_agents, run_agent as run_studio_agent
from .audio_master import pro_master_audio
from .beat_lab import router as beat_lab_router
from .pitch_presets import preset_semitones
from .release_pipeline import generate_master_pipeline, save_distro_prep_upload
from .music_video import generate_music_video
from .seo_service import build_seo_pack
from .kling_video import (
    aiml_api_config,
    build_kling_prompt_from_song,
    create_text_to_video_task,
    download_video,
    kling_configured,
    loop_video_and_mux_audio,
    maybe_post_colab_webhook,
    poll_generation,
)
from .local_pipeline import (
    detect_beats_from_path,
    local_capabilities,
    merge_two_audio_mp3,
    pitch_shift_semitones_preserve_duration,
    stretch_audio_to_bpm_ratio,
)
from .cover_pipeline import decode_to_wav, mix_parallel, render_cover_two_takes
from .suno_mureka_mix import build_suno_mureka_mix, preset_summary
from .vocal_analysis import analyze_vocal_audio_bytes

import librosa

from audio_pro import pro_ffmpeg_master
from beat_analysis import analyze
from mureka_sync import MurekaSync, MurekaSyncError, download_audio_url

try:
    import voice_clone_pipeline as vcp
except ImportError:
    vcp = None

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
STORAGE_DIR = BASE_DIR / "storage"
JOBS_PATH = DATA_DIR / "jobs.json"

DATA_DIR.mkdir(parents=True, exist_ok=True)
STORAGE_DIR.mkdir(parents=True, exist_ok=True)
(BASE_DIR / "temp_voice_clone").mkdir(parents=True, exist_ok=True)
(STORAGE_DIR / "voice_clone").mkdir(parents=True, exist_ok=True)

GROWTH_PATH = DATA_DIR / "studio_growth.json"
_growth_lock = threading.Lock()
PERF_PATH = DATA_DIR / "perf_metrics.json"
_perf_lock = threading.Lock()

if vcp is not None:
    _n = vcp.load_voice_library(STORAGE_DIR / "voice_clone")
    if _n:
        logger.info("Loaded %d voice(s) from voice clone library", _n)

SEO_CONFIG_PATH = DATA_DIR / "seo_config.json"
SEO_ROI_PATH = DATA_DIR / "seo_roi.json"


def _load_jobs() -> dict[str, Any]:
    if not JOBS_PATH.exists():
        return {}
    try:
        return json.loads(JOBS_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _save_jobs(jobs: dict[str, Any]) -> None:
    JOBS_PATH.write_text(json.dumps(jobs, ensure_ascii=False, indent=2), encoding="utf-8")


jobs_lock = threading.Lock()


def _new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:16]}"


def _load_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def _save_json(path: Path, data: Any) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


@dataclass
class PlanSection:
    id: str
    start_bar: int
    length_bar: int
    start_s: float
    length_s: float


@dataclass
class Plan:
    planId: str
    bpm: int
    mood: str
    structure: list[PlanSection]
    chords: list[dict[str, Any]]
    lyricSections: list[dict[str, Any]]


class PlanRequest(BaseModel):
    prompt: str = Field(..., min_length=1)
    lyrics: Optional[str] = None
    bpm: int = Field(128, ge=40, le=240)
    mood: str = Field("—")


class GenerateRequest(BaseModel):
    prompt: str = Field(..., min_length=1)
    lyrics: Optional[str] = None
    bpm: int = Field(128, ge=40, le=240)
    mood: str = Field("—")
    style: str = Field("Cinematic")
    language: str = Field("en")
    vocalPreset: str = Field("Radio")
    modelLine: Literal["O1", "V6", "V7", "V7.5", "V8"] = "V7.5"
    tier: Literal["free", "creator", "pro", "studio"] = "pro"
    stems: bool = True
    durationSec: int = Field(45, ge=5, le=240)


class JobStatusResponse(BaseModel):
    jobId: str
    status: Literal["queued", "running", "succeeded", "failed"]
    output: Optional[dict[str, Any]] = None
    error: Optional[str] = None


_STATIC_INDEX = BASE_DIR / "static" / "index.html"
_SERVE_SPA = _STATIC_INDEX.is_file()

app = FastAPI(
    title="ED-GEERDES API",
    version="0.1.0",
    docs_url=None if _SERVE_SPA else "/docs",
    redoc_url=None if _SERVE_SPA else "/redoc",
)

_cors_raw = os.environ.get("DIETER_CORS_ORIGINS", "*").strip()
if _cors_raw == "*":
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    _cors_list = [o.strip() for o in _cors_raw.split(",") if o.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_cors_list or ["*"],
        allow_credentials=bool(_cors_list),
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(beat_lab_router, prefix="/api")


@app.get("/api/health")
def health() -> dict[str, Any]:
    return {"ok": True, "time": time.time()}


_VOCAL_ANALYZE_MAX_BYTES = int(os.environ.get("DIETER_VOCAL_ANALYZE_MAX_MB", "32")) * 1024 * 1024


@app.post("/api/vocal/analyze")
async def api_vocal_analyze(file: UploadFile = File(...)) -> dict[str, Any]:
    """Extract spectral, MFCC, RMS, and F0 stats from a vocal clip (wav/mp3/etc. via librosa).

    Use the JSON for **dataset labels** or conditioning; generation quality for end users still comes from
    cloud models (e.g. Mureka) wired through this gateway. See ``docs/VOCAL_ENGINE_AND_TRAINING.md``.
    """
    raw = await file.read()
    if len(raw) > _VOCAL_ANALYZE_MAX_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"file too large (max {_VOCAL_ANALYZE_MAX_BYTES // (1024 * 1024]} MiB)",
        )
    if len(raw) < 64:
        raise HTTPException(status_code=400, detail="empty upload")
    try:
        features = analyze_vocal_audio_bytes(raw)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.exception("vocal analyze failed")
        raise HTTPException(status_code=500, detail=str(e)) from e
    return {
        "engine": "dieter_librosa_vocal_stats_v1",
        "filename": file.filename,
        "features": features,
    }


def _default_studio_growth() -> dict[str, Any]:
    return {
        "version": 1,
        "counters": {
            "lyrics_generated": 0,
            "lyrics_optimized": 0,
            "masters_built": 0,
            "mureka_songs": 0,
            "beats_analyzed": 0,
            "voice_clones": 0,
            "sessions": 0,
        },
        "recent": [],
    }


def _load_studio_growth() -> dict[str, Any]:
    if not GROWTH_PATH.is_file():
        return _default_studio_growth()
    try:
        raw = json.loads(GROWTH_PATH.read_text(encoding="utf-8"))
        if not isinstance(raw, dict):
            return _default_studio_growth()
        raw.setdefault("counters", _default_studio_growth()["counters"])
        raw.setdefault("recent", [])
        return raw
    except (OSError, json.JSONDecodeError):
        return _default_studio_growth()


class StudioGrowthEvent(BaseModel):
    kind: Literal[
        "lyrics_generated",
        "lyrics_optimized",
        "master_built",
        "mureka_song_ready",
        "beat_analyzed",
        "voice_clone",
        "session_ping",
    ]
    note: str = Field("", max_length=500)


@app.get("/api/studio/growth")
def api_studio_growth_get() -> dict[str, Any]:
    """Cumulative studio activity (lyrics, masters, beats, etc.) — grows with usage."""
    with _growth_lock:
        return _load_studio_growth()


@app.post("/api/studio/growth")
def api_studio_growth_post(body: StudioGrowthEvent) -> dict[str, Any]:
    counter_key = {
        "lyrics_generated": "lyrics_generated",
        "lyrics_optimized": "lyrics_optimized",
        "master_built": "masters_built",
        "mureka_song_ready": "mureka_songs",
        "beat_analyzed": "beats_analyzed",
        "voice_clone": "voice_clones",
        "session_ping": "sessions",
    }.get(body.kind)
    with _growth_lock:
        data = _load_studio_growth()
        c = data.setdefault("counters", {})
        if counter_key:
            c[counter_key] = int(c.get(counter_key, 0)) + 1
        recent = data.setdefault("recent", [])
        recent.insert(
            0,
            {"kind": body.kind, "note": (body.note or "")[:500], "t": time.time()},
        )
        data["recent"] = recent[:100]
        try:
            GROWTH_PATH.write_text(json.dumps(data, indent=2), encoding="utf-8")
        except OSError:
            logger.warning("Could not write %s", GROWTH_PATH)
    return {"ok": True, "counters": data.get("counters", {})}


def _record_perf(event: str, ok: bool, elapsed_ms: float, *, detail: str = "") -> None:
    with _perf_lock:
        try:
            raw = json.loads(PERF_PATH.read_text(encoding="utf-8")) if PERF_PATH.is_file() else {}
            if not isinstance(raw, dict):
                raw = {}
        except (OSError, json.JSONDecodeError):
            raw = {}
        entries = raw.setdefault("entries", [])
        entries.insert(
            0,
            {
                "event": event,
                "ok": bool(ok),
                "elapsed_ms": round(float(elapsed_ms), 2),
                "detail": (detail or "")[:400],
                "t": time.time(),
            },
        )
        raw["entries"] = entries[:500]
        try:
            PERF_PATH.write_text(json.dumps(raw, ensure_ascii=False, indent=2), encoding="utf-8")
        except OSError:
            logger.warning("Could not write %s", PERF_PATH)


@app.get("/api/perf/summary")
def api_perf_summary() -> dict[str, Any]:
    with _perf_lock:
        try:
            raw = json.loads(PERF_PATH.read_text(encoding="utf-8")) if PERF_PATH.is_file() else {}
            entries = raw.get("entries", []) if isinstance(raw, dict) else []
        except (OSError, json.JSONDecodeError):
            entries = []

    if not entries:
        return {
            "count": 0,
            "ok_count": 0,
            "error_count": 0,
            "avg_elapsed_ms": 0.0,
            "last": [],
        }

    count = len(entries)
    ok_count = sum(1 for e in entries if e.get("ok"))
    avg_ms = sum(float(e.get("elapsed_ms", 0.0)) for e in entries) / max(1, count)
    return {
        "count": count,
        "ok_count": ok_count,
        "error_count": count - ok_count,
        "avg_elapsed_ms": round(avg_ms, 2),
        "last": entries[:20],
    }


class LyricsGenerateBody(BaseModel):
    """Generate draft lyrics (OpenAI when key present, else local template)."""

    style: str = Field("pop")
    title: str = ""
    vocal: Literal["female", "male"] = "female"
    openaiApiKey: Optional[str] = None


class LyricsOptimizeBody(BaseModel):
    lyrics: str = Field(..., min_length=1)
    openaiApiKey: Optional[str] = None


class LyricsAnalyzeBody(BaseModel):
    lyrics: str = Field(..., min_length=1)


def _count_syllables_rough(word: str) -> int:
    """
    Heuristic syllable counter (offline, dependency-free). Not perfect, but stable.
    """
    w = re.sub(r"[^a-z]", "", (word or "").lower())
    if not w:
        return 0
    vowels = "aeiouy"
    count = 0
    prev_vowel = False
    for ch in w:
        is_v = ch in vowels
        if is_v and not prev_vowel:
            count += 1
        prev_vowel = is_v
    # silent e
    if w.endswith("e") and count > 1 and not w.endswith(("le", "ye")):
        count -= 1
    return max(1, count)


def _rhyme_key_rough(line: str) -> str:
    t = re.sub(r"[^a-zA-Z\\s']", " ", (line or "")).strip().lower()
    if not t:
        return ""
    last = t.split()[-1]
    last = re.sub(r"[^a-z]", "", last)
    if not last:
        return ""
    # last vowel group + trailing consonants
    m = re.search(r"[aeiouy]+[^aeiouy]*$", last)
    return m.group(0) if m else last[-3:]


@app.post("/api/lyrics/analyze")
def api_lyrics_analyze(req: LyricsAnalyzeBody) -> dict[str, Any]:
    """
    Offline lyric rhythm/prosody analysis:
    - per-line syllable estimate
    - rough stress guess (caps/!/? markers)
    - naive rhyme scheme based on last word vowel group
    """
    text = (req.lyrics or "").strip()
    lines = [ln.rstrip() for ln in text.splitlines()]
    out_lines: list[dict[str, Any]] = []
    rhyme_map: dict[str, str] = {}
    next_letter = ord("A")

    for i, ln in enumerate(lines):
        words = [w for w in re.split(r"\\s+", ln.strip()) if w]
        syll = sum(_count_syllables_rough(w) for w in words)
        rk = _rhyme_key_rough(ln)
        if rk and rk not in rhyme_map:
            rhyme_map[rk] = chr(next_letter)
            next_letter = min(next_letter + 1, ord("Z"))
        rh = rhyme_map.get(rk, "") if rk else ""
        out_lines.append(
            {
                "i": i,
                "text": ln,
                "words": len(words),
                "syllables": syll,
                "rhyme": rh,
                "rhymeKey": rk,
            }
        )

    scheme = "".join((l.get("rhyme") or " ") for l in out_lines).strip() or ""
    return {
        "ok": True,
        "lines": out_lines,
        "rhymeScheme": scheme,
        "totalLines": len(out_lines),
        "totalSyllables": sum(int(l["syllables"]) for l in out_lines),
    }


@app.post("/api/lyrics/generate")
def api_lyrics_generate(req: LyricsGenerateBody) -> dict[str, Any]:
    text, source = generate_lyrics(req.style, req.title, req.vocal, req.openaiApiKey)
    return {"text": text, "source": source}


@app.post("/api/lyrics/optimize")
def api_lyrics_optimize(req: LyricsOptimizeBody) -> dict[str, Any]:
    text, source = optimize_lyrics(req.lyrics, req.openaiApiKey)
    return {"text": text, "source": source}


class LyricsAnalyzeBody(BaseModel):
    """Lint lyrics + rough bar/syllable overflow hints (optional BPM)."""

    lyrics: str = ""
    bpm: Optional[int] = Field(None, ge=40, le=240)
    beatsPerBar: int = Field(4, ge=1, le=16)


@app.post("/api/lyrics/analyze")
def api_lyrics_analyze(req: LyricsAnalyzeBody) -> dict[str, Any]:
    return analyze_lyrics_text(req.lyrics or "", bpm=req.bpm, beats_per_bar=req.beatsPerBar)


class AgentRunBody(BaseModel):
    agentId: str = Field(..., min_length=1)
    payload: dict[str, Any] = Field(default_factory=dict)


@app.get("/api/agents")
def api_agents_list() -> dict[str, Any]:
    return {"agents": list_agents()}


@app.post("/api/agents/run")
def api_agents_run(body: AgentRunBody) -> dict[str, Any]:
    try:
        result = run_studio_agent(body.agentId, body.payload or {})
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    return {"ok": True, "agentId": body.agentId, "result": result}


VOICE_PRESETS = [
    # core
    "Radio",
    "Pop",
    "Rock",
    "Trap",
    "Choir",
    # characters
    "Alien",
    "Elf",
    "Robot",
    "Demon",
    "Angel",
    "Giant",
    "Childlike",
    # gender/tones
    "Male Warm",
    "Male Deep",
    "Female Bright",
    "Female Warm",
    "Whisper",
    "Opera",
    "Afro Soul",
    "K-Pop",
    "Reggae Toast",
    "Dancehall",
    "R&B Velvet",
    "EDM Topline",
]


@app.get("/api/voices")
def api_voices() -> dict[str, Any]:
    return {
        "voicePresets": VOICE_PRESETS,
        "languages": ["en", "af", "de", "es", "fr", "ja", "ko"],
    }


class VideoGenerateRequest(BaseModel):
    prompt: str = Field(..., min_length=1)
    bpm: int = Field(128, ge=40, le=240)
    seconds: int = Field(10, ge=3, le=60)
    mood: str = Field("—")
    style: str = Field("Cinematic")
    # Optional: attach an audio asset to sync against
    assetId: Optional[str] = None


@app.post("/api/video/generate")
def api_video_generate(req: VideoGenerateRequest) -> dict[str, Any]:
    """
    Raw text-to-video hook (same Kling/AIML stack) without a song mux — optional ``assetId`` for future extensions.
    Prefer ``POST /api/video/from-song`` when you have a generated master to sync.
    """
    job_id = _new_id("jobv")
    job = {
        "jobId": job_id,
        "type": "video.generate",
        "status": "failed",
        "createdAt": time.time(),
        "params": req.model_dump(),
        "error": (
            "Use POST /api/video/from-song with audioUrl or assetId for Kling + your audio. "
            "Raw prompt-only generation is not wired to a separate job queue here."
        ),
    }
    with jobs_lock:
        jobs = _load_jobs()
        jobs[job_id] = job
        _save_jobs(jobs)
    return {"jobId": job_id, "status": "failed", "error": job["error"]}


class VideoFromSongRequest(BaseModel):
    projectId: str = Field(..., min_length=1)
    style: str = Field("cinematic abstract")
    engine: str = Field("kling")
    audioUrl: Optional[str] = None
    assetId: Optional[str] = Field(
        None, description="Storage key, e.g. local/mix_abc.mp3 or uploads/…"
    )
    lyrics: Optional[str] = None
    title: Optional[str] = None
    aspectRatio: Literal["16:9", "9:16", "1:1"] = "16:9"
    klingDurationSec: Literal[5, 10] = 10
    negativePrompt: Optional[str] = None


def _storage_file_strict(key: str) -> Path:
    key = (key or "").strip().replace("\\", "/").lstrip("/")
    if not key or ".." in key or key.startswith("."):
        raise ValueError("Invalid storage key")
    p = (STORAGE_DIR / key).resolve()
    root = STORAGE_DIR.resolve()
    if not str(p).startswith(str(root)) or not p.is_file():
        raise ValueError("Storage file not found for key")
    return p


def _materialize_audio_for_video(params: dict[str, Any]) -> tuple[Path, list[Path]]:
    """
    Return path to a local audio file and a list of temp paths to delete after the job.
    """
    to_remove: list[Path] = []
    audio_url = (params.get("audioUrl") or "").strip()
    asset_key = (params.get("assetId") or "").strip()
    if asset_key:
        return _storage_file_strict(asset_key), to_remove
    if not audio_url:
        raise ValueError("Provide audioUrl (https or /api/storage/…) or assetId (storage key).")
    if audio_url.startswith(("http://", "https://")):
        low = audio_url.lower()
        suffix = ".mp3"
        if ".wav" in low.split("?", 1)[0]:
            suffix = ".wav"
        elif ".flac" in low.split("?", 1)[0]:
            suffix = ".flac"
        fd, tmp = tempfile.mkstemp(suffix=suffix)
        os.close(fd)
        p = Path(tmp)
        req = urllib.request.Request(audio_url, method="GET")
        try:
            with urllib.request.urlopen(req, timeout=180) as resp:
                p.write_bytes(resp.read())
        except Exception:
            p.unlink(missing_ok=True)
            raise
        to_remove.append(p)
        return p, to_remove
    m = re.search(r"/api/storage/([^/]+)/([^/?#]+)", audio_url)
    if m:
        p = (STORAGE_DIR / m.group(1) / m.group(2)).resolve()
        root = STORAGE_DIR.resolve()
        if not str(p).startswith(str(root)) or not p.is_file():
            raise ValueError("audioUrl did not resolve to a file on this server")
        return p, to_remove
    raise ValueError("audioUrl must be http(s) or contain /api/storage/{folder}/{file}")


def _run_video_job(job_id: str) -> None:
    with jobs_lock:
        jobs = _load_jobs()
        job = jobs.get(job_id)
        if not job:
            return
        job["status"] = "running"
        job["startedAt"] = time.time()
        _save_jobs(jobs)

    params: dict[str, Any] = job.get("params") or {}
    tmp_audio: list[Path] = []
    tmp_dir: Optional[str] = None
    try:
        if not kling_configured():
            raise RuntimeError(
                "Set AIMLAPI_KEY or KLING_API_KEY for Kling-class AI video (via AI/ML API). "
                "Optional KLING_VIDEO_MODEL defaults to klingai/video-v2-6-pro-text-to-video — "
                "set your provider's Kling 3.0 id when available. "
                "For offline beat-waveform video use POST /api/local/music-video."
            )

        audio_path, tmp_audio = _materialize_audio_for_video(params)
        det = detect_beats_from_path(audio_path)
        beats = [float(x) for x in (det.get("beat_times_seconds") or [])]
        bpm = float(det.get("tempo_bpm") or 120.0)
        title = (params.get("title") or params.get("projectId") or "Untitled") or "Untitled"
        prompt = build_kling_prompt_from_song(
            style=str(params.get("style") or "cinematic"),
            title=str(title),
            lyrics=str(params.get("lyrics") or ""),
            bpm=bpm,
            beat_count=len(beats),
        )
        aspect = params.get("aspectRatio") or "16:9"
        dur: Any = params.get("klingDurationSec") or 10
        if dur not in (5, 10):
            dur = 10
        neg = str(params.get("negativePrompt") or "")
        create_resp = create_text_to_video_task(
            prompt=prompt,
            aspect_ratio=aspect,  # type: ignore[arg-type]
            duration_sec=dur,  # type: ignore[arg-type]
            negative_prompt=neg,
            generate_audio=False,
        )
        gen_id = create_resp.get("id")
        if not gen_id:
            raise RuntimeError(f"No generation id from provider: {create_resp!r}")

        result = poll_generation(str(gen_id))
        st = (result.get("status") or "").lower()
        if st != "completed":
            raise RuntimeError(result.get("error") or result)
        vid_url = (result.get("video") or {}).get("url")
        if not vid_url:
            raise RuntimeError("Provider returned no video URL")

        tmp_dir = tempfile.mkdtemp(prefix="dieter_kling_")
        clip_path = Path(tmp_dir) / "kling_clip.mp4"
        download_video(str(vid_url), clip_path)

        out_dir = STORAGE_DIR / "video"
        out_dir.mkdir(parents=True, exist_ok=True)
        safe_name = f"{job_id}_kling_mux.mp4"
        out_path = out_dir / safe_name
        loop_video_and_mux_audio(clip_path, audio_path, out_path)

        rel_key = f"video/{safe_name}"
        out_payload = {
            "videoUrl": f"/api/storage/video/{safe_name}",
            "storageKey": rel_key,
            "klingGenerationId": gen_id,
            "beatMarkers": beats[:96],
            "bpm": bpm,
            "beatCount": len(beats),
            "promptUsed": prompt[:1200],
            "engine": "kling_aiml_mux",
            "note": "AI clip looped to track length; audio is YOUR song (not model audio).",
        }
        maybe_post_colab_webhook(
            {
                "type": "dieter.kling_mux.complete",
                "jobId": job_id,
                "output": out_payload,
            }
        )

        with jobs_lock:
            jobs = _load_jobs()
            job = jobs.get(job_id)
            if not job:
                return
            job["status"] = "succeeded"
            job["finishedAt"] = time.time()
            job["output"] = out_payload
            job["error"] = None
            _save_jobs(jobs)
    except Exception as e:
        logger.exception("video job %s failed", job_id)
        with jobs_lock:
            jobs = _load_jobs()
            job = jobs.get(job_id)
            if not job:
                return
            job["status"] = "failed"
            job["finishedAt"] = time.time()
            job["error"] = str(e)
            job["output"] = {"videoUrl": None, "beatMarkers": []}
            _save_jobs(jobs)
    finally:
        for p in tmp_audio:
            p.unlink(missing_ok=True)
        if tmp_dir:
            shutil.rmtree(tmp_dir, ignore_errors=True)


@app.post("/api/video/from-song")
def api_video_from_song(req: VideoFromSongRequest) -> dict[str, Any]:
    job_id = _new_id("jobv")
    job = {
        "jobId": job_id,
        "type": "video.from-song",
        "status": "queued",
        "createdAt": time.time(),
        "params": req.model_dump(),
    }
    with jobs_lock:
        jobs = _load_jobs()
        jobs[job_id] = job
        _save_jobs(jobs)

    t = threading.Thread(target=_run_video_job, args=(job_id,), daemon=True)
    t.start()

    return {"jobId": job_id, "status": "queued"}


@app.get("/api/video/job/{id}")
def api_video_job(id: str) -> dict[str, Any]:
    jobs = _load_jobs()
    job = jobs.get(id)
    if not job:
        raise HTTPException(status_code=404, detail="Video job not found")
    return {"jobId": job.get("jobId"), "status": job.get("status"), "output": job.get("output"), "error": job.get("error")}


@app.get("/api/video/capabilities")
def api_video_capabilities() -> dict[str, Any]:
    key, base, model = aiml_api_config()
    return {
        "klingPipeline": "Kling-class text-to-video (AI/ML API) + ffmpeg: loop AI clip, mux your track",
        "aimlConfigured": bool(key),
        "aimlBase": base if key else None,
        "videoModel": model if key else None,
        "colabWebhookConfigured": bool(os.environ.get("COLAB_VIDEO_WEBHOOK_URL", "").strip()),
        "beatSync": "Librosa BPM + beat times inform the text prompt; output audio is always your uploaded song.",
    }


class SeoSuggestRequest(BaseModel):
    title: str = Field(..., min_length=1)
    description: Optional[str] = None
    lyrics: Optional[str] = None
    tags: Optional[list[str]] = None
    genre: Optional[str] = None
    openaiApiKey: Optional[str] = None


@app.post("/api/seo/suggest")
def api_seo_suggest(req: SeoSuggestRequest) -> dict[str, Any]:
    pack, source = build_seo_pack(
        title=req.title.strip(),
        description=req.description,
        lyrics=req.lyrics,
        tags=req.tags,
        genre=req.genre,
        openai_api_key=req.openaiApiKey,
    )
    return {**pack, "packSource": source}


class SeoConfigUpsertRequest(BaseModel):
    targetKeywords: list[str] = Field(default_factory=list)
    platforms: list[str] = Field(default_factory=list)
    budgetPerMonth: float = 0.0


@app.post("/api/seo/{projectId}/config")
def api_seo_config(projectId: str, req: SeoConfigUpsertRequest) -> dict[str, Any]:
    cfg = _load_json(SEO_CONFIG_PATH, {})
    cfg[projectId] = {
        "projectId": projectId,
        "targetKeywords": req.targetKeywords,
        "platforms": req.platforms,
        "budgetPerMonth": req.budgetPerMonth,
        "updatedAt": time.time(),
    }
    _save_json(SEO_CONFIG_PATH, cfg)
    return {"ok": True, "projectId": projectId}


class SeoRoiUpsertRequest(BaseModel):
    source: str
    clicks: int = 0
    plays: int = 0
    revenue: float = 0.0


@app.post("/api/seo/{projectId}/roi")
def api_seo_roi(projectId: str, req: SeoRoiUpsertRequest) -> dict[str, Any]:
    roi = _load_json(SEO_ROI_PATH, {})
    roi_list = roi.get(projectId, [])
    roi_list.append(
        {
            "id": _new_id("roi"),
            "createdAt": time.time(),
            "source": req.source,
            "clicks": req.clicks,
            "plays": req.plays,
            "revenue": req.revenue,
        }
    )
    roi[projectId] = roi_list[-200:]  # keep small
    _save_json(SEO_ROI_PATH, roi)
    return {"ok": True}


class DirectorPlanRequest(BaseModel):
    projectId: str = Field(..., min_length=1)


@app.post("/api/director/plan")
def api_director_plan(req: DirectorPlanRequest) -> dict[str, Any]:
    cfg = _load_json(SEO_CONFIG_PATH, {}).get(req.projectId) or {}
    roi = _load_json(SEO_ROI_PATH, {}).get(req.projectId) or []
    platforms = cfg.get("platforms") or ["spotify", "youtube", "tiktok"]
    target_keywords = cfg.get("targetKeywords") or []

    # basic posting schedule heuristic
    cadence = []
    for p in platforms:
        cadence.append(
            {
                "platform": p,
                "postsPerWeek": 3 if p in ("tiktok", "instagram") else 1,
                "type": "shorts" if p in ("tiktok", "youtube") else "updates",
            }
        )

    return {
        "projectId": req.projectId,
        "platforms": platforms,
        "cadence": cadence,
        "targetKeywords": target_keywords,
        "roiSnapshot": roi[-1] if roi else None,
        "nextActions": [
            "Generate 3 short hooks (hook + 0:15 beat drop)",
            "Create one cinematic 30s teaser video with beat-locked cuts",
            "Publish to main distributor + schedule shorts for the first 7 days",
        ],
    }


class DirectorCampaignAssetsRequest(BaseModel):
    projectId: str = Field(..., min_length=1)
    platforms: Optional[list[str]] = None


@app.post("/api/director/campaign-assets")
def api_director_assets(req: DirectorCampaignAssetsRequest) -> dict[str, Any]:
    platforms = req.platforms or ["youtube", "tiktok", "spotify"]
    # Offline-safe placeholders; swap later with a real agent
    return {
        "projectId": req.projectId,
        "assets": [
            {
                "platform": p,
                "titles": [
                    f"{req.projectId}: New Era Hook",
                    f"{req.projectId}: Midnight Studio Vibes",
                    f"{req.projectId}: Beat-Synced Story",
                ],
                "caption": f"New release for the new-era music lovers. Hook is beat-locked—tell me what you hear in the drop.",
                "tags": ["new-era", "studio", "lyrics", "beat"],
            }
            for p in platforms
        ],
    }


def build_plan(prompt: str, bpm: int, mood: str) -> Plan:
    seed = abs(hash(prompt)) % (16**8)
    plan_id = f"plan_{seed:08x}"

    def sec(sec_id: str, start_bar: int, length_bar: int) -> PlanSection:
        start_s = round(((start_bar * 60) / bpm) * 4, 3)
        length_s = round(((length_bar * 60) / bpm) * 4, 3)
        return PlanSection(
            id=sec_id,
            start_bar=start_bar,
            length_bar=length_bar,
            start_s=start_s,
            length_s=length_s,
        )

    structure = [
        sec("intro", 0, 4),
        sec("verse1", 4, 8),
        sec("hook", 12, 8),
        sec("verse2", 20, 8),
        sec("bridge", 28, 8),
        sec("hook2", 36, 8),
        sec("outro", 44, 8),
    ]

    chords = [
        {"section": "verse1", "progression": ["Am7", "Fmaj7", "Cmaj7", "G7"]},
        {"section": "hook", "progression": ["Fmaj7", "G", "Am7", "Em7"]},
        {"section": "bridge", "progression": ["Dm7", "G7", "Cmaj7", "Am7"]},
    ]

    lyric_sections = [
        {"section": "verse1", "intent": "set the scene"},
        {"section": "hook", "intent": "repeatable hook"},
        {"section": "bridge", "intent": "twist / emotional lift"},
    ]

    return Plan(
        planId=plan_id,
        bpm=bpm,
        mood=mood,
        structure=structure,
        chords=chords,
        lyricSections=lyric_sections,
    )


def build_symbolic_score_plan(plan: Plan, *, seed: int) -> dict[str, Any]:
    """
    MIDI-like symbolic plan for UI + rendering.
    This is the contract a real music transformer would output/consume.
    """
    bars_total = max(1, plan.structure[-1].start_bar + plan.structure[-1].length_bar)
    ppq = 480
    tempo_bpm = plan.bpm

    # basic chord changes: one chord per bar in repeating 4-chord loop
    chord_loop = ["Am7", "Fmaj7", "Cmaj7", "G7"]
    chord_changes = []
    for bar in range(bars_total):
        chord_changes.append({"bar": bar, "chord": chord_loop[bar % len(chord_loop)]})

    # drum pattern (kick/snare/hat) as events on a 16-step grid
    drum_pattern = {
        "grid": "16n",
        "kick": [0, 8],
        "snare": [4, 12],
        "hat": [2, 6, 10, 14],
    }

    def note_event(track: str, bar: int, step16: int, midi: int, dur16: int, vel: int) -> dict[str, Any]:
        tick = (bar * 16 + step16) * (ppq // 4)  # 16th note
        dur = dur16 * (ppq // 4)
        return {
            "track": track,
            "t_tick": tick,
            "duration_tick": dur,
            "midi": midi,
            "velocity": vel,
            "channel": 0,
        }

    # simple multi-track "raw score"
    events: list[dict[str, Any]] = []
    # bass roots on bar downbeats
    bass_notes = [45, 41, 48, 43]  # A2, F2, C3, G2
    for bar in range(bars_total):
        events.append(note_event("bass", bar, 0, bass_notes[bar % 4], 8, 92))

    # keys triads (root+3rd+5th) sustained per bar
    triads = [
        (57, 60, 64),  # A3 C4 E4
        (53, 57, 60),  # F3 A3 C4
        (60, 64, 67),  # C4 E4 G4
        (55, 59, 62),  # G3 B3 D4
    ]
    for bar in range(bars_total):
        r, t, f = triads[bar % 4]
        events.append(note_event("keys", bar, 0, r, 16, 70))
        events.append(note_event("keys", bar, 0, t, 16, 70))
        events.append(note_event("keys", bar, 0, f, 16, 70))

    # lead motif: sparse notes on 8th steps
    lead_pool = [72, 74, 76, 79]  # C5 D5 E5 G5
    for bar in range(bars_total):
        if (bar + seed) % 2 == 0:
            events.append(note_event("lead", bar, 2, lead_pool[(bar + seed) % len(lead_pool)], 2, 84))
            events.append(note_event("lead", bar, 10, lead_pool[(bar + seed + 1) % len(lead_pool)], 2, 84))

    return {
        "tempo": {"bpm": tempo_bpm},
        "timeSignature": {"num": 4, "den": 4},
        "ppq": ppq,
        "bars": bars_total,
        "sections": [asdict(s) for s in plan.structure],
        "chordChanges": chord_changes,
        "drumPattern": drum_pattern,
        "events": events,
        "tracks": [
            {"id": "drums", "kind": "drums"},
            {"id": "bass", "kind": "instrument"},
            {"id": "keys", "kind": "instrument"},
            {"id": "lead", "kind": "instrument"},
            {"id": "vocals", "kind": "vocal"},
            {"id": "fx", "kind": "fx"},
        ],
    }


@app.post("/api/music/plan")
def api_plan(req: PlanRequest) -> dict[str, Any]:
    combined = (req.prompt + "\n" + (req.lyrics or "")).strip()
    plan = build_plan(combined, req.bpm, req.mood)
    seed = abs(hash(combined)) % (16**8)
    score_plan = build_symbolic_score_plan(plan, seed=seed)
    return {
        "planId": plan.planId,
        "bpm": plan.bpm,
        "mood": plan.mood,
        "structure": [asdict(s) for s in plan.structure],
        "chords": plan.chords,
        "lyricSections": plan.lyricSections,
        "lyrics": req.lyrics or "",
        "scorePlan": score_plan,
    }


def _run_generate_job(job_id: str) -> None:
    with jobs_lock:
        jobs = _load_jobs()
        job = jobs.get(job_id)
        if not job:
            return
        job["status"] = "running"
        job["startedAt"] = time.time()
        _save_jobs(jobs)

    try:
        prompt = job["params"]["prompt"]
        lyrics = job["params"].get("lyrics") or ""
        bpm = int(job["params"]["bpm"])
        mood = job["params"]["mood"]
        style = job["params"].get("style", "Cinematic")
        language = job["params"].get("language", "en")
        vocal_preset = job["params"].get("vocalPreset", "Radio")
        duration_s = int(job["params"]["durationSec"])
        stems = bool(job["params"]["stems"])

        seed = abs(hash(prompt)) % (16**8)
        asset_id = f"asset_{seed:08x}"

        out_dir = STORAGE_DIR / asset_id
        out_dir.mkdir(parents=True, exist_ok=True)

        combined = (prompt + "\n" + lyrics).strip()
        plan = build_plan(combined, bpm, mood)
        score_plan = build_symbolic_score_plan(plan, seed=abs(hash(combined)) % (16**8))

        engine_name = os.getenv("DIETER_AUDIO_ENGINE", "procedural")
        engine = get_engine(engine_name)
        res = engine.generate(
            out_dir=out_dir,
            prompt=prompt,
            lyrics=lyrics,
            language=language,
            vocal_preset=vocal_preset,
            bpm=bpm,
            duration_s=duration_s,
            seed=seed,
            render_stems=stems,
        )
        mix_path, stem_paths, stats = res.mix_path, res.stem_paths, res.stats

        output: dict[str, Any] = {
            "assetId": asset_id,
            "engine": {"name": engine.name},
            "mix": {
                "wavKey": f"{asset_id}/{mix_path.name}",
                "wavUrl": f"/api/storage/{asset_id}/{mix_path.name}",
            },
            "stems": [],
            "meta": {
                "bpm": bpm,
                "mood": mood,
                "style": style,
                "language": language,
                "vocalPreset": vocal_preset,
                "lyrics": lyrics,
                "durationSec": duration_s,
                "sampleRate": 44100,
                "analysis": {
                    "mixPeakDb": 20 * __import__("math").log10(max(1e-12, stats["mix"]["peak"])),
                    "mixRmsDb": 20 * __import__("math").log10(max(1e-12, stats["mix"]["rms"])),
                },
            },
            "plan": {"planId": plan.planId, "scorePlan": score_plan},
        }

        if stems:
            for name, p in stem_paths.items():
                output["stems"].append(
                    {
                        "name": name,
                        "wavKey": f"{asset_id}/{p.name}",
                        "wavUrl": f"/api/storage/{asset_id}/{p.name}",
                    }
                )

        with jobs_lock:
            jobs = _load_jobs()
            job = jobs.get(job_id)
            if not job:
                return
            job["status"] = "succeeded"
            job["finishedAt"] = time.time()
            job["output"] = output
            _save_jobs(jobs)
    except Exception as e:
        with jobs_lock:
            jobs = _load_jobs()
            job = jobs.get(job_id)
            if not job:
                return
            job["status"] = "failed"
            job["finishedAt"] = time.time()
            job["error"] = str(e)
            _save_jobs(jobs)


@app.post("/api/music/generate")
def api_generate(req: GenerateRequest) -> dict[str, Any]:
    job_id = _new_id("job")
    job = {
        "jobId": job_id,
        "type": "music.generate",
        "status": "queued",
        "createdAt": time.time(),
        "params": req.model_dump(),
    }
    with jobs_lock:
        jobs = _load_jobs()
        jobs[job_id] = job
        _save_jobs(jobs)

    t = threading.Thread(target=_run_generate_job, args=(job_id,), daemon=True)
    t.start()

    return {"jobId": job_id, "status": "queued"}


@app.get("/api/jobs/{job_id}", response_model=JobStatusResponse)
def api_job(job_id: str) -> JobStatusResponse:
    with jobs_lock:
        jobs = _load_jobs()
        job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return JobStatusResponse(
        jobId=job["jobId"],
        status=job["status"],
        output=job.get("output"),
        error=job.get("error"),
    )


@app.get("/api/storage/{asset_id}/{filename}")
def api_storage(asset_id: str, filename: str):
    # simple safe join
    p = (STORAGE_DIR / asset_id / filename).resolve()
    if not str(p).startswith(str((STORAGE_DIR / asset_id).resolve())):
        raise HTTPException(status_code=400, detail="Invalid path")
    if not p.exists() or not p.is_file():
        raise HTTPException(status_code=404, detail="File not found")

    from fastapi.responses import FileResponse

    ext = p.suffix.lower()
    media = (
        "audio/mpeg"
        if ext == ".mp3"
        else "audio/wav"
        if ext == ".wav"
        else "audio/flac"
        if ext == ".flac"
        else "video/mp4"
        if ext == ".mp4"
        else "video/webm"
        if ext == ".webm"
        else "application/octet-stream"
    )
    return FileResponse(
        str(p),
        media_type=media,
        filename=filename,
        content_disposition_type="inline",
    )


MUREKA_API_BASE = os.environ.get("MUREKA_API_BASE", "https://api.mureka.ai").rstrip("/")

_MAX_MUREKA_BEAT_BYTES = 80 * 1024 * 1024


def _synth_vocals_allowed() -> bool:
    return os.environ.get("DIETER_SYNTH_VOCALS", "").strip().lower() in ("1", "true", "yes", "on")


async def _mureka_beat_vocal_mix_from_bytes(
    beat_raw: bytes,
    lyrics: str,
    mureka_style: str,
    beat_filename: str,
    *,
    voice_id_ref: str | None = None,
    api_key_override: str | None = None,
) -> dict[str, Any]:
    """
    Mureka ``/v1/song/generate`` → poll → download, mix with user's beat (real cloud vocals).
    Output MP3 under ``storage/mureka_mix/`` served at ``/api/storage/mureka_mix/…``.
    """
    api_key = (api_key_override or os.environ.get("MUREKA_API_KEY") or "").strip()
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="Set MUREKA_API_KEY on this server for Mureka vocals + beat mix.",
        )
    if len(beat_raw) > _MAX_MUREKA_BEAT_BYTES:
        raise HTTPException(status_code=413, detail="Beat file too large (max ~80MB)")
    if len(beat_raw) < 256:
        raise HTTPException(status_code=400, detail="Beat audio too short or empty")
    if not (lyrics or "").strip():
        raise HTTPException(status_code=400, detail="Lyrics required for Mureka vocal generation.")

    job = uuid.uuid4().hex[:12]
    tmp_dir = STORAGE_DIR / "_mureka_tmp"
    mix_dir = STORAGE_DIR / "mureka_mix"
    tmp_dir.mkdir(parents=True, exist_ok=True)
    mix_dir.mkdir(parents=True, exist_ok=True)

    beat_suffix = Path(beat_filename or "beat").suffix.lower() or ".wav"
    if beat_suffix not in {".wav", ".wave", ".mp3", ".flac", ".ogg", ".m4a", ".aac", ".webm"}:
        beat_suffix = ".wav"

    beat_path = tmp_dir / f"_mureka_beat_{job}{beat_suffix}"
    mureka_audio = tmp_dir / f"_mureka_raw_{job}.audio"
    out_mp3 = mix_dir / f"master_mureka_{job}.mp3"

    bpm = 0.0
    n_beats = 0

    try:
        beat_path.write_bytes(beat_raw)
        try:
            y_beat, sr_beat = librosa.load(str(beat_path), sr=None, mono=True)
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Could not decode beat audio. Upload a real .wav/.mp3 file. "
                    "If you're running locally, install FFmpeg so librosa/audioread can decode."
                ),
            ) from e
        analysis = analyze(y_beat, sr_beat, max_beats_report=None)
        bpm = float(analysis["tempo_bpm"])
        n_beats = len(analysis["beats_all"])

        sync = MurekaSync(api_key)
        try:
            audio_url, _final = await sync.generate_track_url(
                lyrics.strip(),
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
        logger.exception("mureka beat+vocal mix failed")
        raise HTTPException(status_code=500, detail=str(e)) from e
    finally:
        for p in (beat_path, mureka_audio):
            try:
                if p.exists():
                    p.unlink()
            except OSError:
                pass

    name = out_mp3.name
    rel = f"/api/storage/mureka_mix/{name}"
    out: dict[str, Any] = {
        "song": rel,
        "song_url": rel,
        "audio_url": rel,
        "bpm": bpm,
        "beats_detected": n_beats,
        "pure": False,
        "source": "mureka",
        "stub": False,
        "message": "Mureka AI vocals mixed with your beat. Train custom voices on platform.mureka.ai.",
    }
    if voice_id_ref:
        out["voice_id"] = voice_id_ref
    return out


def _mureka_http(method: str, path: str, body: dict[str, Any] | None, bearer: str | None) -> dict[str, Any]:
    url = f"{MUREKA_API_BASE}{path}"
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if bearer:
        headers["Authorization"] = f"Bearer {bearer}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            raw = resp.read().decode("utf-8")
            if not raw.strip():
                return {}
            return json.loads(raw)
    except urllib.error.HTTPError as e:
        err_body = ""
        try:
            err_body = e.read().decode("utf-8")
            detail: Any = json.loads(err_body) if err_body.strip() else {"status": e.code}
        except Exception:
            detail = err_body or str(e.code)
        raise HTTPException(status_code=e.code, detail=detail) from e


def _mureka_token(authorization: str | None) -> str:
    token: str | None = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
    if not token:
        token = os.environ.get("MUREKA_API_KEY")
    if not token:
        raise HTTPException(
            status_code=401,
            detail="Missing Mureka API key (Authorization: Bearer … or env MUREKA_API_KEY).",
        )
    return token


class MurekaGenerateBody(BaseModel):
    lyrics: str = ""
    model: str = "auto"
    prompt: str = Field(..., min_length=1)


@app.post("/api/mureka/song/generate")
def api_mureka_song_generate(
    req: MurekaGenerateBody,
    authorization: str | None = Header(None),
) -> dict[str, Any]:
    """
    Proxy to Mureka POST /v1/song/generate (avoids browser CORS).
    Docs: https://platform.mureka.ai/docs/en/quickstart.html
    """
    token = _mureka_token(authorization)
    body = {"lyrics": req.lyrics, "model": req.model, "prompt": req.prompt}
    return _mureka_http("POST", "/v1/song/generate", body, token)


@app.get("/api/mureka/song/query/{task_id}")
def api_mureka_song_query(task_id: str, authorization: str | None = Header(None)) -> dict[str, Any]:
    """Proxy to Mureka GET /v1/song/query/{task_id}."""
    token = _mureka_token(authorization)
    return _mureka_http("GET", f"/v1/song/query/{task_id}", None, token)


@app.post("/api/pure-song-mureka")
async def api_pure_song_mureka(
    beat: UploadFile = File(...),
    lyrics: str = Form(...),
    mureka_style: str = Form("pop"),
    authorization: str | None = Header(None),
) -> dict[str, Any]:
    """
    **Mureka vocals + your beat:** calls Mureka ``/v1/song/generate``, polls, downloads,
    mixes with the uploaded beat. Requires **MUREKA_API_KEY** on the server.
    """
    started = time.perf_counter()
    raw = await beat.read()
    try:
        key_override = None
        if authorization and authorization.lower().startswith("bearer "):
            key_override = authorization[7:].strip()
        out = await _mureka_beat_vocal_mix_from_bytes(
            raw,
            lyrics,
            mureka_style,
            beat.filename or "beat.wav",
            api_key_override=key_override,
        )
        _record_perf("pure_song_mureka", True, (time.perf_counter() - started) * 1000.0)
        return out
    except HTTPException as e:
        _record_perf("pure_song_mureka", False, (time.perf_counter() - started) * 1000.0, detail=str(e.detail))
        raise
    except Exception as e:
        _record_perf("pure_song_mureka", False, (time.perf_counter() - started) * 1000.0, detail=str(e))
        raise


@app.post("/api/mureka/clone")
async def api_mureka_clone(
    voice_sample: UploadFile = File(...),
    voice_name: str = Form("Custom Voice"),
) -> dict[str, Any]:
    """
    Optional **offline** voice fingerprint (Coqui F0 lab). Real custom singing voices
    are trained on **platform.mureka.ai** — this endpoint does not replace that.
    """
    raw = await voice_sample.read()
    if len(raw) < 512:
        raise HTTPException(status_code=400, detail="Voice sample too small (need a few seconds of audio).")
    if vcp is not None:
        try:
            out = vcp.clone_voice_from_upload(
                sample_bytes=raw,
                voice_name=voice_name,
                temp_dir=BASE_DIR / "temp_voice_clone",
                library_root=STORAGE_DIR / "voice_clone",
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
        "note": "voice_clone_pipeline not importable — run from dieter-backend with deps installed.",
    }


@app.post("/api/mureka/generate")
async def api_mureka_generate(
    voice_id: str = Form(""),
    lyrics: str = Form(...),
    beat_file: UploadFile = File(...),
    mureka_style: str = Form("pop"),
    authorization: str | None = Header(None),
) -> dict[str, Any]:
    """
    **Default:** Mureka cloud vocals + your beat (same as ``/api/pure-song-mureka``).
    Optional ``voice_id`` is echoed for your records; Mureka custom voices are managed on their platform.

    **Legacy synthesis:** set env ``DIETER_SYNTH_VOCALS=true`` to allow Coqui TTS + F0 mix when no
    ``MUREKA_API_KEY`` is configured (not real cloned singing — dev only).
    """
    started = time.perf_counter()
    beat_raw = await beat_file.read()
    if len(beat_raw) < 256:
        raise HTTPException(status_code=400, detail="Beat file too small.")
    if not (lyrics or "").strip():
        raise HTTPException(status_code=400, detail="Lyrics required.")

    api_key = (os.environ.get("MUREKA_API_KEY") or "").strip()
    if not api_key and authorization and authorization.lower().startswith("bearer "):
        api_key = authorization[7:].strip()
    if api_key:
        try:
            out = await _mureka_beat_vocal_mix_from_bytes(
                beat_raw,
                lyrics,
                mureka_style,
                beat_file.filename or "beat.wav",
                voice_id_ref=(voice_id or "").strip() or None,
                api_key_override=api_key,
            )
            _record_perf("mureka_generate", True, (time.perf_counter() - started) * 1000.0)
            return out
        except HTTPException as e:
            _record_perf("mureka_generate", False, (time.perf_counter() - started) * 1000.0, detail=str(e.detail))
            raise
        except Exception as e:
            _record_perf("mureka_generate", False, (time.perf_counter() - started) * 1000.0, detail=str(e))
            raise

    if _synth_vocals_allowed() and vcp is not None and vcp.pipeline_available():
        if not (voice_id or "").strip():
            raise HTTPException(
                status_code=400,
                detail="voice_id required for offline synth, or set MUREKA_API_KEY for real Mureka vocals.",
            )
        try:
            out = vcp.generate_song_with_clone(
                voice_id=voice_id.strip(),
                lyrics=lyrics,
                beat_bytes=beat_raw,
                temp_dir=BASE_DIR / "temp_voice_clone",
                output_dir=STORAGE_DIR / "voice_clone",
                url_prefix="/api/storage/voice_clone",
            )
            _record_perf("mureka_generate_synth_fallback", True, (time.perf_counter() - started) * 1000.0)
            return out
        except KeyError:
            _record_perf("mureka_generate_synth_fallback", False, (time.perf_counter() - started) * 1000.0, detail="Voice not found")
            raise HTTPException(status_code=404, detail="Voice not found — run clone step again.") from None
        except ValueError as e:
            _record_perf("mureka_generate_synth_fallback", False, (time.perf_counter() - started) * 1000.0, detail=str(e))
            raise HTTPException(status_code=400, detail=str(e)) from e
        except Exception as e:
            logger.exception("voice clone generate failed")
            _record_perf("mureka_generate_synth_fallback", False, (time.perf_counter() - started) * 1000.0, detail=str(e))
            raise HTTPException(status_code=500, detail=str(e)) from e

    _record_perf(
        "mureka_generate",
        False,
        (time.perf_counter() - started) * 1000.0,
        detail="Missing MUREKA_API_KEY and synth fallback disabled",
    )
    raise HTTPException(
        status_code=503,
        detail=(
            "Configure MUREKA_API_KEY on the server for real Mureka AI vocals, "
            "or set DIETER_SYNTH_VOCALS=true for optional offline TTS (not recommended)."
        ),
    )


@app.post("/api/upload")
async def api_upload(file: UploadFile = File(...)) -> dict[str, Any]:
    # Real upload endpoint (stores raw files in storage/uploads/)
    up_id = _new_id("upload")
    dest_dir = STORAGE_DIR / "uploads"
    dest_dir.mkdir(parents=True, exist_ok=True)
    safe_name = os.path.basename(file.filename or "upload.bin")
    dest = dest_dir / f"{up_id}_{safe_name}"
    content = await file.read()
    dest.write_bytes(content)
    return {"uploadId": up_id, "key": f"uploads/{dest.name}", "url": f"/api/storage/uploads/{dest.name}"}


def _safe_storage_relative_key(key: str) -> Path:
    """Allow only keys like uploads/foo or local/bar under STORAGE_DIR."""
    key = (key or "").strip().replace("\\", "/").lstrip("/")
    if ".." in key or key.startswith("."):
        raise HTTPException(status_code=400, detail="Invalid key")
    p = (STORAGE_DIR / key).resolve()
    root = STORAGE_DIR.resolve()
    if not str(p).startswith(str(root)):
        raise HTTPException(status_code=400, detail="Invalid key path")
    if not p.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    return p


@app.get("/api/local/capabilities")
def api_local_capabilities() -> dict[str, Any]:
    """Librosa / ffmpeg / optional RVC+Tortoise pointers — no cloud."""
    return local_capabilities()


@app.post("/api/local/beat-detect")
async def api_local_beat_detect(file: UploadFile = File(...)) -> dict[str, Any]:
    """Extract BPM, beat times, onsets from an uploaded beat (wav/mp3/…)."""
    raw = Path(file.filename or "audio.wav")
    suffix = raw.suffix.lower() or ".wav"
    if suffix not in {".wav", ".mp3", ".flac", ".ogg", ".m4a", ".aac"}:
        raise HTTPException(
            status_code=400,
            detail="Supported extensions: .wav .mp3 .flac .ogg .m4a .aac",
        )
    body = await file.read()
    if len(body) > 80 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large (max ~80MB)")
    fd, tmp_path = tempfile.mkstemp(suffix=suffix)
    os.close(fd)
    try:
        Path(tmp_path).write_bytes(body)
        return detect_beats_from_path(Path(tmp_path))
    finally:
        Path(tmp_path).unlink(missing_ok=True)


class LocalMergeBody(BaseModel):
    beatKey: str = Field(..., min_length=3)
    vocalKey: str = Field(..., min_length=3)


@app.post("/api/local/merge")
def api_local_merge(req: LocalMergeBody) -> dict[str, Any]:
    """
    Mix beat + vocal stems with FFmpeg (requires ffmpeg on server PATH).
    Keys from POST /api/upload (e.g. uploads/upload_xxx_beat.mp3).
    """
    beat = _safe_storage_relative_key(req.beatKey)
    vocal = _safe_storage_relative_key(req.vocalKey)
    mix_id = _new_id("mix")
    out_dir = STORAGE_DIR / "local"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{mix_id}.mp3"
    try:
        merge_two_audio_mp3(beat, vocal, out_path)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
    rel = f"local/{out_path.name}"
    return {
        "mixId": mix_id,
        "key": rel,
        "url": f"/api/storage/local/{out_path.name}",
    }


class SunoMurekaMixBody(BaseModel):
    """Role names → storage keys (``uploads/…`` or ``local/…``). See GET ``/api/mix/suno-mureka/preset``."""

    stems: dict[str, str] = Field(
        ...,
        description="e.g. lead, double, harmony, kick, snare, bass — values are storage keys",
    )
    applyMaster: bool = Field(True, description="Apply Suno-style master chain after bus sum")


@app.get("/api/mix/suno-mureka/preset")
def api_mix_suno_mureka_preset() -> dict[str, Any]:
    """Full bus + master recipe (JSON) and allowed stem role names."""
    return preset_summary()


@app.post("/api/mix/suno-mureka/render")
def api_mix_suno_mureka_render(body: SunoMurekaMixBody) -> dict[str, Any]:
    """
    Mix stem files through the **vocal / drum / instrument** bus graph (FFmpeg), then optional master chain.
    Upload stems first via ``POST /api/upload`` or use existing ``local/…`` keys.
    """
    if not body.stems:
        raise HTTPException(status_code=400, detail="stems must not be empty")
    paths: dict[str, Path] = {}
    for role, raw_key in body.stems.items():
        k = (raw_key or "").strip()
        if not k:
            raise HTTPException(status_code=400, detail=f"Empty storage key for role {role!r}")
        paths[role] = _safe_storage_relative_key(k)
    mix_id = _new_id("suno")
    out_dir = STORAGE_DIR / "local"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{mix_id}_suno_mureka.mp3"
    try:
        meta = build_suno_mureka_mix(paths, out_path, master=body.applyMaster)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
    name = out_path.name
    return {
        **meta,
        "mixId": mix_id,
        "key": f"local/{name}",
        "url": f"/api/storage/local/{name}",
    }


@app.post("/api/local/master-audio")
async def api_local_master_audio(file: UploadFile = File(...)) -> dict[str, Any]:
    """
    Pro master chain: trim (default 3 min) + fade in/out + loudnorm (-14 LUFS) + MP3 320k.
    Requires ffmpeg/ffprobe on the server.
    """
    raw = Path(file.filename or "audio.mp3")
    suffix = raw.suffix.lower() or ".mp3"
    if suffix not in {".wav", ".mp3", ".flac", ".ogg", ".m4a", ".aac"}:
        raise HTTPException(
            status_code=400,
            detail="Supported: .wav .mp3 .flac .ogg .m4a .aac",
        )
    body = await file.read()
    if len(body) > 120 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large (max ~120MB)")
    fd, tmp_in = tempfile.mkstemp(suffix=suffix)
    os.close(fd)
    try:
        Path(tmp_in).write_bytes(body)
        out_id = _new_id("master")
        out_dir = STORAGE_DIR / "local"
        out_dir.mkdir(parents=True, exist_ok=True)
        out_path = out_dir / f"{out_id}_master.mp3"
        try:
            pro_master_audio(Path(tmp_in), out_path)
        except (RuntimeError, FileNotFoundError) as e:
            raise HTTPException(status_code=500, detail=str(e)) from e
        rel = f"local/{out_path.name}"
        return {
            "masterId": out_id,
            "key": rel,
            "url": f"/api/storage/local/{out_path.name}",
            "note": "Trim 3 min max, fade 2s/3s, loudnorm streaming targets, 44.1kHz 320k MP3",
        }
    finally:
        Path(tmp_in).unlink(missing_ok=True)


class CoverGenerateResponse(BaseModel):
    originalUrl: str
    take1Url: str
    take2Url: str
    mixUrl: Optional[str] = None
    bpm: Optional[float] = None
    meta: dict[str, Any] = {}


@app.post("/api/cover/generate")
async def api_cover_generate(
    stem: UploadFile = File(...),
    instrument: str = Form("electric_guitar"),
    style_prompt: str = Form(""),
    harmony_instrument: str = Form(""),
    harmony_semitones: float = Form(4.0),
    cover_blend: float = Form(0.3),
    original_gain_db: float = Form(0.0),
    cover_gain_db: float = Form(-6.0),
) -> CoverGenerateResponse:
    """
    Take ANY clip/stem → resynthesize a new instrument layer with timing/melody preserved.
    Produces two takes (variation seeds) + optional harmony layer, and an optional parallel blend mix.
    """
    raw = await stem.read()
    if len(raw) < 256:
        raise HTTPException(status_code=400, detail="Stem file too small.")
    if len(raw) > 120 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Stem too large (max ~120MB)")

    suffix = Path(stem.filename or "stem.wav").suffix.lower() or ".wav"
    cov_dir = STORAGE_DIR / "cover"
    tmp_dir = STORAGE_DIR / "_cover_tmp"
    cov_dir.mkdir(parents=True, exist_ok=True)
    tmp_dir.mkdir(parents=True, exist_ok=True)

    job = _new_id("cover")
    try:
        decoded = decode_to_wav(raw, suffix=suffix, out_dir=tmp_dir, target_sr=48000, mono=True)
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail="Could not decode audio. Upload a real .wav/.mp3 clip (install FFmpeg on the API host).",
        ) from e

    # Save original under storage/cover for later mixing
    original_out = cov_dir / f"{job}_original.wav"
    shutil.copyfile(str(decoded), str(original_out))

    inst = (instrument or "").strip() or "electric_guitar"
    harm_inst = (harmony_instrument or "").strip() or None
    try:
        take1, take2 = render_cover_two_takes(
            decoded,
            out_dir=cov_dir,
            instrument=inst,  # type: ignore[arg-type]
            style_prompt=style_prompt,
            harmony=harm_inst,  # type: ignore[arg-type]
            harmony_semitones=float(harmony_semitones),
            seed=abs(hash(job)) % (2**31),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.exception("cover generate failed")
        raise HTTPException(status_code=500, detail=str(e)) from e
    finally:
        decoded.unlink(missing_ok=True)

    # Rename takes to stable names for URLs
    t1_out = cov_dir / f"{job}_take1.wav"
    t2_out = cov_dir / f"{job}_take2.wav"
    try:
        shutil.move(str(take1.wav_path), str(t1_out))
        shutil.move(str(take2.wav_path), str(t2_out))
    except OSError:
        t1_out = take1.wav_path
        t2_out = take2.wav_path

    bpm_val: float | None = None
    try:
        # quick beat detect (optional; may fail for non-percussive stems)
        bd = detect_beats_from_path(original_out)
        bpm_val = float(bd.get("tempo_bpm")) if bd and bd.get("tempo_bpm") else None
    except Exception:
        bpm_val = None

    mix_url: str | None = None
    try:
        mix_out = cov_dir / f"{job}_mix.wav"
        _ = mix_parallel(
            original_wav=original_out,
            cover_wav=t1_out,
            out_path=mix_out,
            original_gain_db=float(original_gain_db),
            cover_gain_db=float(cover_gain_db),
            cover_blend=float(cover_blend),
        )
        mix_url = f"/api/storage/cover/{mix_out.name}"
    except Exception:
        mix_url = None

    return CoverGenerateResponse(
        originalUrl=f"/api/storage/cover/{original_out.name}",
        take1Url=f"/api/storage/cover/{t1_out.name}",
        take2Url=f"/api/storage/cover/{t2_out.name}",
        mixUrl=mix_url,
        bpm=bpm_val,
        meta={
            "instrument": inst,
            "harmony_instrument": harm_inst,
            "harmony_semitones": float(harmony_semitones),
            "note": "Two takes for Take Lanes. Default cover gain is -6dB; use parallel blend for richness.",
        },
    )


@app.post("/api/pipeline/generate-master")
async def api_pipeline_generate_master(
    beat: UploadFile = File(...),
    lyrics: str = Form(...),
    artist: str = Form("Transparent Programs"),
    title_hint: str = Form(""),
    bpm: float = Form(120.0),
    duration_sec: int = Form(45),
    vocal_preset: str = Form("Radio"),
    pitch_semitones: str = Form("0"),
    pitch_preset: str = Form(""),
) -> dict[str, Any]:
    """
    Beat file + lyrics → local procedural vocal → FFmpeg mix → ``pro_master_audio``.

    Pitch: optional ``pitch_preset`` (``deep_male``, ``male``, ``neutral``, ``female``, ``bright_female``)
    adds base semitones; ``pitch_semitones`` adds fine-tuning. Combined result is clamped to ±12.
    Engine order: FFmpeg **rubberband** (formants) if available, else **librosa** ``pitch_shift``, else rate-based FFmpeg.
    Override with env ``DIETER_PITCH_ENGINE=rubberband|librosa|ffmpeg_ps``.
    Returns storage keys and distributor **metadata stub** (manual upload only; no DistroKid API).
    """
    raw = Path(beat.filename or "beat.mp3")
    suffix = raw.suffix.lower() or ".mp3"
    if suffix not in {".wav", ".mp3", ".flac", ".ogg", ".m4a", ".aac"}:
        raise HTTPException(
            status_code=400,
            detail="Supported: .wav .mp3 .flac .ogg .m4a .aac",
        )
    body = await beat.read()
    if len(body) > 120 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large (max ~120MB)")
    hint = title_hint.strip() or None
    try:
        ps = float(str(pitch_semitones).strip() or "0")
    except ValueError:
        raise HTTPException(status_code=400, detail="pitch_semitones must be a number") from None
    pp = (pitch_preset or "").strip()
    if pp:
        try:
            preset_semitones(pp)
        except KeyError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e
    try:
        return generate_master_pipeline(
            body,
            suffix,
            lyrics,
            artist=artist.strip() or "Transparent Programs",
            title_hint=hint,
            bpm=bpm,
            duration_sec=duration_sec,
            vocal_preset=vocal_preset,
            pitch_semitones=ps,
            pitch_preset=pp,
            storage_root=STORAGE_DIR,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.post("/api/pipeline/upload-distrokid-prep")
async def api_pipeline_upload_distrokid_prep(
    file: UploadFile = File(...),
    metadata_json: str = Form("{}"),
) -> dict[str, Any]:
    """
    Save mastered audio + JSON metadata for **manual** distributor upload.
    Send ``metadata_json`` as a string field (valid JSON), not ``dict`` in Form.
    """
    raw = Path(file.filename or "master.mp3")
    suffix = raw.suffix.lower() or ".mp3"
    if suffix not in {".wav", ".mp3", ".flac", ".ogg", ".m4a", ".aac"}:
        raise HTTPException(
            status_code=400,
            detail="Supported: .wav .mp3 .flac .ogg .m4a .aac",
        )
    body = await file.read()
    if len(body) > 120 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large (max ~120MB)")
    try:
        return save_distro_prep_upload(body, raw.name, metadata_json, STORAGE_DIR)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@app.post("/api/local/music-video")
async def api_local_music_video(
    file: UploadFile = File(...),
    beat_times_json: str = Form("[]"),
    detect_beats: str = Form("true"),
    width: int = Form(1920),
    height: int = Form(1080),
    flash_sec: float = Form(0.07),
) -> dict[str, Any]:
    """
    FFmpeg **showwaves** + optional white flash on each beat (seconds). HeyGen/MAIVE-style
    AI video stays a separate integration; this route is offline and YouTube/TikTok–friendly (``+faststart``).

    - Pass ``beat_times_json`` as a JSON array of floats, **or** leave ``[]`` and set ``detect_beats=true`` to use librosa.
    - Set ``detect_beats=false`` and ``[]`` for waveform only (no flashes).
    """
    raw = Path(file.filename or "audio.wav")
    suffix = raw.suffix.lower() or ".wav"
    if suffix not in {".wav", ".mp3", ".flac", ".ogg", ".m4a", ".aac"}:
        raise HTTPException(
            status_code=400,
            detail="Supported: .wav .mp3 .flac .ogg .m4a .aac",
        )
    body = await file.read()
    if len(body) > 120 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large (max ~120MB)")

    w = max(320, min(3840, width))
    h = max(240, min(2160, height))
    flash = max(0.02, min(0.25, float(flash_sec)))

    beat_list: list[float] = []
    source = "none"
    want_detect = detect_beats.strip().lower() in ("true", "1", "yes", "on")

    if beat_times_json.strip():
        try:
            parsed = json.loads(beat_times_json)
        except json.JSONDecodeError as e:
            raise HTTPException(status_code=400, detail=f"beat_times_json: {e}") from e
        if parsed is not None and not isinstance(parsed, list):
            raise HTTPException(status_code=400, detail="beat_times_json must be a JSON array")
        if isinstance(parsed, list) and len(parsed) > 0:
            try:
                beat_list = [float(x) for x in parsed]
            except (TypeError, ValueError) as e:
                raise HTTPException(status_code=400, detail="beat_times_json must be an array of numbers") from e
            source = "client"

    fd, tmp_in = tempfile.mkstemp(suffix=suffix)
    os.close(fd)
    try:
        Path(tmp_in).write_bytes(body)
        if not beat_list and want_detect:
            det = detect_beats_from_path(Path(tmp_in))
            beat_list = det.get("beat_times_seconds") or []
            source = "librosa"
        out_id = _new_id("mv")
        out_dir = STORAGE_DIR / "local"
        out_dir.mkdir(parents=True, exist_ok=True)
        out_path = out_dir / f"{out_id}_music_video.mp4"
        try:
            generate_music_video(
                Path(tmp_in),
                beat_list,
                out_path,
                width=w,
                height=h,
                flash_sec=flash,
            )
        except (RuntimeError, FileNotFoundError, ValueError) as e:
            raise HTTPException(status_code=500, detail=str(e)) from e
    finally:
        Path(tmp_in).unlink(missing_ok=True)

    rel = f"local/{out_path.name}"
    return {
        "videoId": out_id,
        "key": rel,
        "url": f"/api/storage/local/{out_path.name}",
        "beatSource": source,
        "beatCount": len(beat_list),
        "note": "H.264 + AAC, +faststart. For AI avatars/clips, wire HeyGen/Runway separately.",
    }


class LocalTempoAlignBody(BaseModel):
    """Speed-correct a stem so timing matches a new BPM (FFmpeg atempo chain)."""

    audioKey: str = Field(..., min_length=3)
    fromBpm: float = Field(..., gt=0, le=400)
    toBpm: float = Field(..., gt=0, le=400)


@app.post("/api/local/tempo-align")
def api_local_tempo_align(req: LocalTempoAlignBody) -> dict[str, Any]:
    src = _safe_storage_relative_key(req.audioKey)
    out_id = _new_id("aligned")
    out_dir = STORAGE_DIR / "local"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{out_id}_aligned.mp3"
    try:
        stretch_audio_to_bpm_ratio(src, out_path, from_bpm=req.fromBpm, to_bpm=req.toBpm)
    except (RuntimeError, ValueError) as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
    rel = f"local/{out_path.name}"
    return {
        "alignedId": out_id,
        "key": rel,
        "url": f"/api/storage/local/{out_path.name}",
        "fromBpm": req.fromBpm,
        "toBpm": req.toBpm,
    }


class LocalProceduralVocalBody(BaseModel):
    """Offline procedural vocal stem (built-in synth) — swap for RVC/Tortoise output in production."""

    lyrics: str = ""
    prompt: str = Field("local vocal layer", min_length=1)
    bpm: float = Field(120, ge=40, le=240)
    vocalPreset: str = Field("Radio")
    durationSec: int = Field(45, ge=5, le=240)
    language: str = Field("en")
    pitchSemitones: float = Field(0, ge=-12, le=12)


def _wav_duration_seconds(path: Path) -> float:
    import wave

    with wave.open(str(path), "rb") as wf:
        return wf.getnframes() / float(wf.getframerate())


# SDC420-style voice_id → procedural vocalPreset (same as mureka-clone static page)
_SDC_VOICE_ID_TO_PRESET: dict[str, str] = {
    "male1": "Man-1",
    "male2": "Man-2",
    "male3": "Man-3",
    "male4": "Man-4",
    "male5": "Man-5",
    "male6": "Man-6",
    "female1": "Woman-1",
    "female2": "Woman-2",
    "female3": "Woman-3",
    "female4": "Woman-4",
    "female5": "Woman-5",
    "female6": "Woman-6",
    "man1": "Man-1",
    "man2": "Man-2",
    "man3": "Man-3",
    "man4": "Man-4",
    "man5": "Man-5",
    "man6": "Man-6",
    "woman1": "Woman-1",
    "woman2": "Woman-2",
    "woman3": "Woman-3",
    "woman4": "Woman-4",
    "woman5": "Woman-5",
    "woman6": "Woman-6",
}


def _sdc_voice_id_to_preset(voice_id: str) -> str:
    k = (voice_id or "").strip().lower().replace(" ", "").replace("-", "")
    return _SDC_VOICE_ID_TO_PRESET.get(k, "Man-2")


def _procedural_vocal_layer_core(
    *,
    prompt: str,
    lyrics: str,
    bpm: float,
    vocal_preset: str,
    duration_sec: int,
    language: str,
    pitch_semitones: float,
) -> dict[str, Any]:
    """Shared implementation for JSON + multipart procedural vocal routes."""
    out_id = _new_id("voc")
    out_dir = STORAGE_DIR / "local" / f"vocal_{out_id}"
    out_dir.mkdir(parents=True, exist_ok=True)
    seed = abs(hash((prompt, lyrics, bpm))) % (16**8)
    engine_name = os.getenv("DIETER_AUDIO_ENGINE", "procedural")
    engine = get_engine(engine_name)
    bpm_i = int(round(bpm))
    try:
        res = engine.generate(
            out_dir=out_dir,
            prompt=prompt,
            lyrics=lyrics or "",
            language=language,
            vocal_preset=vocal_preset,
            bpm=bpm_i,
            duration_s=duration_sec,
            seed=seed,
            render_stems=True,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    stem_paths = res.stem_paths
    vocal_path = stem_paths.get("vocals")
    if not vocal_path or not vocal_path.is_file():
        raise HTTPException(status_code=500, detail="Vocal stem missing from engine output")
    dest = STORAGE_DIR / "local" / f"{out_id}_vocals.wav"
    dest.write_bytes(vocal_path.read_bytes())
    ps = float(pitch_semitones)
    pitch_extra: dict[str, Any] = {}
    if abs(ps) > 1e-6:
        fd, tmp_name = tempfile.mkstemp(suffix="_pitched.wav", dir=dest.parent)
        os.close(fd)
        tmp_pitched = Path(tmp_name)
        try:
            pr = pitch_shift_semitones_preserve_duration(dest, tmp_pitched, ps)
            pitch_extra["pitchEngine"] = pr.engine_used
            if pr.warning:
                pitch_extra["pitchWarning"] = pr.warning
        except RuntimeError as e:
            tmp_pitched.unlink(missing_ok=True)
            raise HTTPException(status_code=500, detail=str(e)) from e
        except (OSError, ValueError) as e:
            tmp_pitched.unlink(missing_ok=True)
            raise HTTPException(status_code=500, detail=f"Vocal pitch shift failed: {e}") from e
        try:
            dest.unlink(missing_ok=True)
            shutil.move(str(tmp_pitched), str(dest))
        except OSError:
            tmp_pitched.unlink(missing_ok=True)
            raise
    rel = f"local/{dest.name}"
    out: dict[str, Any] = {
        "vocalLayerId": out_id,
        "key": rel,
        "url": f"/api/storage/local/{dest.name}",
        "bpm": bpm_i,
        "engine": engine.name,
        "pitchSemitones": round(ps, 4),
        "duration_seconds": round(_wav_duration_seconds(dest), 4),
        "note": "Procedural placeholder timbre — replace with RVC/Tortoise render for real voices. Other stems remain under storage/local/vocal_* on the server.",
    }
    out.update(pitch_extra)
    return out


@app.post("/api/local/procedural-vocal-layer")
def api_local_procedural_vocal_layer(req: LocalProceduralVocalBody) -> dict[str, Any]:
    """
    Renders a WAV vocal stem with the local procedural engine (no cloud).
    Pair with uploaded beat + /api/local/merge, or tempo-align first.
    """
    return _procedural_vocal_layer_core(
        prompt=req.prompt,
        lyrics=req.lyrics,
        bpm=req.bpm,
        vocal_preset=req.vocalPreset,
        duration_sec=req.durationSec,
        language=req.language,
        pitch_semitones=req.pitchSemitones,
    )


@app.post("/api/local/procedural-vocal-layer-form")
async def api_local_procedural_vocal_layer_form(
    voice_id: str = Form(...),
    pitchSemitones: float = Form(0.0),
    lyrics: str = Form(""),
    beat_bpm: Optional[int] = Form(None),
    vocal_duration_sec: Optional[int] = Form(None),
    beat_file: Optional[UploadFile] = File(None),
) -> dict[str, Any]:
    """
    SDC420-style multipart: ``voice_id`` (e.g. male2), optional beat file for BPM/duration,
    else ``beat_bpm`` + optional ``vocal_duration_sec``. Same engine + pitch pipeline as JSON route.

    **Do not** replace the full ``main.py`` with a minimal stub — this route reuses DIETER's engine.
    """
    bpm_f = float(beat_bpm or 120)
    duration_sec = 45
    if vocal_duration_sec is not None:
        duration_sec = int(min(240, max(5, int(vocal_duration_sec))))

    if beat_file is not None and (beat_file.filename or "").strip():
        raw = Path(beat_file.filename or "beat.wav")
        suffix = raw.suffix.lower() or ".wav"
        if suffix not in {".wav", ".mp3", ".flac", ".ogg", ".m4a", ".aac"}:
            raise HTTPException(
                status_code=400,
                detail="beat_file: use .wav .mp3 .flac .ogg .m4a .aac",
            )
        body = await beat_file.read()
        if len(body) > 80 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="beat_file too large (max ~80MB)")
        fd, tmp_path = tempfile.mkstemp(suffix=suffix)
        os.close(fd)
        try:
            Path(tmp_path).write_bytes(body)
            det = detect_beats_from_path(Path(tmp_path))
            if det.get("tempo_bpm"):
                bpm_f = float(det["tempo_bpm"])
            if det.get("duration_seconds") is not None:
                duration_sec = int(
                    min(240, max(5, int(round(float(det["duration_seconds"])))))
                )
        finally:
            Path(tmp_path).unlink(missing_ok=True)
    else:
        bpm_f = float(beat_bpm or 120)
        bpm_f = max(40.0, min(240.0, bpm_f))

    bpm_f = max(40.0, min(240.0, bpm_f))
    preset = _sdc_voice_id_to_preset(voice_id)
    ps = max(-12.0, min(12.0, float(pitchSemitones)))

    out = _procedural_vocal_layer_core(
        prompt="SDC420 multipart vocal layer",
        lyrics=lyrics,
        bpm=bpm_f,
        vocal_preset=preset,
        duration_sec=duration_sec,
        language="en",
        pitch_semitones=ps,
    )
    # Aliases for clients expecting the SDC420 stub response shape
    out["success"] = True
    out["voice_id"] = voice_id.strip()
    out["vocal_path"] = str(STORAGE_DIR / out["key"])
    out["duration"] = out.get("duration_seconds")
    return out


@app.get("/api/local/vocal/status")
def api_local_vocal_status() -> dict[str, Any]:
    """RVC + Tortoise are external processes — integrate via Docker or CLI."""
    rvc_url = os.environ.get("RVC_BASE_URL", "").strip().rstrip("/")
    return {
        "rvc": {
            "mode": "external",
            "clone": "https://github.com/RVC-Project/Retrieval-based-Voice-Conversion-WebUI",
            "train": "10–30 min clean voice clips; ethical consent required.",
            "baseUrlConfigured": bool(rvc_url),
            "baseUrl": rvc_url if rvc_url else None,
        },
        "tortoise": {
            "mode": "external",
            "repo": "https://github.com/neonbjb/tortoise-tts",
            "note": "Speech synthesis; chain with RVC for singing voice conversion.",
        },
        "next": "Expose a small HTTP shim on your GPU host and set RVC_BASE_URL; optional body POST forwarder can be added next.",
    }


_TRPC_UPSTREAM = os.environ.get("DIETER_TRPC_UPSTREAM", "").strip().rstrip("/")

if _TRPC_UPSTREAM:
    from fastapi import Request
    from fastapi.responses import Response
    import httpx

    @app.api_route("/trpc/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
    async def _proxy_trpc(path: str, request: Request) -> Response:
        """Forward browser /trpc → internal DIETER tRPC (docker-compose or sidecar). Same-origin tRPC + REST on one port."""
        q = request.query_params
        qs = f"?{q}" if q else ""
        url = f"{_TRPC_UPSTREAM}/trpc/{path}{qs}"
        body = await request.body()
        headers = {
            k: v
            for k, v in request.headers.items()
            if k.lower() not in ("host", "connection", "content-length", "transfer-encoding")
        }
        timeout = httpx.Timeout(300.0, connect=30.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            try:
                r = await client.request(request.method, url, content=body, headers=headers)
            except httpx.RequestError as e:
                raise HTTPException(status_code=502, detail=f"tRPC upstream failed: {e}") from e
        pass_headers = {}
        for h in ("content-type", "content-length"):
            if h in r.headers:
                pass_headers[h] = r.headers[h]
        return Response(content=r.content, status_code=r.status_code, headers=pass_headers)


# --- Production: React SPA from static/ (see Dockerfile + DEPLOY_RENDER.md) ---
def _mount_spa() -> None:
    if not _SERVE_SPA:
        return
    from starlette.staticfiles import StaticFiles

    static_root = BASE_DIR / "static"
    app.mount("/", StaticFiles(directory=str(static_root), html=True), name="spa")


_mount_spa()

