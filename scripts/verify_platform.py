"""
Connectivity checks for Dieter backend + optional lyrics-engine.
Run from repo root:  python scripts/verify_platform.py

Real Mureka / cloud singing: set MUREKA_API_KEY; without it, Mureka routes return 401/503.
Local singing (procedural timbre): POST /api/tealvoices/sing still returns a playable WAV.
"""
from __future__ import annotations

import os
import sys


def main() -> int:
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    backend = os.path.join(root, "dieter-backend")
    if backend not in sys.path:
        sys.path.insert(0, backend)

    errors: list[str] = []

    print("=== Dieter FastAPI (dieter-backend) ===")
    try:
        from fastapi.testclient import TestClient
        from app.main import app

        c = TestClient(app)
        h = c.get("/api/health")
        print(f"  GET /api/health -> {h.status_code}")
        if h.status_code != 200:
            errors.append("health")
        else:
            print(f"       {h.json()}")

        ts = c.get("/api/tealvoices/status")
        print(f"  GET /api/tealvoices/status -> {ts.status_code} {ts.json()}")

        lyrics = "Line one for the test.\nLine two for singing check."
        sing = c.post(
            "/api/tealvoices/sing",
            json={"lyrics": lyrics, "voiceId": None, "pitchSemitones": 0},
        )
        print(f"  POST /api/tealvoices/sing -> {sing.status_code}")
        if sing.status_code != 200:
            errors.append("tealvoices_sing")
            print(f"       {sing.text[:500]}")
        else:
            body = sing.json()
            print(f"       mode={body.get('tealvoicesMode')} engine={body.get('engine')}")
            url = body.get("url")
            if url:
                wav = c.get(url)
                print(f"  GET {url} -> {wav.status_code} bytes={len(wav.content)}")
                if wav.status_code != 200 or len(wav.content) < 1000:
                    errors.append("vocal_wav")

        vl = c.get("/api/voices/list")
        print(f"  GET /api/voices/list -> {vl.status_code} man={len(vl.json().get('man', []))} woman={len(vl.json().get('woman', []))}")

        seo = c.post(
            "/api/seo/suggest",
            json={"title": "Verify Platform Release", "genre": "pop", "lyrics": lyrics[:120]},
        )
        print(f"  POST /api/seo/suggest -> {seo.status_code}")
        if seo.status_code != 200:
            errors.append("seo_suggest")
            print(f"       {seo.text[:400]}")
        else:
            sj = seo.json()
            print(f"       packSource={sj.get('packSource')} hashtags={len(sj.get('hashtags') or [])}")

        has_mureka = bool(os.environ.get("MUREKA_API_KEY", "").strip())
        print(f"  MUREKA_API_KEY in env: {has_mureka}")
        if has_mureka:
            mg = c.post(
                "/api/mureka/song/generate",
                json={"lyrics": lyrics[:200], "model": "auto", "prompt": "pop vocal test"},
            )
            print(f"  POST /api/mureka/song/generate -> {mg.status_code}")
            if not mg.is_success:
                print(f"       {mg.text[:300]}")
        else:
            mg = c.post(
                "/api/mureka/song/generate",
                json={"lyrics": "test", "model": "auto", "prompt": "pop"},
            )
            print(f"  POST /api/mureka/song/generate (expect 401) -> {mg.status_code}")

    except Exception as e:  # noqa: BLE001
        errors.append(f"backend_exception:{e}")
        print(f"  ERROR: {e}")

    print("\n=== Lyrics engine (engine/) ===")
    eng_root = os.path.join(root, "engine")
    if os.path.isdir(eng_root):
        if eng_root not in sys.path:
            sys.path.insert(0, eng_root)
        try:
            import engine as lyrics_engine  # noqa: PLC0415

            lc = TestClient(lyrics_engine.app)
            lh = lc.get("/health")
            print(f"  GET /health -> {lh.status_code} {lh.json()}")
            if lh.status_code != 200:
                errors.append("lyrics_health")
            lg = lc.post(
                "/generate",
                json={
                    "lyrics": "Test lyrics for engine generate endpoint.",
                    "style": "pop",
                },
            )
            exp = 503 if not os.environ.get("MUREKA_API_KEY") else "200+"
            print(f"  POST /generate -> {lg.status_code} (expected {exp} without cloud key)")
        except Exception as e:  # noqa: BLE001
            errors.append(f"lyrics_engine:{e}")
            print(f"  ERROR: {e}")
    else:
        print("  (engine/ not found, skip)")

    print("\n=== Summary ===")
    if errors:
        print("  FAILED:", "; ".join(errors))
        return 1
    print("  Core checks passed. For real Mureka singing, set MUREKA_API_KEY and re-run.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
