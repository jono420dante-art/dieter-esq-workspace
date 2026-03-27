/** When the UI is static (e.g. Vercel) and the API is on another host (e.g. Render), set VITE_API_BASE_URL. */
function apiBase() {
  try {
    const b = import.meta.env?.VITE_API_BASE_URL || import.meta.env?.VITE_API_URL || '';
    return String(b).replace(/\/$/, '');
  } catch {
    return '';
  }
}

/** Same-origin (or VITE_API_BASE_URL) URL so `<audio>` and `fetch` can load remote MP3 without CDN CORS issues. */
export function proxiedAudioSrc(absoluteUrl) {
  if (!absoluteUrl || typeof absoluteUrl !== 'string') return '';
  if (absoluteUrl.startsWith('/')) return absoluteUrl;
  if (!/^https?:\/\//i.test(absoluteUrl)) return absoluteUrl;
  const path = `/api/audio/proxy?url=${encodeURIComponent(absoluteUrl)}`;
  const origin = apiBase();
  return origin ? `${origin}${path}` : path;
}
