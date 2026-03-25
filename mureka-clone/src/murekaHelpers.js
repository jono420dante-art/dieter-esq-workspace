import { STUDIO_NAME } from './studioBrand.js'

/** Shared Mureka response parsing (matches App.jsx). */
export function extractAudioUrl(obj, depth = 0) {
  if (!obj || depth > 12) return null
  if (
    typeof obj === 'string' &&
    /^https?:\/\//.test(obj) &&
    /\.(mp3|wav|m4a|ogg)(\?|$)/i.test(obj)
  )
    return obj
  if (typeof obj === 'object') {
    for (const k of ['mp3_url', 'audio_url', 'url', 'download_url', 'file_url']) {
      const v = obj[k]
      if (typeof v === 'string' && v.startsWith('http')) return v
    }
    for (const v of Object.values(obj)) {
      const u = extractAudioUrl(v, depth + 1)
      if (u) return u
    }
  }
  return null
}

/** One-shot prompt from landing controls → Mureka `prompt` field. */
export function buildLandingMurekaPrompt({ genre, mood, tempoBpm, vocal, userPrompt }) {
  const style =
    genre === 'all' ? 'Modern pop / electronic crossover' : `${genre} production`
  const chunks = []
  chunks.push(`Title: ${STUDIO_NAME} session`)
  chunks.push(`Musical style / production: ${style}`)
  chunks.push(`Mood: ${mood}`)
  chunks.push(`Target tempo: ~${tempoBpm} BPM`)
  const instrumental = vocal === 'none'
  if (instrumental) {
    chunks.push('Instrumental track only — no lead vocals, no sung lyrics.')
    chunks.push('Focus on melody in instruments, arrangement, and mix.')
  } else {
    chunks.push(`${vocal === 'male' ? 'Male' : 'Female'} lead vocal.`)
    const lyr = (userPrompt || '').trim()
    if (lyr) chunks.push(`Creative direction / lyrics:\n${lyr}`)
    else chunks.push('Write a memorable topline and lyrics matching the style.')
  }
  return chunks.join('\n\n')
}
