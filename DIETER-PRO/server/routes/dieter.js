/**
 * Proxy to ED-GEERDES / Dieter FastAPI (same routes as mureka-clone / dieter-backend).
 * Set DIETER_FASTAPI_URL to the API origin WITHOUT trailing slash, e.g.
 *   https://dieter-beat-lab.onrender.com
 * or http://127.0.0.1:8787
 * Paths are normalized to …/api/… on the upstream.
 */
import { Router } from 'express';
import multer from 'multer';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 130 * 1024 * 1024 },
});

export function fastApiBaseUrl() {
  const raw = (process.env.DIETER_FASTAPI_URL || '').trim().replace(/\/$/, '');
  if (!raw) return null;
  return raw.endsWith('/api') ? raw : `${raw}/api`;
}

/** Origin for rewriting relative playback paths from FastAPI (e.g. /api/storage/...). */
export function upstreamPublicOrigin() {
  const raw = (process.env.DIETER_FASTAPI_URL || '').trim().replace(/\/$/, '');
  if (!raw) return '';
  if (raw.endsWith('/api')) return raw.slice(0, -4).replace(/\/$/, '');
  return raw;
}

function requireUpstream(res) {
  const base = fastApiBaseUrl();
  if (!base) {
    res.status(503).json({
      error:
        'DIETER_FASTAPI_URL is not set. Point it at your Dieter FastAPI origin (e.g. https://your-service.onrender.com).',
    });
    return null;
  }
  return base;
}

router.get('/capabilities', async (_req, res) => {
  const base = requireUpstream(res);
  if (!base) return;
  try {
    const r = await fetch(`${base}/local/capabilities`, {
      headers: { Accept: 'application/json' },
    });
    const text = await r.text();
    res.status(r.status).type('application/json').send(text);
  } catch (e) {
    res.status(502).json({ error: String(e?.message || e) });
  }
});

/**
 * POST multipart: file (audio) + optional cover_image — forwards to FastAPI POST /api/local/music-video
 */
router.post(
  '/music-video',
  upload.fields([
    { name: 'file', maxCount: 1 },
    { name: 'cover_image', maxCount: 1 },
  ]),
  async (req, res) => {
    const base = requireUpstream(res);
    if (!base) return;

    const audio = req.files?.file?.[0];
    if (!audio) {
      res.status(400).json({ error: 'Missing multipart field "file" (audio)' });
      return;
    }

    const form = new FormData();
    form.append(
      'file',
      new Blob([audio.buffer], { type: audio.mimetype || 'application/octet-stream' }),
      audio.originalname || 'audio.mp3',
    );
    const cover = req.files?.cover_image?.[0];
    if (cover) {
      form.append(
        'cover_image',
        new Blob([cover.buffer], { type: cover.mimetype || 'application/octet-stream' }),
        cover.originalname || 'cover.jpg',
      );
    }
    const beats = req.body?.beat_times_json ?? '[]';
    const detect = req.body?.detect_beats ?? 'true';
    form.append('beat_times_json', typeof beats === 'string' ? beats : '[]');
    form.append('detect_beats', typeof detect === 'string' ? detect : 'true');

    try {
      const r = await fetch(`${base}/local/music-video`, {
        method: 'POST',
        body: form,
      });
      const text = await r.text();
      let j = null;
      try {
        j = text ? JSON.parse(text) : null;
      } catch {
        /* passthrough below */
      }
      const origin = upstreamPublicOrigin();
      if (r.ok && j && typeof j === 'object' && typeof j.url === 'string' && j.url.startsWith('/') && origin) {
        j.url = `${origin}${j.url}`;
      }
      if (j != null && (text.trim().startsWith('{') || text.trim().startsWith('['))) {
        res.status(r.status).json(j);
        return;
      }
      res.status(r.status).type('application/json').send(text);
    } catch (e) {
      res.status(502).json({ error: String(e?.message || e) });
    }
  },
);

export default router;
