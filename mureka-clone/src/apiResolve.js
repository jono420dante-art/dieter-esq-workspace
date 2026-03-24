/**
 * Resolve Dieter FastAPI URLs when the UI is on a different host than the API
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
    return r.ok ? await r.json().catch(() => ({})) : null
  } catch {
    return null
  }
}

export async function fetchStudioGrowth(apiRoot) {
  try {
    const r = await fetch(`${apiRoot}/studio/growth`)
    if (!r.ok) return null
    return await r.json()
  } catch {
    return null
  }
}
