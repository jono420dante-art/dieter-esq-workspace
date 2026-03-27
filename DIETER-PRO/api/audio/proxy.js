import { isAudioProxyUrlAllowed } from '../../lib/audioProxyAllowlist.js';
import { applyAudioProxyCors } from '../../lib/audioProxyCors.js';

const MAX_BYTES = 60 * 1024 * 1024;

export default async function handler(req, res) {
  applyAudioProxyCors(res);

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Max-Age', '86400');
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const raw = req.query?.url;
  if (!raw || typeof raw !== 'string') {
    res.status(400).json({ error: 'Missing url' });
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
    res.status(403).json({ error: 'Audio host not allowlisted' });
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
      res.status(413).json({ error: 'Too large' });
      return;
    }
    const buf = Buffer.from(await up.arrayBuffer());
    if (buf.length > MAX_BYTES) {
      res.status(413).json({ error: 'Too large' });
      return;
    }
    res.setHeader('Content-Type', up.headers.get('content-type') || 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.status(200).send(buf);
  } catch (e) {
    console.error('[api/audio/proxy]', e);
    res.status(502).json({ error: e.message || 'Proxy failed' });
  }
}
