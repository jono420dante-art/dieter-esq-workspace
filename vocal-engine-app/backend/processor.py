"""
RVC voice conversion + Pedalboard polish. Consumes Bark output from ``cache/``, writes ``exports/final_*.wav``.
"""
from __future__ import annotations

import logging
import os
import uuid
from pathlib import Path

import numpy as np

logger = logging.getLogger(__name__)

BACKEND_ROOT = Path(__file__).resolve().parent
CACHE_DIR = BACKEND_ROOT / "cache"
EXPORTS_DIR = BACKEND_ROOT / "exports"
RVC_VOICES = BACKEND_ROOT / "models" / "rvc_voices"
HUBERT_DIR = BACKEND_ROOT / "models" / "hubert"

EXPORTS_DIR.mkdir(parents=True, exist_ok=True)
CACHE_DIR.mkdir(parents=True, exist_ok=True)
RVC_VOICES.mkdir(parents=True, exist_ok=True)
HUBERT_DIR.mkdir(parents=True, exist_ok=True)

_rvc_engine = None
_rvc_lock = None


def rvc_available() -> bool:
    try:
        import rvc_python.infer  # noqa: F401

        return True
    except ImportError:
        return False


def list_rvc_model_names() -> list[str]:
    return sorted({p.stem for p in RVC_VOICES.glob("*.pth") if p.is_file()})


def polish_only(raw_input_path: str | Path) -> Path:
    """
    Apply the studio Pedalboard chain only (no RVC). Use for Bark-only or uploaded dry stems.
    """
    raw_input_path = Path(raw_input_path).resolve()
    if not raw_input_path.is_file():
        raise FileNotFoundError(str(raw_input_path))
    final_out = EXPORTS_DIR / f"final_{uuid.uuid4().hex}.wav"
    _apply_studio_polish(raw_input_path, final_out)
    return final_out


def _device() -> str:
    d = (os.environ.get("RVC_DEVICE") or "").strip()
    if d:
        return d
    import platform

    try:
        import torch

        # Apple Silicon: prefer MPS for RVC inference (explicit vs Linux CUDA-first).
        if platform.system() == "Darwin":
            if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
                return "mps"
            return "cpu"
        if torch.cuda.is_available():
            return "cuda:0"
        if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
            return "mps"
    except Exception:  # noqa: BLE001
        pass
    return "cpu"


def _rvc_infer_file(rvc, src: str, dst: str, *, f0_up_key: int, index_path: str | None) -> None:
    """Call ``infer_file`` with the richest signature the installed rvc-python supports."""
    attempts: list[dict] = []
    if index_path:
        attempts.append({"f0_up_key": f0_up_key, "index_path": index_path})
    attempts.append({"f0_up_key": f0_up_key})
    attempts.append({})

    last_err: TypeError | None = None
    for kw in attempts:
        try:
            if kw:
                rvc.infer_file(src, dst, **kw)
            else:
                rvc.infer_file(src, dst)
            return
        except TypeError as e:
            last_err = e
    if last_err:
        raise last_err


def _get_rvc():
    global _rvc_engine, _rvc_lock
    import threading

    if _rvc_lock is None:
        _rvc_lock = threading.Lock()
    with _rvc_lock:
        if _rvc_engine is not None:
            return _rvc_engine
        try:
            from rvc_python.infer import RVCInference
        except ImportError as e:
            raise RuntimeError(
                "RVC is not installed. Use Bark + polish only, or install requirements-rvc.txt (Linux/py3.11)."
            ) from e

        dev = _device()
        logger.info("RVCInference(device=%s)", dev)
        _rvc_engine = RVCInference(device=dev)
        return _rvc_engine


def transform_to_real_vocal(
    raw_input_path: str | Path,
    model_name: str,
    *,
    f0_up_key: int = 0,
) -> Path:
    """
    RVC (``models/rvc_voices/{model_name}.pth``) then Pedalboard chain → ``exports/final_<uuid>.wav``.
    """
    raw_input_path = Path(raw_input_path).resolve()
    if not raw_input_path.is_file():
        raise FileNotFoundError(str(raw_input_path))

    base = model_name.strip()
    if "/" in base or "\\" in base or ".." in base:
        raise ValueError("model_name must be a basename without path segments")

    model_path = (RVC_VOICES / f"{base}.pth").resolve()
    if not str(model_path).startswith(str(RVC_VOICES.resolve())):
        raise ValueError("invalid model path")
    if not model_path.is_file():
        raise FileNotFoundError(f"RVC checkpoint missing: {model_path}")

    if not rvc_available():
        raise RuntimeError("RVC is not installed on this server.")

    index_path = (RVC_VOICES / f"{base}.index").resolve()
    has_index = index_path.is_file() and str(index_path).startswith(str(RVC_VOICES.resolve()))

    temp_human = CACHE_DIR / f"human_{uuid.uuid4().hex}.wav"
    final_out = EXPORTS_DIR / f"final_{uuid.uuid4().hex}.wav"

    rvc = _get_rvc()
    rvc.load_model(str(model_path))

    _rvc_infer_file(
        rvc,
        str(raw_input_path),
        str(temp_human),
        f0_up_key=f0_up_key,
        index_path=str(index_path) if has_index else None,
    )

    _apply_studio_polish(temp_human, final_out)
    try:
        temp_human.unlink(missing_ok=True)
    except OSError:
        pass
    return final_out


def _apply_studio_polish(input_wav: Path, output_wav: Path) -> None:
    from pedalboard import Compressor, HighpassFilter, Pedalboard, Reverb
    from pedalboard.io import AudioFile

    plugins = [
        HighpassFilter(cutoff_frequency_hz=100),
        Compressor(threshold_db=-20, ratio=4),
        Reverb(room_size=0.35, wet_level=0.2, dry_level=0.85),
    ]
    try:
        from pedalboard import NoiseGate

        plugins.insert(0, NoiseGate(threshold_db=-30))
    except ImportError:
        pass

    board = Pedalboard(plugins)

    with AudioFile(str(input_wav)) as f:
        audio = f.read(f.frames)
        samplerate = f.samplerate

    if audio.ndim == 1:
        audio = audio.reshape(1, -1)

    effected = board(audio, samplerate)
    if effected.ndim == 1:
        effected = effected.reshape(1, -1)
    nc = int(effected.shape[0])

    with AudioFile(str(output_wav), "w", samplerate=samplerate, num_channels=nc) as f:
        f.write(effected.astype(np.float32, copy=False))
