import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import Database from "better-sqlite3";
import { v4 as uuidv4 } from "uuid";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || "3001", 10);
const JWT_SECRET = process.env.JWT_SECRET || "dieter-studio-secret-key-change-in-prod";
const PYTHON_ENGINE_URL = process.env.PYTHON_ENGINE_URL || "http://127.0.0.1:8787";

const db = new Database(path.join(__dirname, "..", "dieter-studio.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    plan TEXT NOT NULL DEFAULT 'unlimited',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    prompt TEXT,
    bpm INTEGER DEFAULT 120,
    key TEXT DEFAULT 'C',
    duration INTEGER DEFAULT 180,
    structure TEXT DEFAULT 'verse-chorus-verse',
    genre TEXT,
    mood TEXT,
    voice TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS tracks (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    filename TEXT,
    url TEXT,
    stems_json TEXT,
    duration REAL,
    waveform_json TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS voices (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    lang TEXT NOT NULL,
    style TEXT NOT NULL,
    gender TEXT NOT NULL,
    preview_url TEXT
  );
`);

const voiceCount = (db.prepare("SELECT COUNT(*) as cnt FROM voices").get() as any).cnt;
if (voiceCount === 0) {
  const insertVoice = db.prepare(
    "INSERT INTO voices (id, name, lang, style, gender, preview_url) VALUES (?, ?, ?, ?, ?, ?)"
  );
  const seedVoices = db.transaction(() => {
    insertVoice.run(uuidv4(), "Nova", "en", "warm", "female", "/voices/nova-preview.mp3");
    insertVoice.run(uuidv4(), "Kira", "en", "bright", "female", "/voices/kira-preview.mp3");
    insertVoice.run(uuidv4(), "Aris", "en", "deep", "male", "/voices/aris-preview.mp3");
    insertVoice.run(uuidv4(), "Juno", "en", "ethereal", "non-binary", "/voices/juno-preview.mp3");
    insertVoice.run(uuidv4(), "Zephyr", "en", "smooth", "male", "/voices/zephyr-preview.mp3");
    insertVoice.run(uuidv4(), "Blaze", "en", "powerful", "male", "/voices/blaze-preview.mp3");
  });
  seedVoices();
}

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function generateToken(userId: string): string {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: "7d" });
}

function generateWaveform(): number[] {
  return Array.from({ length: 200 }, () => parseFloat(Math.random().toFixed(4)));
}

const STEM_NAMES = ["drums", "bass", "music", "vocal", "fx"];

interface AuthRequest extends Request {
  user?: { id: string; email: string; name: string; plan: string };
}

function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid authorization header" });
    return;
  }
  const token = header.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { sub: string };
    const user = db.prepare(
      "SELECT id, email, name, plan FROM users WHERE id = ?"
    ).get(decoded.sub) as any;
    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

const app = express();
app.use(cors());
app.use(express.json());

// ── Health ──────────────────────────────────────────────

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", version: "1.0.0", engine: "dieter-studio" });
});

// ── Auth ────────────────────────────────────────────────

app.post("/api/auth/register", (req: Request, res: Response) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) {
    res.status(400).json({ error: "email, password, and name are required" });
    return;
  }
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }
  const id = uuidv4();
  const password_hash = hashPassword(password);
  db.prepare(
    "INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)"
  ).run(id, email, password_hash, name);

  const user = db.prepare(
    "SELECT id, email, name, plan, created_at FROM users WHERE id = ?"
  ).get(id) as any;
  const token = generateToken(id);
  res.status(201).json({ token, user });
});

app.post("/api/auth/login", (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: "email and password are required" });
    return;
  }
  const user = db.prepare(
    "SELECT id, email, password_hash, name, plan, created_at FROM users WHERE email = ?"
  ).get(email) as any;
  if (!user || user.password_hash !== hashPassword(password)) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }
  const token = generateToken(user.id);
  const { password_hash: _, ...safeUser } = user;
  res.json({ token, user: safeUser });
});

app.get("/api/auth/me", authMiddleware as any, (req: AuthRequest, res: Response) => {
  res.json({ user: req.user });
});

// ── Projects ────────────────────────────────────────────

app.get("/api/projects", authMiddleware as any, (req: AuthRequest, res: Response) => {
  const projects = db.prepare(
    "SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC"
  ).all(req.user!.id);
  res.json({ projects });
});

app.post("/api/projects", authMiddleware as any, (req: AuthRequest, res: Response) => {
  const { name, prompt, bpm, key, duration, structure, genre, mood, voice } = req.body;
  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  const id = uuidv4();
  db.prepare(`
    INSERT INTO projects (id, user_id, name, prompt, bpm, key, duration, structure, genre, mood, voice)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.user!.id, name, prompt ?? null, bpm ?? 120, key ?? "C", duration ?? 180, structure ?? "verse-chorus-verse", genre ?? null, mood ?? null, voice ?? null);

  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(id);
  res.status(201).json({ project });
});

app.get("/api/projects/:id", authMiddleware as any, (req: AuthRequest, res: Response) => {
  const project = db.prepare(
    "SELECT * FROM projects WHERE id = ? AND user_id = ?"
  ).get(req.params.id, req.user!.id) as any;
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const tracks = db.prepare(
    "SELECT * FROM tracks WHERE project_id = ? ORDER BY created_at DESC"
  ).all(project.id);
  res.json({ project, tracks });
});

app.put("/api/projects/:id", authMiddleware as any, (req: AuthRequest, res: Response) => {
  const project = db.prepare(
    "SELECT * FROM projects WHERE id = ? AND user_id = ?"
  ).get(req.params.id, req.user!.id);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const { name, prompt, bpm, key, duration, structure, genre, mood, voice, status } = req.body;
  db.prepare(`
    UPDATE projects SET
      name = COALESCE(?, name),
      prompt = COALESCE(?, prompt),
      bpm = COALESCE(?, bpm),
      key = COALESCE(?, key),
      duration = COALESCE(?, duration),
      structure = COALESCE(?, structure),
      genre = COALESCE(?, genre),
      mood = COALESCE(?, mood),
      voice = COALESCE(?, voice),
      status = COALESCE(?, status),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    name ?? null, prompt ?? null, bpm ?? null, key ?? null,
    duration ?? null, structure ?? null, genre ?? null,
    mood ?? null, voice ?? null, status ?? null,
    req.params.id
  );
  const updated = db.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id);
  res.json({ project: updated });
});

app.delete("/api/projects/:id", authMiddleware as any, (req: AuthRequest, res: Response) => {
  const project = db.prepare(
    "SELECT * FROM projects WHERE id = ? AND user_id = ?"
  ).get(req.params.id, req.user!.id);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  db.prepare("DELETE FROM projects WHERE id = ?").run(req.params.id);
  res.json({ deleted: true });
});

// ── Generate ────────────────────────────────────────────

app.post("/api/generate/track", authMiddleware as any, (req: AuthRequest, res: Response) => {
  const { project_id, prompt, bpm, key, duration, genre, mood, voice_id } = req.body;
  if (!project_id) {
    res.status(400).json({ error: "project_id is required" });
    return;
  }
  const project = db.prepare(
    "SELECT * FROM projects WHERE id = ? AND user_id = ?"
  ).get(project_id, req.user!.id);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const trackId = uuidv4();
  const filename = `track-${trackId.slice(0, 8)}.wav`;
  db.prepare(`
    INSERT INTO tracks (id, project_id, filename, url, stems_json, duration, waveform_json, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    trackId, project_id, filename, `/tracks/${filename}`,
    JSON.stringify(STEM_NAMES), duration ?? 180, JSON.stringify([]), "generating"
  );

  db.prepare("UPDATE projects SET status = 'generating', updated_at = datetime('now') WHERE id = ?")
    .run(project_id);

  setTimeout(() => {
    const waveform = generateWaveform();
    db.prepare(`
      UPDATE tracks SET status = 'complete', waveform_json = ? WHERE id = ?
    `).run(JSON.stringify(waveform), trackId);
    db.prepare("UPDATE projects SET status = 'complete', updated_at = datetime('now') WHERE id = ?")
      .run(project_id);
  }, 2000);

  const track = db.prepare("SELECT * FROM tracks WHERE id = ?").get(trackId);
  res.status(201).json({ track });
});

app.post("/api/generate/mutate", authMiddleware as any, (req: AuthRequest, res: Response) => {
  const { track_id } = req.body;
  if (!track_id) {
    res.status(400).json({ error: "track_id is required" });
    return;
  }
  const original = db.prepare("SELECT * FROM tracks WHERE id = ?").get(track_id) as any;
  if (!original) {
    res.status(404).json({ error: "Track not found" });
    return;
  }

  const project = db.prepare(
    "SELECT * FROM projects WHERE id = ? AND user_id = ?"
  ).get(original.project_id, req.user!.id);
  if (!project) {
    res.status(403).json({ error: "Not authorized" });
    return;
  }

  const newTrackId = uuidv4();
  const filename = `track-${newTrackId.slice(0, 8)}-mutated.wav`;
  db.prepare(`
    INSERT INTO tracks (id, project_id, filename, url, stems_json, duration, waveform_json, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    newTrackId, original.project_id, filename, `/tracks/${filename}`,
    JSON.stringify(STEM_NAMES), original.duration, JSON.stringify([]), "generating"
  );

  setTimeout(() => {
    const waveform = generateWaveform();
    db.prepare(`
      UPDATE tracks SET status = 'complete', waveform_json = ? WHERE id = ?
    `).run(JSON.stringify(waveform), newTrackId);
  }, 2000);

  const track = db.prepare("SELECT * FROM tracks WHERE id = ?").get(newTrackId);
  res.status(201).json({ track });
});

app.get("/api/generate/status/:trackId", authMiddleware as any, (req: AuthRequest, res: Response) => {
  const track = db.prepare("SELECT * FROM tracks WHERE id = ?").get(req.params.trackId) as any;
  if (!track) {
    res.status(404).json({ error: "Track not found" });
    return;
  }
  res.json({
    track_id: track.id,
    status: track.status,
    waveform_json: track.waveform_json ? JSON.parse(track.waveform_json) : [],
    stems_json: track.stems_json ? JSON.parse(track.stems_json) : [],
  });
});

// ── Voices ──────────────────────────────────────────────

app.get("/api/voices", (_req: Request, res: Response) => {
  const voices = db.prepare("SELECT * FROM voices").all();
  res.json({ voices });
});

// ── Mixer ───────────────────────────────────────────────

app.post("/api/mixer/export", authMiddleware as any, (req: AuthRequest, res: Response) => {
  const { project_id, format, channels_json } = req.body;
  if (!project_id) {
    res.status(400).json({ error: "project_id is required" });
    return;
  }
  const project = db.prepare(
    "SELECT * FROM projects WHERE id = ? AND user_id = ?"
  ).get(project_id, req.user!.id);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const exportId = uuidv4();
  res.json({
    export_id: exportId,
    project_id,
    format: format || "wav",
    channels: channels_json || STEM_NAMES,
    download_url: `/exports/${exportId}.${format || "wav"}`,
    status: "ready",
  });
});

// ── AI Director ─────────────────────────────────────────

app.post("/api/director/suggest", authMiddleware as any, (req: AuthRequest, res: Response) => {
  const { project_id, prompt, genre, mood } = req.body;
  const suggestions = [
    {
      id: uuidv4(),
      type: "hook_placement",
      title: "Drop the hook at bar 9",
      description: `For ${genre || "pop"} tracks with a ${mood || "energetic"} mood, introducing your main hook at bar 9 creates maximum impact. The 8-bar intro builds anticipation perfectly.`,
      confidence: 0.92,
    },
    {
      id: uuidv4(),
      type: "energy_curve",
      title: "Use a tension-release energy curve",
      description: "Build energy gradually through the verse, peak at the pre-chorus, then drop to 60% at the chorus start before ramping to full. This contrast makes the chorus hit harder.",
      confidence: 0.87,
    },
    {
      id: uuidv4(),
      type: "trending_sound",
      title: "Add filtered vocal chops in the bridge",
      description: "Pitched-down vocal chops with a low-pass sweep are trending across streaming platforms right now. Layer them in the bridge for a modern texture.",
      confidence: 0.84,
    },
    {
      id: uuidv4(),
      type: "arrangement",
      title: "Try a double chorus with variation",
      description: "Repeat the chorus with added harmonies and a key change up a half step on the second pass. This technique increases listener retention by 23% in A/B tests.",
      confidence: 0.79,
    },
  ];
  res.json({ project_id, prompt, suggestions });
});

// ── 404 & Error Handling ────────────────────────────────

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error", message: err.message });
});

app.listen(PORT, () => {
  console.log(`\n  DIETER PRO Studio API`);
  console.log(`  ─────────────────────────`);
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  Engine:  ${PYTHON_ENGINE_URL}`);
  console.log(`  DB:      SQLite (WAL mode)`);
  console.log(`  Status:  Ready\n`);
});

export default app;
