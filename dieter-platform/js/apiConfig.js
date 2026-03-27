// Central config for calling the DIETER backend from the browser.
// - If `dp-backend-base` is empty, we call relative URLs (same origin).
// - Otherwise we call absolute URLs (Render / different domain).

export function getBackendBase() {
  try {
    const v = localStorage.getItem('dp-backend-base');
    if (v && v.trim()) return v.trim().replace(/\/+$/, '');
  } catch { /* ignore */ }
  return '';
}

export function setBackendBase(value) {
  const v = (value ?? '').toString().trim();
  try {
    localStorage.setItem('dp-backend-base', v);
  } catch { /* ignore */ }
}

/** Bookmarked deployed app URL (Vercel / Netlify) — for display & QR copy. */
export function getDeployFrontendUrl() {
  try {
    const v = localStorage.getItem('dp-deploy-frontend');
    if (v && v.trim()) return v.trim().replace(/\/+$/, '');
  } catch { /* ignore */ }
  return '';
}

export function setDeployFrontendUrl(value) {
  const v = (value ?? '').toString().trim().replace(/\/+$/, '');
  try {
    localStorage.setItem('dp-deploy-frontend', v);
  } catch { /* ignore */ }
}

/** Optional OpenAI key for Generate / Optimize lyrics in the browser. */
export function getOpenaiKey() {
  try {
    return localStorage.getItem('dp-openai-key') || '';
  } catch { /* ignore */ }
  return '';
}

export function setOpenaiKey(value) {
  try {
    localStorage.setItem('dp-openai-key', (value ?? '').toString().trim());
  } catch { /* ignore */ }
}

/** Optional Anthropic key for lyrics / Claude tools (same pattern as OpenAI). */
export function getAnthropicKey() {
  try {
    return localStorage.getItem('dp-anthropic-key') || '';
  } catch { /* ignore */ }
  return '';
}

export function setAnthropicKey(value) {
  try {
    localStorage.setItem('dp-anthropic-key', (value ?? '').toString().trim());
  } catch { /* ignore */ }
}

/**
 * Resolve a relative storage path from FastAPI (e.g. `/api/storage/local/x.wav`).
 * `backendBase` is the API **origin** only — same as Create page (`https://host` without `/api`).
 */
export function absoluteStorageUrl(backendBase, pathOrUrl) {
  if (!pathOrUrl) return '';
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const path = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  const b = (backendBase ?? '').toString().trim().replace(/\/+$/, '');
  if (b) return `${b}${path}`;
  if (typeof window !== 'undefined') return `${window.location.origin}${path}`;
  return path;
}

/** Parse JSON from a Dieter API response; throws with `detail` when present. */
export async function fetchDieterJson(url, options = {}) {
  const r = await fetch(url, { cache: 'no-store', ...options });
  const text = await r.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    const bit = text ? text.slice(0, 240) : '';
    throw new Error(
      r.ok ? `Invalid JSON from API${bit ? `: ${bit}` : ''}` : `HTTP ${r.status}: ${bit || r.statusText}`,
    );
  }
  if (!r.ok) {
    const detail = data?.detail;
    const msg =
      typeof detail === 'string'
        ? detail
        : detail
          ? JSON.stringify(detail)
          : text || r.statusText;
    throw new Error(`HTTP ${r.status}: ${msg}`);
  }
  return data;
}

