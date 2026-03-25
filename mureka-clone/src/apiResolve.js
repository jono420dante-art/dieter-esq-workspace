/**
 * Resolve ED-GEERDES FastAPI URLs when the UI is on a different host than the API
 * (e.g. Cloudflare Pages + Railway).
 */

/** Host-only bases get `/api` appended. */
export function normalizeApiRoot(raw) {
  const r = (raw || '/api').trim().replace(/\/$/, '')
  if (r === '/api' || r.endsWith('/api')) return r
  if (!r || r === '/') return '/api'
  return `${r}/api`
}

/**
 * Turn a path like `/api/storage/local/x.mp3` into an absolute URL using the API origin.
 */
export function absoluteFromApiPath(apiRoot, pathOrUrl) {
  if (!pathOrUrl) return ''
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl
  const path = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`
  if (apiRoot.startsWith('http://') || apiRoot.startsWith('https://')) {
    try {
      return new URL(path, new URL(apiRoot).origin).href
    } catch {
      return pathOrUrl
    }
  }
  if (typeof window === 'undefined') return path
  return `${window.location.origin}${path}`
}

/** Origin for tRPC `jobWithPlaybackUrls` and absolute WAV URLs (no /api path). */
export function publicOriginForApiRoot(apiRoot) {
  const r = (apiRoot || '').trim()
  if (r.startsWith('http://') || r.startsWith('https://')) {
    try {
      return new URL(r).origin
    } catch {
      return ''
    }
  }
  if (typeof window !== 'undefined') return window.location.origin
  return ''
}

/**
 * Read JSON from a fetch Response without throwing on empty body or non-JSON errors.
 * Surfaces HTTP status (e.g. 405 = wrong method) in the Error message.
 */
export async function parseFetchJson(response) {
  const text = await response.text()
  const trimmed = text.trim()
  if (!response.ok) {
    const methodHint =
      response.status === 405
        ? ' Wrong HTTP method for this path (many API routes require POST, not GET).'
        : ''
    let detail = trimmed || '(empty response body)'
    if (trimmed) {
      try {
        const j = JSON.parse(trimmed)
        if (j != null && typeof j === 'object' && 'detail' in j) {
          detail = typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail)
        }
      } catch {
        /* keep raw text */
      }
    }
    throw new Error(`HTTP ${response.status}${methodHint} ${detail}`.trim())
  }
  if (!trimmed) return null
  try {
    return JSON.parse(trimmed)
  } catch {
    throw new Error(`Invalid JSON (HTTP ${response.status}): ${trimmed.slice(0, 240)}`)
  }
}

export function storageUrlFromKey(apiRoot, key) {
  if (!key) return ''
  const k = String(key).replace(/^\//, '')
  const i = k.indexOf('/')
  if (i === -1) return ''
  const bucket = k.slice(0, i)
  const file = k.slice(i + 1)
  return absoluteFromApiPath(apiRoot, `/api/storage/${bucket}/${encodeURIComponent(file)}`)
}

export async function postStudioGrowth(apiRoot, kind, note = '') {
  try {
    const r = await fetch(`${apiRoot}/studio/growth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, note: String(note).slice(0, 500) }),
    })
    return r.ok ? (await parseFetchJson(r).catch(() => ({})) ?? {}) : null
  } catch {
    return null
  }
}

export async function fetchStudioGrowth(apiRoot) {
  try {
    const r = await fetch(`${apiRoot}/studio/growth`)
    if (!r.ok) return null
    return await parseFetchJson(r).catch(() => null)
  } catch {
    return null
  }
}

/**
 * GET /api/health — latency + JSON for Portal & static pages.
 */
export async function fetchApiHealth(apiRoot) {
  const t0 = typeof performance !== 'undefined' ? performance.now() : 0
  try {
    const r = await fetch(`${apiRoot}/health`, { method: 'GET' })
    const ms = typeof performance !== 'undefined' ? Math.round(performance.now() - t0) : null
    let json = null
    try {
      json = await parseFetchJson(r)
    } catch (e) {
      return {
        ok: false,
        status: r.status,
        ms,
        json: null,
        error: e?.message || `HTTP ${r.status}`,
      }
    }
    return { ok: true, status: r.status, ms, json, error: null }
  } catch (e) {
    const ms = typeof performance !== 'undefined' ? Math.round(performance.now() - t0) : null
    return { ok: false, status: 0, ms, json: null, error: e?.message || String(e) }
  }
}

/** GET /api/local/capabilities — lightweight “is local DSP wired?” probe. */
export async function fetchLocalCapsSummary(apiRoot) {
  try {
    const r = await fetch(`${apiRoot}/local/capabilities`, { method: 'GET' })
    await parseFetchJson(r)
    return { ok: true, error: null }
  } catch (e) {
    return { ok: false, error: e?.message || String(e) }
  }
}
