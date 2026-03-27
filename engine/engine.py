"""
Lyrics → song HTTP worker (small image, no Torch/Audiocraft).

Uses Mureka Cloud when MUREKA_API_KEY is set: POST /v1/song/generate, poll /v1/song/query/{id},
download the rendered file into /app/output and serve it at /output/...

Docs: https://platform.mureka.ai/docs/en/quickstart.html
"""
from __future__ import annotations

import asyncio
import os
import re
from pathlib import Path
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

OUTPUT_DIR = Path(os.environ.get("OUTPUT_DIR", "/app/output")).resolve()
VOICES_DIR = Path(os.environ.get("VOICES_DIR", "/app/voices")).resolve()
MUREKA_BASE = os.environ.get("MUREKA_API_BASE", "https://api.mureka.ai").rstrip("/")
POLL_SEC = float(os.environ.get("MUREKA_POLL_SEC", "2"))
POLL_MAX = int(os.environ.get("MUREKA_POLL_MAX", "90"))

app = FastAPI(title="Lyrics engine (Mureka proxy)", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def extract_audio_url(obj: Any, depth: int = 0) -> str | None:
    if not obj or depth > 12:
        return None
    if (
        isinstance(obj, str)
        and re.match(r"^https?://", obj)
        and re.search(r"\.(mp3|wav|m4a|ogg)(\?|$)", obj, re.I)
    ):
        return obj
    if isinstance(obj, dict):
        for k in ("mp3_url", "audio_url", "url", "download_url", "file_url", "song_url"):
            v = obj.get(k)
            if isinstance(v, str) and v.startswith("http"):
                return v
        for v in obj.values():
            u = extract_audio_url(v, depth + 1)
            if u:
                return u
    return None


def task_failed(body: dict[str, Any]) -> bool:
    st = f'{body.get("status") or body.get("state") or ""}'.lower()
    if "fail" in st or "error" in st:
        return True
    return "error" in body


class SongRequest(BaseModel):
    lyrics: str = Field(..., min_length=10, max_length=12000)
    style: str = Field("pop", max_length=500)
    voice: str | None = Field(
        None,
        max_length=120,
        description="Optional hint appended to Mureka prompt (not RVC in this image).",
    )
    duration: int = Field(180, ge=30, le=600)
    model: str = Field("auto", max_length=80)


@app.on_event("startup")
def _startup() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    VOICES_DIR.mkdir(parents=True, exist_ok=True)


@app.get("/health")
def health() -> dict[str, str]:
    key = bool(os.environ.get("MUREKA_API_KEY", "").strip())
    return {"ok": "true", "mureka": "configured" if key else "missing_key"}


@app.get("/voices")
def list_voices() -> list[dict[str, str]]:
    if not VOICES_DIR.is_dir():
        return []
    out: list[dict[str, str]] = []
    for p in sorted(VOICES_DIR.rglob("*.wav")):
        try:
            rel = p.relative_to(VOICES_DIR)
        except ValueError:
            continue
        out.append({"name": p.stem, "path": str(rel.as_posix())})
    return out[:200]


@app.post("/generate")
async def generate(req: SongRequest) -> dict[str, Any]:
    api_key = os.environ.get("MUREKA_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail=(
                "MUREKA_API_KEY is not set. This image does not bundle Audiocraft/RVC/GPU; "
                "configure a key from platform.mureka.ai or run the main dieter-backend stack."
            ),
        )

    prompt_parts = [
        req.style,
        "professional vocals",
        "full production",
        f"approximately {req.duration} seconds",
    ]
    if req.voice:
        prompt_parts.append(f"vocal direction: {req.voice}")
    prompt = ", ".join(prompt_parts)

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "Dieter-lyrics-engine/1.0",
    }
    gen_body = {"lyrics": req.lyrics, "model": req.model, "prompt": prompt}

    async with httpx.AsyncClient(timeout=120.0) as client:
        gr = await client.post(f"{MUREKA_BASE}/v1/song/generate", headers=headers, json=gen_body)
        try:
            gjson = gr.json() if gr.content else {}
        except Exception:  # noqa: BLE001
            gjson = {"raw": gr.text[:2000]}

        if not gr.is_success:
            raise HTTPException(status_code=gr.status_code, detail=gjson)

        task_id = str(gjson.get("task_id") or gjson.get("id") or gjson.get("taskId") or "").strip()
        if not task_id:
            raise HTTPException(status_code=502, detail={"error": "No task id", "upstream": gjson})

        audio_url: str | None = None
        last: dict[str, Any] = {}
        for _ in range(POLL_MAX):
            qr = await client.get(
                f"{MUREKA_BASE}/v1/song/query/{task_id}",
                headers={k: v for k, v in headers.items() if k != "Content-Type"},
            )
            try:
                last = qr.json() if qr.content else {}
            except Exception:
                last = {}

            if not qr.is_success:
                raise HTTPException(status_code=qr.status_code, detail=last or qr.text)

            audio_url = extract_audio_url(last)
            if audio_url:
                break
            if task_failed(last):
                raise HTTPException(status_code=502, detail=last)
            await asyncio.sleep(POLL_SEC)
        else:
            raise HTTPException(status_code=504, detail={"error": "poll_timeout", "last": last})

        dr = await client.get(audio_url, timeout=120.0, follow_redirects=True)
        if not dr.is_success:
            raise HTTPException(
                status_code=502,
                detail={"error": "download_failed", "status": dr.status_code},
            )

        ext = ".mp3"
        low = audio_url.lower()
        if ".wav" in low.split("?", 1)[0]:
            ext = ".wav"
        elif ".m4a" in low.split("?", 1)[0]:
            ext = ".m4a"

        fname = f"{task_id}{ext}"
        dest = OUTPUT_DIR / fname
        dest.write_bytes(dr.content)

        rel = f"/output/{fname}"
        return {
            "full_song": rel,
            "task_id": task_id,
            "duration_sec": req.duration,
            "source": "mureka",
            "stems": [],
            "note": "Stem URLs only if Mureka returns them on the query payload; this worker saves the main render only.",
        }


OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
VOICES_DIR.mkdir(parents=True, exist_ok=True)

app.mount(
    "/output",
    StaticFiles(directory=str(OUTPUT_DIR), html=False),
    name="output",
)
