/**
 * Public site origin for meta tags (canonical, og:url).
 * Set VITE_SITE_URL when deploying somewhere other than the default Vercel app.
 */
/** Stable production hostname — create this Vercel alias or set `VITE_SITE_URL` (e.g. existing *.vercel.app). */
const DEFAULT_VERCEL_PROD = 'https://dieter-music.app'

export function getSiteUrl() {
  const fromEnv = import.meta.env.VITE_SITE_URL?.trim()
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  if (import.meta.env.PROD) return DEFAULT_VERCEL_PROD.replace(/\/$/, '')
  return ''
}
