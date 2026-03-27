"""Sample voice library: list + upload WAVs under ``voices/man`` and ``voices/woman``; files served at ``/voices/...``."""
from __future__ import annotations

import re
import uuid
from pathlib import Path
from typing import Any, Literal

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

_BACKEND_ROOT = Path(__file__).resolve().parent.parent
VOICES_DIR = (_BACKEND_ROOT / "voices").resolve()
MAN_DIR = VOICES_DIR / "man"
WOMAN_DIR = VOICES_DIR / "woman"

_MAX_UPLOAD_BYTES = 25 * 1024 * 1024
_SAFE_NAME = re.compile(r"^[a-zA-Z0-9._-]{1,120}$")

router = APIRouter(prefix="/voices", tags=["voices"])


def _ensure_dirs() -> None:
    MAN_DIR.mkdir(parents=True, exist_ok=True)
    WOMAN_DIR.mkdir(parents=True, exist_ok=True)


def _list_wavs_in(sub: Path, *, limit: int = 12) -> list[dict[str, Any]]:
    if not sub.is_dir():
        return []
    out: list[Path] = []
    for p in sorted(sub.iterdir()):
        if p.is_file() and p.suffix.lower() == ".wav":
            out.append(p)
        if len(out) >= limit:
            break
    rel = "voices"
    return [
        {
            "name": p.name,
            "url": f"/voices/{p.relative_to(VOICES_DIR).as_posix()}",
        }
        for p in out
    ]


@router.get("/list")
def list_voices() -> dict[str, Any]:
    """Return up to 12 WAV samples per category (paths under ``/voices``)."""
    _ensure_dirs()
    return {
        "man": _list_wavs_in(MAN_DIR),
        "woman": _list_wavs_in(WOMAN_DIR),
    }


@router.post("/upload")
async def upload_voice(
    category: Literal["man", "woman"] = Form(...),
    file: UploadFile = File(...),
) -> dict[str, Any]:
    """Save a user upload as ``man/*.wav`` or ``woman/*.wav``."""
    _ensure_dirs()
    raw = await file.read()
    if len(raw) > _MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="file too large (max 25MB)")
    if len(raw) < 64:
        raise HTTPException(status_code=400, detail="empty or too small file")

    orig = (file.filename or "voice.wav").strip()
    base = Path(orig).name
    if not base.lower().endswith(".wav"):
        base = f"{base}.wav"
    if not _SAFE_NAME.match(base):
        base = f"{uuid.uuid4().hex[:12]}.wav"

    dest_dir = MAN_DIR if category == "man" else WOMAN_DIR
    dest = (dest_dir / base).resolve()
    if not str(dest).startswith(str(dest_dir.resolve())):
        raise HTTPException(status_code=400, detail="invalid path")
    dest.write_bytes(raw)

    rel = f"/voices/{category}/{dest.name}"
    return {"url": rel, "name": dest.name, "category": category}
