# voice-clone-stack

Minimal local stack for voice registration + lyric/text synthesis.

## Structure

```text
voice-clone-stack/
├── backend/
│   ├── app.py
│   ├── requirements.txt
│   ├── models/
│   └── voices/
├── frontend/
│   ├── src/
│   └── package.json
├── docker-compose.yml
└── README.md
```

## Backend (FastAPI)

```bash
cd backend
python -m venv .venv
. .venv/bin/activate   # Windows PowerShell: .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app:app --reload --port 8001
```

### Endpoints

- `GET /health`
- `POST /api/voices/register` (multipart: `voice_name`, `reference_audio`)
- `GET /api/voices`
- `POST /api/synthesize` (multipart: `voice_id`, `text`, optional `language`)
- `GET /api/audio/{filename}`

If Coqui XTTS is installed and loadable, synth uses XTTS voice cloning.
If not, it falls back to a simple tone generator so routes still function.

## Frontend (optional Vite React UI)

```bash
cd frontend
npm install
npm run dev
```

Default UI expects backend at `http://127.0.0.1:8001`.
Override with `VITE_API_BASE`.

## Docker Compose (optional)

```bash
docker compose up --build
```

- Backend: `http://localhost:8001`
- Frontend: `http://localhost:5174`
