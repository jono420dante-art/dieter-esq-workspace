import { NextRequest, NextResponse } from 'next/server'
import { extractAudioUrl, extractStemUrls, murekaTaskFailed } from '../../../../lib/murekaAudio'

type Ctx = { params: Promise<{ taskId: string }> }

/**
 * GET /api/song-status/[taskId]
 * Proxies Mureka GET /v1/song/query/{id}
 */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { taskId: raw } = await ctx.params
  const taskId = decodeURIComponent(String(raw ?? '').trim())
  if (!taskId) {
    return NextResponse.json({ error: 'Missing taskId' }, { status: 400 })
  }

  const key = process.env.MUREKA_API_KEY?.trim()
  if (!key) {
    return NextResponse.json({ error: 'Server missing MUREKA_API_KEY' }, { status: 500 })
  }

  const resp = await fetch(
    `https://api.mureka.ai/v1/song/query/${encodeURIComponent(taskId)}`,
    {
      headers: {
        Authorization: `Bearer ${key}`,
        Accept: 'application/json',
        'User-Agent': 'Dieter-Music/Next-full-song/1.0',
      },
    },
  )

  const text = await resp.text()
  let song: Record<string, unknown> = {}
  try {
    song = text ? (JSON.parse(text) as Record<string, unknown>) : {}
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON from Mureka', raw: text.slice(0, 500) },
      { status: 502 },
    )
  }

  if (!resp.ok) {
    return NextResponse.json(
      { error: 'Mureka query failed', detail: song, status: resp.status },
      { status: resp.status },
    )
  }

  const status = song.status ?? song.state
  const songUrl = extractAudioUrl(song)
  const stems = extractStemUrls(song)

  if (murekaTaskFailed(status, song)) {
    return NextResponse.json({
      status,
      failed: true,
      detail: song,
    })
  }

  if (songUrl) {
    const lyricsSung =
      (typeof song.lyrics_sung === 'string' && song.lyrics_sung) ||
      (typeof song.lyrics === 'string' && song.lyrics) ||
      undefined

    return NextResponse.json({
      status: 'ready',
      songUrl,
      stems: stems.length ? stems : undefined,
      lyricsSung,
      raw: process.env.NODE_ENV === 'development' ? song : undefined,
    })
  }

  return NextResponse.json({
    status: status ?? 'pending',
    progress: song.progress ?? song.percent,
  })
}
