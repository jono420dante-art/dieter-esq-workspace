/** Shared Dieter FastAPI URL helpers (Express + Vercel). */

export function dieterApiBaseUrl() {
  const raw = (process.env.DIETER_FASTAPI_URL || '').trim().replace(/\/$/, '');
  if (!raw) return null;
  return raw.endsWith('/api') ? raw : `${raw}/api`;
}

export function dieterPublicOrigin() {
  const raw = (process.env.DIETER_FASTAPI_URL || '').trim().replace(/\/$/, '');
  if (!raw) return '';
  if (raw.endsWith('/api')) return raw.slice(0, -4).replace(/\/$/, '');
  return raw;
}

/** Turn relative `/static/...` audio links into absolute URLs for the browser. */
export function rewriteMurekaPayloadUrls(obj, origin, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 8) return;
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (typeof val === 'string' && val.startsWith('/') && /url|href|uri|path|src|file|mp3|audio/i.test(key)) {
      obj[key] = `${origin}${val}`;
    } else if (val && typeof val === 'object' && !Array.isArray(val)) {
      rewriteMurekaPayloadUrls(val, origin, depth + 1);
    } else if (Array.isArray(val)) {
      val.forEach((item) => rewriteMurekaPayloadUrls(item, origin, depth + 1));
    }
  }
}
