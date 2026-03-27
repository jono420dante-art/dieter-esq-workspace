"""In-memory job status for long-running pipeline (beat + Bark + RVC + mix)."""
from __future__ import annotations

import threading
import uuid
from typing import Any

_lock = threading.Lock()
JOBS: dict[str, dict[str, Any]] = {}


def job_create() -> str:
    jid = str(uuid.uuid4())
    with _lock:
        JOBS[jid] = {
            "id": jid,
            "stage": "queued",
            "progress": 0.0,
            "message": "",
            "error": None,
            "result": None,
        }
    return jid


def job_update(jid: str, **kwargs: Any) -> None:
    with _lock:
        if jid in JOBS:
            JOBS[jid].update(kwargs)


def job_get(jid: str) -> dict[str, Any] | None:
    with _lock:
        j = JOBS.get(jid)
        return dict(j) if j else None
