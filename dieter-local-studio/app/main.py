"""
DIETER Local Studio API — Librosa beats, FFmpeg mix, RVC/Tortoise hooks (no cloud).
"""

from __future__ import annotations

import os
import shutil
import uuid
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from .beats import analyze_beats, snap_lyrics_lines_to_beats
from .vocal_jobs import create_vocal_job, get_job, run_ffmpeg_mix

BASE_DIR = Path(__file__).resolve().parent.parent
UPLOAD_DIR = BASE_DIR / "data" / "uploads"
OUTPUT_DIR = BASE_DIR / "data" / "out"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="DIETER Local Studio", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/local/health")
def health() -> dict:
    return {
        "ok": True,
        "service": "dieter-local-studio",
        "rvc_webui_dir_set": bool(os.environ.get("RVC_WEBUI_DIR")),
        "tortoise_dir_set": bool(os.environ.get("TORTOISE_DIR")),
        "ethical_voice_dir_set": bool(os.environ.get("DIETER_ETHICAL_VOICE_DIR")),
    }


@app.post("/api/local/upload")
async def upload_audio(file: UploadFile = File(...)) -> dict:
    ext = Path(file.filename or "audio.wav").suffix.lower() or ".wav"
    if ext not in {".wav", ".mp3", ".flac", ".ogg", ".m4a"}:
        ext = ".wav"
    uid = uuid.uuid4().hex[:12]
    dest = UPLOAD_DIR / f"{uid}{ext}"
    with dest.open("wb") as f:
        shutil.copyfileobj(file.file, f)
    return {"fileId": uid + ext, "path": str(dest.relative_to(BASE_DIR))}


class AnalyzeBody(BaseModel):
    file_id: str = Field(..., min_length=3)


@app.post("/api/local/beats/analyze")
def beats_analyze(body: AnalyzeBody) -> dict:
    p = UPLOAD_DIR / body.file_id
    if not p.is_file():
        raise HTTPException(404, f"file not found: {body.file_id}")
    result = analyze_beats(p)
    return result


class SyncGridBody(BaseModel):
    file_id: str
    line_count: int = Field(8, ge=1, le=128)


@app.post("/api/local/beats/sync-grid")
def sync_grid(body: SyncGridBody) -> dict:
    p = UPLOAD_DIR / body.file_id
    if not p.is_file():
        raise HTTPException(404, "file not found")
    a = analyze_beats(p)
    grid = snap_lyrics_lines_to_beats(
        a["beat_times_sec"], a["duration_sec"], body.line_count
    )
    return {"analysis": a, "lyric_sync_grid": grid}


class VocalJobBody(BaseModel):
    lyrics: str = ""
    file_id: str
    voice_profile: str = "default"


@app.post("/api/local/vocal/job")
def vocal_job(body: VocalJobBody) -> dict:
    p = UPLOAD_DIR / body.file_id
    if not p.is_file():
        raise HTTPException(404, "beat file not found")
    return create_vocal_job(body.lyrics, body.file_id, body.voice_profile)


@app.get("/api/local/vocal/job/{job_id}")
def vocal_job_status(job_id: str) -> dict:
    j = get_job(job_id)
    if not j:
        raise HTTPException(404, "unknown job")
    return j


class MixBody(BaseModel):
    beat_file_id: str
    vocal_file_id: str
    out_name: str = "mix.mp3"


@app.post("/api/local/mix/ffmpeg")
def mix_ffmpeg(body: MixBody) -> dict:
    beat = UPLOAD_DIR / body.beat_file_id
    vocal = UPLOAD_DIR / body.vocal_file_id
    if not beat.is_file() or not vocal.is_file():
        raise HTTPException(404, "beat or vocal file missing")
    out = OUTPUT_DIR / body.out_name.replace("/", "_")
    return run_ffmpeg_mix(beat, vocal, out)


@app.get("/api/local/out/{name}")
def download_out(name: str):
    safe = Path(name).name
    p = OUTPUT_DIR / safe
    if not p.is_file():
        raise HTTPException(404)
    return FileResponse(p, filename=safe, media_type="audio/mpeg")
