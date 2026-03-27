/** Same-origin URL so `<audio>` and `fetch` can load remote MP3 without CDN CORS issues. */
export function proxiedAudioSrc(absoluteUrl) {
  if (!absoluteUrl || typeof absoluteUrl !== 'string') return '';
  if (absoluteUrl.startsWith('/')) return absoluteUrl;
  if (!/^https?:\/\//i.test(absoluteUrl)) return absoluteUrl;
  return `/api/audio/proxy?url=${encodeURIComponent(absoluteUrl)}`;
}
