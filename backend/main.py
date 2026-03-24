"""
FastAPI server: beat detection for React (VITE_API_BASE=http://localhost:8000).

Run: uvicorn main:app --reload --host 0.0.0.0 --port 8000
"""
from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

# Import detect_beats from sibling ../local-audio/beat_detect.py
_ROOT = Path(__file__).resolve().parent.parent
_LOCAL_AUDIO = _ROOT / "local-audio"
if _LOCAL_AUDIO.is_dir() and str(_LOCAL_AUDIO) not in sys.path:
    sys.path.insert(0, str(_LOCAL_AUDIO))

from beat_detect import detect_beats  # noqa: E402

app = FastAPI(title="DIETER Beat API", version="1.0.0")

# React / Vite dev servers (any localhost port)
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/detect-beats")
async def detect_beats_endpoint(file: UploadFile = File(...)) -> dict:
    """
    Accept an audio upload, run librosa beat tracking, return BPM and beat times.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename")

    suffix = Path(file.filename).suffix.lower()
    if suffix not in {".wav", ".wave", ".mp3", ".flac", ".ogg", ".m4a", ".aac", ".webm"}:
        suffix = ".wav"

    tmp_path: str | None = None
    try:
        body = await file.read()
        if not body:
            raise HTTPException(status_code=400, detail="Empty upload")

        fd, tmp_path = tempfile.mkstemp(suffix=suffix, prefix="upload_")
        try:
            with os.fdopen(fd, "wb") as out:
                out.write(body)
        except Exception:
            os.close(fd)
            raise

        result = detect_beats(tmp_path)
        bpm = float(result["bpm_estimate"])
        beats = list(result["beat_times_sec"])

        return {"bpm": bpm, "beats": beats, "status": "success"}
    except HTTPException:
        raise
    except FileNotFoundError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Beat detection failed: {e}") from e
    finally:
        if tmp_path and os.path.isfile(tmp_path):
            try:
                os.unlink(tmp_path)
            except OSError:
                pass


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
