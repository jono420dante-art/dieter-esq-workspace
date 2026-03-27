/**
 * Host allowlist for GET /api/audio/proxy (server-side only).
 * Extend with AUDIO_PROXY_ALLOW_HOSTS=cdn.example.com,other.host
 */

export function isAudioProxyHostAllowed(hostname, env = process.env) {
  const h = String(hostname || '').toLowerCase();
  if (!h) return false;
  if (h === 'replicate.delivery' || h.endsWith('.replicate.delivery')) return true;
  if (h === 'replicate.com' || h.endsWith('.replicate.com')) return true;
  if (h === 'mureka.ai' || h.endsWith('.mureka.ai')) return true;
  if (h === 'blob.vercel-storage.com' || h.endsWith('.blob.vercel-storage.com')) return true;
  const raw = env.AUDIO_PROXY_ALLOW_HOSTS || '';
  const extra = raw.split(/[,;\s]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
  for (const e of extra) {
    if (h === e || (e.startsWith('.') && h.endsWith(e)) || h.endsWith(`.${e}`)) return true;
  }
  const du = (env.DIETER_FASTAPI_URL || '').trim();
  if (du) {
    try {
      const d = new URL(du.includes('://') ? du : `https://${du}`);
      if (h === d.hostname.toLowerCase()) return true;
    } catch {
      /* ignore */
    }
  }
  return false;
}

export function isAudioProxyUrlAllowed(urlStr, env = process.env) {
  try {
    const u = new URL(urlStr);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    return isAudioProxyHostAllowed(u.hostname, env);
  } catch {
    return false;
  }
}
