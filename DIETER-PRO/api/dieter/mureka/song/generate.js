import { dieterApiBaseUrl, dieterPublicOrigin, rewriteMurekaPayloadUrls } from '../../../../lib/dieterEnv.js';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const base = dieterApiBaseUrl();
  if (!base) {
    res.status(503).json({
      error:
        'Set DIETER_FASTAPI_URL to your Dieter API origin (with MUREKA_API_KEY on that server) for lyrics → full song.',
    });
    return;
  }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const r = await fetch(`${base}/mureka/song/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await r.text();
    let j = null;
    try {
      j = text ? JSON.parse(text) : null;
    } catch {
      /* passthrough */
    }
    const origin = dieterPublicOrigin();
    if (r.ok && j && typeof j === 'object' && origin) rewriteMurekaPayloadUrls(j, origin);
    if (j != null && (text.trim().startsWith('{') || text.trim().startsWith('['))) {
      res.status(r.status).json(j);
      return;
    }
    res.status(r.status).type('application/json').send(text);
  } catch (e) {
    console.error('[api/dieter/mureka/song/generate]', e);
    res.status(502).json({ error: String(e?.message || e) });
  }
}
