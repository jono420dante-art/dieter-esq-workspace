/**
 * Same-origin audio fetch for Web Audio decode (bypasses CDN CORS limits).
 */
import express from 'express';
import { isAudioProxyUrlAllowed } from '../../lib/audioProxyAllowlist.js';
import { applyAudioProxyCors } from '../../lib/audioProxyCors.js';

const router = express.Router();
const MAX_BYTES = 60 * 1024 * 1024;

router.options('/proxy', (_req, res) => {
  applyAudioProxyCors(res);
  res.setHeader('Access-Control-Max-Age', '86400');
  res.status(204).end();
});

router.get('/proxy', async (req, res) => {
  applyAudioProxyCors(res);

  const raw = req.query.url;
  if (!raw || typeof raw !== 'string') {
    res.status(400).json({ error: 'Missing url query parameter' });
    return;
  }
  let target;
  try {
    target = new URL(raw);
  } catch {
    res.status(400).json({ error: 'Invalid URL' });
    return;
  }
  if (!isAudioProxyUrlAllowed(raw)) {
    res.status(403).json({
      error:
        'Audio host not allowlisted. Set AUDIO_PROXY_ALLOW_HOSTS or use a Replicate / Mureka / Dieter audio URL.',
    });
    return;
  }
  try {
    const up = await fetch(target.toString(), {
      headers: { Accept: 'audio/*,*/*', 'User-Agent': 'DIETER-PRO-audio-proxy/1.0' },
      redirect: 'follow',
    });
    if (!up.ok) {
      res.status(502).json({ error: `Upstream HTTP ${up.status}` });
      return;
    }
    const len = up.headers.get('content-length');
    if (len && Number(len) > MAX_BYTES) {
      res.status(413).json({ error: 'Audio file too large' });
      return;
    }
    const buf = Buffer.from(await up.arrayBuffer());
    if (buf.length > MAX_BYTES) {
      res.status(413).json({ error: 'Audio file too large' });
      return;
    }
    const ct = up.headers.get('content-type') || 'application/octet-stream';
    res.setHeader('Content-Type', ct);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(buf);
  } catch (e) {
    console.error('[audio/proxy]', e);
    res.status(502).json({ error: e.message || 'Proxy fetch failed' });
  }
});

export default router;
