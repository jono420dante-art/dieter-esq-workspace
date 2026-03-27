"""
FastAPI entry: lyrics → Bark → optional RVC + Pedalboard; beat analysis; full sync pipeline.
"""
from __future__ import annotations

import logging
import re
import threading
import uuid
from collections.abc import Callable
from pathlib import Path

import torch
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from beat_service import analyze_beat_track
from generator import generate_bark_wav
from jobs import job_create, job_get, job_update
from locales import DEFAULT_VOICE_BY_LANG, default_voice_for_lang, normalize_lang, optional_detect_language
from pipeline import run_full_vocal_pipeline
from processor import (
    CACHE_DIR,
    EXPORTS_DIR,
    list_rvc_model_names,
    polish_only,
    rvc_available,
    transform_to_real_vocal,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MAX_UPLOAD_BYTES = int(__import__("os").environ.get("VOCAL_MAX_UPLOAD_MB", "40")) * 1024 * 1024

BARK_VOICE_PRESETS: list[dict[str, str]] = [
    {"id": "v2/en_speaker_0", "label": "EN Speaker 0"},
    {"id": "v2/en_speaker_1", "label": "EN Speaker 1"},
    {"id": "v2/en_speaker_2", "label": "EN Speaker 2"},
    {"id": "v2/en_speaker_3", "label": "EN Speaker 3"},
    {"id": "v2/en_speaker_4", "label": "EN Speaker 4"},
    {"id": "v2/en_speaker_5", "label": "EN Speaker 5"},
    {"id": "v2/en_speaker_6", "label": "EN Speaker 6 (English default)"},
    {"id": "v2/en_speaker_7", "label": "EN Speaker 7"},
    {"id": "v2/en_speaker_8", "label": "EN Speaker 8"},
    {"id": "v2/en_speaker_9", "label": "EN Speaker 9"},
    {"id": "v2/nl_speaker_0", "label": "NL Speaker 0 — Dutch (Afrikaans phonetics)"},
    {"id": "v2/nl_speaker_1", "label": "NL Speaker 1"},
    {"id": "v2/nl_speaker_2", "label": "NL Speaker 2"},
    {"id": "v2/nl_speaker_3", "label": "NL Speaker 3"},
]


def _install_cors(app: FastAPI) -> None:
    """Public deployments: set VOCAL_CORS_ORIGINS=* for any web origin (credentials off per CORS spec)."""
    import os

    raw = os.environ.get(
        "VOCAL_CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://127.0.0.1:3000",
    ).strip()
    if raw in ("*", "all") or raw.lower() == "allow_all":
        app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_credentials=False,
            allow_methods=["*"],
            allow_headers=["*"],
        )
        return
    origins = [o.strip() for o in raw.split(",") if o.strip()]
    if not origins:
        origins = [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://127.0.0.1:3000",
        ]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


def _torch_device_label() -> str:
    if torch.cuda.is_available():
        return "cuda"
    if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
        return "mps"
    return "cpu"


app = FastAPI(title="Vocal Engine", version="0.3.0")

_install_cors(app)


class GenerateSingingBody(BaseModel):
    """JSON API for simple UIs (e.g. VocalBox): lyrics + UI language + RVC ``model_name``."""

    lyrics: str = Field(..., min_length=1, max_length=4000)
    language: str = Field(
        default="en",
        max_length=32,
        description="en | nl | af or English | Dutch | Afrikaans",
    )
    model_name: str | None = Field(
        default=None,
        max_length=120,
        description="RVC checkpoint basename (file in backend/models/rvc_voices/*.pth).",
    )
    async_mode: bool = Field(
        default=False,
        description="If true, returns job_id; poll GET /api/jobs/{id} for bark → rvc → polish stages.",
    )


class GenerateBody(BaseModel):
    lyrics: str = Field(min_length=1, max_length=4000)
    lang: str = Field(default="en", max_length=12, description="en | nl | af (Afrikaans uses Dutch voice preset).")
    voice_preset: str | None = Field(
        default=None,
        max_length=120,
        description="Bark preset; omit to use language default from /api/locales.",
    )
    rvc_model: str | None = Field(
        default=None,
        max_length=120,
        description="Basename of .pth in models/rvc_voices/; omit for Bark + studio polish only.",
    )
    f0_up_key: int = Field(default=0, ge=-12, le=12)
    use_music_notes: bool = True
    auto_lang_detect: bool = False


_SAFE_FINAL = re.compile(r"^(final|mix)_[0-9a-f]{32}\.wav$", re.IGNORECASE)


async def _save_upload_to_cache(upload: UploadFile, prefix: str) -> Path:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    safe_suffix = Path(upload.filename or "audio.wav").suffix.lower()
    if safe_suffix not in (".wav", ".wave"):
        raise HTTPException(status_code=400, detail="Upload a .wav file.")
    dest = CACHE_DIR / f"{prefix}_{Path(upload.filename).stem[:64]}_{uuid.uuid4().hex[:12]}{safe_suffix}"
    total = 0
    try:
        with dest.open("wb") as out:
            while True:
                chunk = await upload.read(1024 * 512)
                if not chunk:
                    break
                total += len(chunk)
                if total > MAX_UPLOAD_BYTES:
                    raise HTTPException(status_code=413, detail="File too large.")
                out.write(chunk)
    except HTTPException:
        try:
            dest.unlink(missing_ok=True)
        except OSError:
            pass
        raise
    if total == 0:
        try:
            dest.unlink(missing_ok=True)
        except OSError:
            pass
        raise HTTPException(status_code=400, detail="Empty file.")
    return dest


@app.get("/health")
@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/api/meta")
def api_meta():
    return {
        "version": "0.3.0",
        "torch_device": _torch_device_label(),
        "bark_device_preference": "darwin_mps_first"
        if __import__("platform").system() == "Darwin"
        else "cuda_mps_cpu",
        "bark": True,
        "rvc_installed": rvc_available(),
        "rvc_models_on_disk": list_rvc_model_names(),
        "max_upload_mb": MAX_UPLOAD_BYTES // (1024 * 1024),
        "default_voices_by_lang": DEFAULT_VOICE_BY_LANG,
        "media_mount": "/media",
        "generate_singing_paths": ["/api/generate-singing", "/generate-singing"],
    }


@app.get("/api/voices")
def api_voices():
    return {
        "bark_presets": BARK_VOICE_PRESETS,
        "rvc_models": [
            {"id": name, "label": f"{name} (.pth)"}
            for name in list_rvc_model_names()
        ],
        "rvc_available": rvc_available(),
    }


@app.get("/api/locales")
def api_locales():
    return {
        "languages": [
            {"code": "en", "label": "English", "default_voice": DEFAULT_VOICE_BY_LANG["en"]},
            {"code": "nl", "label": "Dutch (Nederlands)", "default_voice": DEFAULT_VOICE_BY_LANG["nl"]},
            {
                "code": "af",
                "label": "Afrikaans (Dutch phonetics)",
                "default_voice": DEFAULT_VOICE_BY_LANG["af"],
            },
        ]
    }


def _normalize_rvc_name(name: str | None) -> str | None:
    if not name:
        return None
    s = name.strip()
    return s or None


def _normalize_ui_language(language: str) -> str:
    if not language:
        return "en"
    k = language.strip().lower()
    lang_map = {
        "english": "en",
        "dutch": "nl",
        "nederlands": "nl",
        "afrikaans": "af",
        "en": "en",
        "nl": "nl",
        "af": "af",
    }
    return lang_map.get(k, normalize_lang(k))


ProgressCb = Callable[[str, float, str], None]


def _execute_vocal_generate(
    lyrics: str,
    *,
    lang: str,
    voice_preset: str | None,
    rvc_name: str | None,
    f0_up_key: int,
    use_music_notes: bool,
    auto_lang_detect: bool,
    progress: ProgressCb | None = None,
) -> tuple[Path, str, str, str]:
    """Bark → RVC (if model + installed) else Pedalboard. Optional progress for job / UI."""
    rvc_n = _normalize_rvc_name(rvc_name)
    use_rvc = bool(rvc_n)

    if use_rvc and not rvc_available():
        raise HTTPException(
            status_code=503,
            detail="RVC is not installed. Clear RVC model to use Bark + studio polish only, or install requirements-rvc.txt.",
        )

    lg = normalize_lang(lang)
    if auto_lang_detect:
        guess = optional_detect_language(lyrics)
        if guess:
            lg = guess
    vp = (voice_preset or "").strip() or default_voice_for_lang(lg)

    def p(stage: str, pct: float, msg: str) -> None:
        if progress:
            progress(stage, pct, msg)

    p("bark", 0.12, "Bark — singing melody (♪)…")
    raw = generate_bark_wav(lyrics, vp, use_music_notes=use_music_notes)
    try:
        if use_rvc:
            p("rvc", 0.55, "RVC — human voice swap…")
            final = transform_to_real_vocal(raw, rvc_n, f0_up_key=f0_up_key)
            pipe = "bark_rvc_polish"
        else:
            p("polish", 0.55, "Pedalboard — gate / compressor / reverb…")
            final = polish_only(raw)
            pipe = "bark_polish"
        p("finalize", 0.9, "Writing export…")
    finally:
        try:
            raw.unlink(missing_ok=True)
        except OSError:
            pass

    return final, lg, vp, pipe


@app.post("/generate")
@app.post("/api/generate")
def generate(body: GenerateBody):
    try:
        final, lang, vp, pipe = _execute_vocal_generate(
            body.lyrics,
            lang=body.lang,
            voice_preset=body.voice_preset,
            rvc_name=body.rvc_model,
            f0_up_key=body.f0_up_key,
            use_music_notes=body.use_music_notes,
            auto_lang_detect=body.auto_lang_detect,
            progress=None,
        )
    except HTTPException:
        raise
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except Exception as e:  # noqa: BLE001
        logger.exception("generate failed")
        raise HTTPException(status_code=500, detail=str(e)) from e

    return {
        "download_url": f"/download/{final.name}",
        "filename": final.name,
        "pipeline": pipe,
        "lang_resolved": lang,
        "voice_used": vp,
        "media_url": f"/media/{final.name}",
    }


@app.post("/generate-singing")
@app.post("/api/generate-singing")
def generate_singing(body: GenerateSingingBody):
    """
    Simple contract for React VocalBox: ``{ status, url }`` on success (sync), or ``{ job_id }`` (async).
    Audio is also served under ``/media/{filename}`` for ``<audio src>``.
    """
    lang = _normalize_ui_language(body.language)
    rvc = _normalize_rvc_name(body.model_name)

    if body.async_mode:
        jid = job_create()

        def worker() -> None:
            try:
                job_update(jid, stage="starting", progress=0.02, message="Starting pipeline…")

                def prog(st: str, p: float, msg: str) -> None:
                    job_update(jid, stage=st, progress=p, message=msg)

                final, lg, vp, pipe = _execute_vocal_generate(
                    body.lyrics,
                    lang=lang,
                    voice_preset=None,
                    rvc_name=rvc,
                    f0_up_key=0,
                    use_music_notes=True,
                    auto_lang_detect=False,
                    progress=prog,
                )
                job_update(
                    jid,
                    stage="done",
                    progress=1.0,
                    message="Success! Real singing layer ready.",
                    result={
                        "status": "success",
                        "url": f"/media/{final.name}",
                        "filename": final.name,
                        "pipeline": pipe,
                        "lang_resolved": lg,
                        "voice_used": vp,
                    },
                )
            except HTTPException as he:
                d = he.detail
                msg = d if isinstance(d, str) else str(d)
                job_update(jid, stage="error", error=msg, message=msg)
            except Exception as e:  # noqa: BLE001
                logger.exception("generate-singing job failed")
                job_update(jid, stage="error", error=str(e), message=str(e))

        threading.Thread(target=worker, daemon=True).start()
        return {"async": True, "job_id": jid}

    try:
        final, lg, vp, pipe = _execute_vocal_generate(
            body.lyrics,
            lang=lang,
            voice_preset=None,
            rvc_name=rvc,
            f0_up_key=0,
            use_music_notes=True,
            auto_lang_detect=False,
            progress=None,
        )
    except HTTPException:
        raise
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except Exception as e:  # noqa: BLE001
        logger.exception("generate-singing failed")
        raise HTTPException(status_code=500, detail=str(e)) from e

    media_url = f"/media/{final.name}"
    return {
        "status": "success",
        "url": media_url,
        "filename": final.name,
        "pipeline": pipe,
        "lang_resolved": lg,
        "voice_used": vp,
    }


@app.post("/api/convert")
async def api_convert(
    file: UploadFile = File(...),
    rvc_model: str = Form(...),
    f0_up_key: int = Form(0),
):
    if not rvc_available():
        raise HTTPException(status_code=503, detail="RVC is not installed.")
    path = await _save_upload_to_cache(file, "upload")
    name = _normalize_rvc_name(rvc_model)
    if not name:
        raise HTTPException(status_code=400, detail="rvc_model required.")
    try:
        final = transform_to_real_vocal(path, name, f0_up_key=max(-12, min(12, int(f0_up_key))))
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except Exception as e:  # noqa: BLE001
        logger.exception("convert failed")
        raise HTTPException(status_code=500, detail=str(e)) from e
    finally:
        try:
            path.unlink(missing_ok=True)
        except OSError:
            pass

    return {
        "download_url": f"/download/{final.name}",
        "filename": final.name,
        "pipeline": "upload_rvc_polish",
    }


@app.post("/api/polish")
async def api_polish(file: UploadFile = File(...)):
    path = await _save_upload_to_cache(file, "polish_in")
    try:
        final = polish_only(path)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except Exception as e:  # noqa: BLE001
        logger.exception("polish failed")
        raise HTTPException(status_code=500, detail=str(e)) from e
    finally:
        try:
            path.unlink(missing_ok=True)
        except OSError:
            pass

    return {
        "download_url": f"/download/{final.name}",
        "filename": final.name,
        "pipeline": "upload_polish",
    }


@app.post("/api/analyze-beat")
async def api_analyze_beat(file: UploadFile = File(...)):
    path = await _save_upload_to_cache(file, "analyze")
    try:
        return analyze_beat_track(path)
    finally:
        try:
            path.unlink(missing_ok=True)
        except OSError:
            pass


def _form_bool(v: str | bool) -> bool:
    if isinstance(v, bool):
        return v
    return str(v).strip().lower() in ("1", "true", "yes", "on")


@app.post("/api/pipeline/full")
async def api_pipeline_full(
    beat: UploadFile = File(...),
    lyrics: str = Form(...),
    lang: str = Form("en"),
    voice_preset: str = Form(""),
    rvc_model: str = Form(""),
    mix_with_backing: str = Form("true"),
    auto_lang_detect: str = Form("false"),
    f0_up_key: int = Form(0),
    sync: str = Form("false"),
):
    beat_path = await _save_upload_to_cache(beat, "beat_src")
    mix_b = _form_bool(mix_with_backing)
    sync_b = _form_bool(sync)
    auto_ld = _form_bool(auto_lang_detect)

    if sync_b:
        try:
            res = run_full_vocal_pipeline(
                lyrics,
                beat_path,
                lang=lang,
                voice_preset=voice_preset or None,
                rvc_model=rvc_model or None,
                mix_with_backing=mix_b,
                use_music_notes=True,
                f0_up_key=int(f0_up_key),
                auto_lang_detect=auto_ld,
            )
            return {"sync": True, **res}
        except FileNotFoundError as e:
            raise HTTPException(status_code=404, detail=str(e)) from e
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e
        except RuntimeError as e:
            raise HTTPException(status_code=503, detail=str(e)) from e
        except Exception as e:  # noqa: BLE001
            logger.exception("pipeline sync failed")
            raise HTTPException(status_code=500, detail=str(e)) from e
        finally:
            try:
                beat_path.unlink(missing_ok=True)
            except OSError:
                pass

    jid = job_create()
    kept = beat_path

    def worker() -> None:
        try:
            job_update(jid, stage="starting", progress=0.02, message="Starting…")

            def prog(st: str, p: float, msg: str) -> None:
                job_update(jid, stage=st, progress=p, message=msg)

            res = run_full_vocal_pipeline(
                lyrics,
                kept,
                lang=lang,
                voice_preset=voice_preset or None,
                rvc_model=rvc_model or None,
                mix_with_backing=mix_b,
                use_music_notes=True,
                f0_up_key=int(f0_up_key),
                auto_lang_detect=auto_ld,
                progress=prog,
            )
            job_update(jid, stage="done", progress=1.0, message="Complete.", result=res)
        except Exception as e:  # noqa: BLE001
            logger.exception("pipeline job failed")
            job_update(jid, stage="error", error=str(e), message=str(e))
        finally:
            try:
                kept.unlink(missing_ok=True)
            except OSError:
                pass

    threading.Thread(target=worker, daemon=True).start()
    return {"job_id": jid}


@app.get("/api/jobs/{job_id}")
def api_job(job_id: str):
    j = job_get(job_id)
    if not j:
        raise HTTPException(status_code=404, detail="Unknown job")
    return j


@app.get("/download/{filename}")
@app.get("/api/download/{filename}")
def download(filename: str):
    if not _SAFE_FINAL.match(filename or ""):
        raise HTTPException(status_code=400, detail="invalid filename")
    path = (EXPORTS_DIR / filename).resolve()
    if not str(path).startswith(str(EXPORTS_DIR.resolve())) or not path.is_file():
        raise HTTPException(status_code=404, detail="not found")
    return FileResponse(path, media_type="audio/wav", filename=filename)


# Static serving for <audio src=".../media/final_*.wav"> (same files as /download).
EXPORTS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/media", StaticFiles(directory=str(EXPORTS_DIR)), name="exported_wav")
