import { normalizeApiRoot } from './apiResolve.js'

/**
 * tRPC: enabled in dev (Vite proxies /trpc) unless VITE_USE_TRPC=false.
 * Production builds default off (Docker + Vercel REST) unless VITE_USE_TRPC=true.
 */
export function dieterUseTrpc() {
  const v = import.meta.env.VITE_USE_TRPC
  if (v === 'true') return true
  if (v === 'false') return false
  return Boolean(import.meta.env.DEV)
}

function looksLikeLocalDevApi(s) {
  return /127\.0\.0\.1|localhost/i.test(s || '')
}

/**
 * Prefer baked VITE_API_BASE in production when it is an absolute URL, so a stale
 * localStorage value from localhost does not send Vercel traffic to /api on the wrong host.
 * If the user saved another real https API in Connections, that still wins over env when sensible.
 */
export function dieterInitialApiBase() {
  if (typeof window !== 'undefined' && localStorage.getItem('dieter_prioritize_my_gateway') === '1') {
    const mine = localStorage.getItem('dieter_my_gateway_url')?.trim()
    if (mine) return normalizeApiRoot(mine)
  }

  const envRaw = (import.meta.env.VITE_API_BASE || '').trim()
  const envNorm = envRaw ? normalizeApiRoot(envRaw) : ''
  const isProd = import.meta.env.PROD
  const envIsRemote = /^https?:\/\//i.test(envNorm)

  const storedRaw = localStorage.getItem('dieter_api_base')?.trim()
  const storedNorm = storedRaw ? normalizeApiRoot(storedRaw) : ''

  if (isProd && envIsRemote) {
    if (storedNorm && /^https?:\/\//i.test(storedNorm) && !looksLikeLocalDevApi(storedNorm)) {
      return storedNorm
    }
    return envNorm
  }

  if (storedNorm) {
    return storedNorm
  }
  if (envNorm) {
    return envNorm
  }
  const bakedGateway = (import.meta.env.VITE_MY_GATEWAY_URL || '').trim()
  if (bakedGateway) {
    return normalizeApiRoot(bakedGateway)
  }
  return normalizeApiRoot('/api')
}

/** Only same-origin audio uses crossOrigin=anonymous (Web Audio). External URLs omit it so playback is not blocked by CDN CORS. */
export function audioCrossOriginForSrc(url) {
  if (!url || typeof url !== 'string' || typeof window === 'undefined') return undefined
  try {
    const u = new URL(url, window.location.href)
    if (u.origin === window.location.origin) return 'anonymous'
  } catch {
    /* ignore */
  }
  return undefined
}
