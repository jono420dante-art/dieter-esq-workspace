/**
 * Browser fallbacks when FastAPI `/api/lyrics/*` is unreachable.
 * Primary path: tRPC → FastAPI (OpenAI via server `OPENAI_API_KEY` or optional `openaiApiKey` in request).
 */

const VERSE_LINES = [
  'Walking through the static of a midnight dream',
  'Every echo tells me nothing’s what it seems',
  'Hold the rhythm where the city meets the sea',
  'Paint the silence in a color only you can see',
]

const CHORUS_LINES = [
  'We rise, we fall, we learn to feel alive',
  'Turn the page, rewrite the story line by line',
  'In the glow of every wrong-turned-right',
  'This is the moment we ignite',
]

const STYLE_HINTS = {
  trap: ['808s', 'hi-hats triplet feel', 'sub-heavy', 'dark room'],
  piano: ['grand piano', 'soft pedal', 'intimate room', 'melodic'],
  rock: ['live drums', 'crunch guitars', 'arena energy', 'anthem'],
  jazz: ['swing', 'walking bass', 'brush kit', 'smoky club'],
  ambient: ['pads', 'wide stereo', 'slow evolution', 'breath'],
  phonk: ['memphis chops', 'distorted 808', 'night drive', 'tape'],
  default: ['modern mix', 'wide vocals', 'tight low end', 'hook-first'],
}

function tokensFromStyle(style) {
  const s = (style || '').toLowerCase()
  for (const [key, arr] of Object.entries(STYLE_HINTS)) {
    if (key !== 'default' && s.includes(key)) return arr
  }
  return STYLE_HINTS.default
}

/** Build original verse/chorus lyrics inspired by style + title. */
export function generateLyricsLocal(style, title, vocal) {
  const hint = tokensFromStyle(style).join(', ')
  const v = vocal === 'male' ? 'voice low in the mix' : 'bright lead vocal'
  const t = (title || 'Untitled').trim()
  const lines = [
    `[Verse 1]`,
    `${VERSE_LINES[0]},`,
    `${VERSE_LINES[1]}.`,
    `(${hint}; ${v})`,
    '',
    `[Chorus]`,
    `${CHORUS_LINES[0]},`,
    `${CHORUS_LINES[1]}.`,
    '',
    `[Verse 2]`,
    `${VERSE_LINES[2]},`,
    `${VERSE_LINES[3]}.`,
    '',
    `[Chorus]`,
    `${CHORUS_LINES[2]},`,
    `${CHORUS_LINES[3]}.`,
    '',
    `[Outro]`,
    `Carry "${t}" like a pulse beneath the skin…`,
  ]
  return lines.join('\n')
}

/** Trim, normalize breaks, light “polish” for demo optimization. */
export function optimizeLyricsLocal(text) {
  if (!text || !String(text).trim()) return ''
  let s = String(text)
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
  const parts = s
    .split(/\n\n+/)
    .map((block) => block.trim())
    .filter(Boolean)
  const out = []
  for (const block of parts) {
    const lines = block.split('\n').map((l) => {
      const t = l.trim()
      if (!t) return ''
      // Capitalize first letter if line looks like a sentence
      if (/^[a-z]/.test(t)) return t.charAt(0).toUpperCase() + t.slice(1)
      return t
    })
    out.push(lines.filter(Boolean).join('\n'))
  }
  return out.join('\n\n')
}
