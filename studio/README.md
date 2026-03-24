# DIETER PRO — AI Music Studio

Full-stack music production studio with Mureka-style UI, real Web Audio engine, and REST API.

## Architecture

```
studio/
├── api/          Express + TypeScript + SQLite backend
│   └── src/server.ts
├── ui/           React 19 + Vite + TypeScript frontend
│   └── src/App.tsx
└── start.ps1     One-command launcher
```

## Quick Start

```powershell
cd studio
powershell -ExecutionPolicy Bypass -File start.ps1
```

Then open **http://localhost:5173**

## Run Individually

```powershell
# API only (port 3001)
cd studio/api
npm run dev

# UI only (port 5173, proxies /api to :3001)
cd studio/ui
npm run dev
```

## API Endpoints

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/health` | No | Health check |
| POST | `/api/auth/register` | No | Register (email, password, name) |
| POST | `/api/auth/login` | No | Login → JWT token |
| GET | `/api/auth/me` | Yes | Current user |
| GET | `/api/projects` | Yes | List projects |
| POST | `/api/projects` | Yes | Create project |
| GET | `/api/projects/:id` | Yes | Get project + tracks |
| PUT | `/api/projects/:id` | Yes | Update project |
| DELETE | `/api/projects/:id` | Yes | Delete project |
| POST | `/api/generate/track` | Yes | Generate track |
| POST | `/api/generate/mutate` | Yes | Create variation |
| GET | `/api/generate/status/:id` | Yes | Poll generation status |
| GET | `/api/voices` | No | List voice presets |
| POST | `/api/mixer/export` | Yes | Export mix |
| POST | `/api/director/suggest` | Yes | AI suggestions |

## Deploy

**API → Render.com:**
```powershell
cd studio/api
# Push to GitHub, connect repo in Render dashboard
# render.yaml is pre-configured
```

**UI → Vercel:**
```powershell
cd studio/ui
npx vercel --prod
# vercel.json is pre-configured with API rewrite
```

## Tech Stack

- **Backend**: Express 5, TypeScript, SQLite (better-sqlite3), JWT auth
- **Frontend**: React 19, Vite 6, TypeScript, Web Audio API
- **Audio**: 5-channel oscillator engine, AnalyserNode visualizer, BiquadFilter chain, DynamicsCompressor, MediaRecorder export
