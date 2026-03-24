# Beat API (FastAPI)

## Easiest start (Windows)

From the repo folder that contains `backend/` and `local-audio/`:

- **Double-click** `OPEN-BEAT-API.bat`, or  
- In PowerShell: `.\START-BEAT-API.ps1`

Then open **http://localhost:8000/docs** to try **POST /detect-beats**.

## Setup (manual)

```bash
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
pip install -r requirements.txt
```

Ensure **`local-audio/beat_detect.py`** exists next to this folder (repo root: `../local-audio`).

## Run (http://localhost:8000)

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Or:

```bash
python main.py
```

## Endpoints

- `GET /health` — liveness
- `POST /detect-beats` — form field `file` (multipart audio)

Success JSON:

```json
{ "bpm": 120.5, "beats": [0.0, 0.5, ...], "status": "success" }
```

## React (Vite)

```env
VITE_API_BASE=http://localhost:8000
```

CORS allows any `http://localhost:*` and `http://127.0.0.1:*` origin.
