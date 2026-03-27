/**
 * Browser-visible engine base URL (lyrics FastAPI worker).
 * Set in Vercel / hosting: VITE_ENGINE_URL=https://your-api.up.railway.app
 */
export function getEngineBase() {
  const raw = import.meta.env.VITE_ENGINE_URL || 'http://127.0.0.1:3001'
  return String(raw).replace(/\/$/, '')
}

export function getPublicSiteUrl() {
  return (
    import.meta.env.VITE_PUBLIC_SITE_URL ||
    (typeof window !== 'undefined' ? window.location.origin : '')
  )
}
