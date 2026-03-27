import { dieterApiBaseUrl, dieterPublicOrigin, rewriteMurekaPayloadUrls } from '../../../../../lib/dieterEnv.js';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const base = dieterApiBaseUrl();
  if (!base) {
    res.status(503).json({ error: 'DIETER_FASTAPI_URL not configured' });
    return;
  }
  const taskId = req.query?.taskId;
  if (!taskId || typeof taskId !== 'string') {
    res.status(400).json({ error: 'Missing task id' });
    return;
  }
  try {
    const r = await fetch(`${base}/mureka/song/query/${encodeURIComponent(taskId)}`, {
      headers: { Accept: 'application/json' },
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
    console.error('[api/dieter/mureka/song/query]', e);
    res.status(502).json({ error: String(e?.message || e) });
  }
}
