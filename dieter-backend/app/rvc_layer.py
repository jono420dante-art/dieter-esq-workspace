"""
Optional **RVC** voice conversion after Bark (package: ``rvc-python`` on PyPI).

Install: ``pip install rvc-python`` (may need a matching ``torch`` build). On Apple Silicon,
set ``DIETER_RVC_DEVICE=mps`` or leave unset to auto-pick MPS when available.

Place ``*.pth`` (and any required ``.index`` next to it per model docs) under ``dieter-backend/models/``.
"""
from __future__ import annotations

import logging
import os
import threading
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

_engine: Any = None
_lock = threading.Lock()
_last_model: str | None = None


def rvc_package_available() -> bool:
    try:
        from rvc_python.infer import RVCInference  # noqa: F401
        return True
    except ImportError:
        return False


def _pick_device() -> str:
    explicit = os.environ.get("DIETER_RVC_DEVICE", "").strip()
    if explicit:
        return explicit
    try:
        import torch

        if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
            return "mps"
        if torch.cuda.is_available():
            return "cuda:0"
    except Exception:  # noqa: BLE001
        pass
    return "cpu"


def _get_engine() -> Any:
    global _engine
    with _lock:
        if _engine is not None:
            return _engine
        from rvc_python.infer import RVCInference

        dev = _pick_device()
        logger.info("RVCInference(device=%s)", dev)
        _engine = RVCInference(device=dev)
        return _engine


def apply_rvc_file(
    input_wav: str,
    model_path: str,
    output_wav: str,
    *,
    f0_up_key: int = 0,
) -> str:
    """
    Run voice conversion: ``input_wav`` + RVC ``.pth`` → ``output_wav``.
    """
    if not rvc_package_available():
        raise RuntimeError("rvc-python is not installed (pip install rvc-python)")

    eng = _get_engine()
    mp = str(Path(model_path).resolve())

    with _lock:
        global _last_model
        if _last_model != mp:
            eng.load_model(mp)
            _last_model = mp
        try:
            eng.infer_file(input_wav, output_wav, f0_up_key=f0_up_key)
        except TypeError:
            eng.infer_file(input_wav, output_wav)

    return output_wav
