"""
Mureka.ai API client (server-side only — never expose keys in the browser).

Uses the same paths as the production proxy in ``app.main``:
  POST /v1/song/generate
  GET  /v1/song/query/{task_id}

Docs: https://platform.mureka.ai/docs/en/quickstart.html
"""

from __future__ import annotations

import asyncio
import json
import os
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

DEFAULT_BASE = os.environ.get("MUREKA_API_BASE", "https://api.mureka.ai").rstrip("/")

# Mureka may return different shapes by version — these cover common cases.
_DONE = frozenset({"completed", "success", "succeeded", "done", "finished"})
_FAILED = frozenset({"failed", "error", "cancelled", "canceled"})


class MurekaSyncError(RuntimeError):
    """Raised when Mureka returns an error or an unexpected payload."""


class MurekaSync:
    def __init__(self, api_key: str, base_url: str | None = None) -> None:
        self.api_key = api_key.strip()
        self.base_url = (base_url or DEFAULT_BASE).rstrip("/")
        if not self.api_key:
            raise MurekaSyncError("Empty Mureka API key")

    def _request(self, method: str, path: str, body: dict[str, Any] | None) -> dict[str, Any]:
        url = f"{self.base_url}{path}"
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Authorization": f"Bearer {self.api_key}",
        }
        data = json.dumps(body).encode("utf-8") if body is not None else None
        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                raw = resp.read().decode("utf-8")
                if not raw.strip():
                    return {}
                return json.loads(raw)
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="replace")
            try:
                detail: Any = json.loads(err_body) if err_body.strip() else {"status": e.code}
            except json.JSONDecodeError:
                detail = err_body or str(e.code)
            raise MurekaSyncError(f"Mureka HTTP {e.code}: {detail}") from e

    def start_generate(self, lyrics: str, prompt: str, model: str = "auto") -> str:
        payload = {"lyrics": lyrics, "model": model, "prompt": prompt}
        out = self._request("POST", "/v1/song/generate", payload)
        tid = out.get("id") or out.get("task_id") or out.get("taskId")
        if not tid:
            raise MurekaSyncError(f"No task id in generate response: {out}")
        return str(tid)

    def query_task(self, task_id: str) -> dict[str, Any]:
        return self._request("GET", f"/v1/song/query/{task_id}", None)

    async def wait_for_completion(
        self,
        task_id: str,
        *,
        interval_sec: float = 4.0,
        max_wait_sec: float = 900.0,
    ) -> dict[str, Any]:
        import time

        deadline = time.monotonic() + max_wait_sec
        while time.monotonic() < deadline:
            st = await asyncio.to_thread(self.query_task, task_id)
            status = str(st.get("status") or "").lower()
            if status in _DONE:
                return st
            if status in _FAILED:
                raise MurekaSyncError(f"Mureka task failed: {st}")
            # preparing, processing, running, queued, ...
            await asyncio.sleep(interval_sec)
        raise TimeoutError(f"Mureka task {task_id} timed out after {max_wait_sec}s")

    async def generate_track_url(
        self,
        lyrics: str,
        style: str = "pop",
        *,
        model: str = "auto",
    ) -> tuple[str, dict[str, Any]]:
        """
        Start ``/v1/song/generate``, poll until complete, return ``(audio_url, last_json)``.

        Note: Mureka returns a **full music** render, not an isolated vocal stem, unless
        their product/API exposes stems. Downstream mixing assumes a second stem (your beat).
        """
        prompt = style_to_prompt(style)
        task_id = self.start_generate(lyrics, prompt, model)
        final = await self.wait_for_completion(task_id)
        url = extract_audio_url(final)
        if not url:
            raise MurekaSyncError(f"No audio URL in completed task: {final}")
        return url, final


def style_to_prompt(style: str) -> str:
    s = (style or "pop").strip().lower()
    presets: dict[str, str] = {
        "rap": "hip hop, rap, rhythmic, punchy lead vocal, studio mix",
        "pop": "pop, catchy, polished production, clear lead vocal",
        "edm": "edm, electronic, festival energy, bright synths, vocal forward",
        "rnb": "r&b, smooth, emotional, male or female vocal, warm",
    }
    return presets.get(s, f"{s} style, professional vocals, clear diction, studio mix")


def extract_audio_url(d: dict[str, Any]) -> str | None:
    if not isinstance(d, dict):
        return None
    for key in ("audio_url", "mp3_url", "url", "download_url", "file_url"):
        v = d.get(key)
        if isinstance(v, str) and v.startswith("http"):
            return v
    nested = d.get("data")
    if isinstance(nested, dict):
        u = extract_audio_url(nested)
        if u:
            return u
    nested = d.get("result")
    if isinstance(nested, dict):
        u = extract_audio_url(nested)
        if u:
            return u
    choices = d.get("choices")
    if isinstance(choices, list) and choices:
        c0 = choices[0]
        if isinstance(c0, dict):
            return extract_audio_url(c0)
    return None


async def download_audio_url(url: str, dest: str, *, timeout_sec: int = 300) -> str:
    """Download bytes from ``url`` to ``dest`` (runs blocking I/O in a thread)."""
    dest_path = Path(dest)

    def _dl() -> None:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "DIETER-dieter-backend/1.0"},
            method="GET",
        )
        with urllib.request.urlopen(req, timeout=timeout_sec) as resp:
            dest_path.parent.mkdir(parents=True, exist_ok=True)
            dest_path.write_bytes(resp.read())

    await asyncio.to_thread(_dl)
    return str(dest_path.resolve())
