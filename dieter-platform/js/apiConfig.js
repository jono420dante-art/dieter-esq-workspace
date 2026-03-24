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

