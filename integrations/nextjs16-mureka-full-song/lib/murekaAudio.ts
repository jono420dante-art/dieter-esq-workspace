/**
 * Mirrors mureka-clone/src/murekaHelpers.js — Mureka poll payloads vary by version.
 */
export function extractAudioUrl(obj: unknown, depth = 0): string | null {
  if (!obj || depth > 12) return null
  if (
    typeof obj === 'string' &&
    /^https?:\/\//.test(obj) &&
    /\.(mp3|wav|m4a|ogg)(\?|$)/i.test(obj)
  ) {
    return obj
  }
  if (typeof obj === 'object' && obj !== null) {
    const o = obj as Record<string, unknown>
    for (const k of ['mp3_url', 'audio_url', 'url', 'download_url', 'file_url', 'song_url']) {
      const v = o[k]
      if (typeof v === 'string' && v.startsWith('http')) return v
    }
    for (const v of Object.values(o)) {
      const u = extractAudioUrl(v, depth + 1)
      if (u) return u
    }
  }
  return null
}

/** Stem URLs if API returns an array of strings or { name, url } objects. */
export function extractStemUrls(obj: unknown): string[] {
  if (!obj || typeof obj !== 'object') return []
  const o = obj as Record<string, unknown>
  const raw = o.stems ?? o.stem_urls ?? o.tracks
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const item of raw) {
    if (typeof item === 'string' && item.startsWith('http')) out.push(item)
    else if (item && typeof item === 'object' && 'url' in item) {
      const u = (item as { url?: unknown }).url
      if (typeof u === 'string' && u.startsWith('http')) out.push(u)
    }
  }
  return out
}

export function murekaTaskFailed(status: unknown, body: unknown): boolean {
  const st = `${status ?? ''}`.toLowerCase()
  if (st.includes('fail') || st.includes('error')) return true
  if (body && typeof body === 'object' && 'error' in body) return true
  return false
}
