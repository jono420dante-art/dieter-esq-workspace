import { NextRequest, NextResponse } from 'next/server'

const MUREKA_GENERATE = 'https://api.mureka.ai/v1/song/generate'

/**
 * POST /api/full-song
 * Proxies Mureka song generation. Official body fields (see platform quickstart):
 * lyrics, model, prompt — https://platform.mureka.ai/docs/en/quickstart.html
 * Target length is expressed in **prompt** (no guaranteed duration_ms in public docs).
 */
export async function POST(req: NextRequest) {
  let body: {
    lyrics?: string
    style?: string
    duration?: number
    model?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const lyrics = String(body.lyrics ?? '').trim()
  const style = String(body.style ?? 'pop').trim() || 'pop'
  const duration = Number.isFinite(body.duration) ? Number(body.duration) : 180
  const model = String(body.model ?? 'auto').trim() || 'auto'

  const MIN = 10
  if (lyrics.length < MIN) {
    return NextResponse.json(
      { error: `Lyrics too short (minimum ${MIN} characters)` },
      { status: 400 },
    )
  }

  const key = process.env.MUREKA_API_KEY?.trim()
  if (!key) {
    return NextResponse.json(
      { error: 'Server missing MUREKA_API_KEY' },
      { status: 500 },
    )
  }

  const prompt = [
    style,
    'professional vocals',
    'full production',
    'emotional',
    `target length approximately ${Math.max(30, Math.min(duration, 600))} seconds`,
  ].join(', ')

  const upstream = await fetch(MUREKA_GENERATE, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'Dieter-Music/Next-full-song/1.0',
    },
    body: JSON.stringify({
      lyrics,
      model,
      prompt,
    }),
  })

  const text = await upstream.text()
  let json: Record<string, unknown> = {}
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : {}
  } catch {
    json = { raw: text }
  }

  if (!upstream.ok) {
    return NextResponse.json(
      { error: 'Mureka generate failed', detail: json, status: upstream.status },
      { status: upstream.status },
    )
  }

  const taskId = String(json.task_id ?? json.id ?? json.taskId ?? '').trim()
  if (!taskId) {
    return NextResponse.json(
      { error: 'No task id from Mureka', detail: json },
      { status: 502 },
    )
  }

  return NextResponse.json({
    taskId,
    pollUrl: `/api/song-status/${encodeURIComponent(taskId)}`,
    eta: 'often 1–3 minutes — poll until songUrl is present',
    traceId: json.trace_id,
  })
}
