/**
 * Local lyrics generation + optimization (mirrors mureka-clone).
 * Optional OpenAI from browser (may be CORS-blocked — falls back to local).
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
      if (/^[a-z]/.test(t)) return t.charAt(0).toUpperCase() + t.slice(1)
      return t
    })
    out.push(lines.filter(Boolean).join('\n'))
  }
  return out.join('\n\n')
}

export async function generateLyricsOpenAI(apiKey, style, title, vocal) {
  if (!apiKey?.trim()) return null
  const sys =
    'You write concise song lyrics with [Verse] / [Chorus] section tags. No explanations, lyrics only.'
  const user = `Style: ${style}. Title hint: ${title || 'untitled'}. Vocal: ${vocal}. Write 16–24 lines.`
  return openAiChat(apiKey, sys, user)
}

export async function optimizeLyricsOpenAI(apiKey, lyrics) {
  if (!apiKey?.trim() || !lyrics?.trim()) return null
  const sys =
    'You improve song lyrics: tighter rhyme, clearer imagery, same language. Keep [Section] tags. Output lyrics only.'
  const user = lyrics.trim()
  return openAiChat(apiKey, sys, user)
}

async function openAiChat(apiKey, system, user) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey.trim()}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.9,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(t || `OpenAI ${res.status}`)
  }
  const j = await res.json()
  const text = j?.choices?.[0]?.message?.content
  return typeof text === 'string' ? text.trim() : null
}
