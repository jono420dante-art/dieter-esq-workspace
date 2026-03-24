/**
 * Public site origin for meta tags (canonical, og:url).
 * Set VITE_SITE_URL when deploying somewhere other than the default Vercel app.
 */
/** Stable production hostname (Vercel alias). Deployment URLs `*-*.vercel.app` change each deploy. */
const DEFAULT_VERCEL_PROD = 'https://dieter-esq-workspace.vercel.app'

export function getSiteUrl() {
  const fromEnv = import.meta.env.VITE_SITE_URL?.trim()
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  if (import.meta.env.PROD) return DEFAULT_VERCEL_PROD.replace(/\/$/, '')
  return ''
}
