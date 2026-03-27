'use client'

import { useCallback, useMemo, useState } from 'react'
import useSWR from 'swr'

const fetcher = async (url: string) => {
  const r = await fetch(url)
  const j = await r.json().catch(() => ({}))
  if (!r.ok) {
    throw new Error(typeof j?.error === 'string' ? j.error : r.statusText)
  }
  return j
}

type StatusPayload = {
  status?: string
  songUrl?: string
  stems?: string[]
  lyricsSung?: string
  failed?: boolean
  detail?: unknown
  progress?: unknown
}

export default function SongGenerator() {
  const [lyrics, setLyrics] = useState(`[Verse 1]
Jozi lights shine bright tonight
Bass hits hard, we own the night

[Chorus]
Sing my words, make them fly
AI vocals touch the sky`)
  const [taskId, setTaskId] = useState('')
  const [submitErr, setSubmitErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const statusKey = taskId
    ? `/api/song-status/${encodeURIComponent(taskId)}`
    : null

  const { data: song, error: pollErr } = useSWR<StatusPayload>(
    statusKey,
    fetcher,
    {
      refreshInterval: (data) =>
        data?.songUrl || data?.failed ? 0 : 4000,
      revalidateOnFocus: false,
    },
  )

  const reset = useCallback(() => {
    setTaskId('')
    setSubmitErr(null)
  }, [])

  const generateSong = async () => {
    setSubmitErr(null)
    setBusy(true)
    try {
      const res = await fetch('/api/full-song', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lyrics,
          style: 'afro-house',
          duration: 180,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(
          typeof j?.error === 'string' ? j.error : `HTTP ${res.status}`,
        )
      }
      const id = String(j.taskId ?? '').trim()
      if (!id) throw new Error('No taskId in response')
      setTaskId(id)
    } catch (e) {
      setSubmitErr(String((e as Error)?.message ?? e))
    } finally {
      setBusy(false)
    }
  }

  const pending = Boolean(taskId && !song?.songUrl && !song?.failed)

  const stemList = useMemo(() => {
    const s = song?.stems
    return Array.isArray(s) ? s : []
  }, [song?.stems])

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-4xl font-bold mb-8">3‑minute song generator</h1>
      <p className="text-sm text-neutral-600 mb-4">
        Uses Mureka{' '}
        <code className="text-xs bg-neutral-100 px-1 rounded">/v1/song/generate</code> — set{' '}
        <code className="text-xs bg-neutral-100 px-1 rounded">MUREKA_API_KEY</code> on Vercel.
        Length is requested via the prompt; exact duration is model‑dependent.
      </p>

      <textarea
        value={lyrics}
        onChange={(e) => setLyrics(e.target.value)}
        className="w-full p-4 border rounded-xl h-48 mb-4 text-lg"
        placeholder="Paste lyrics (verse / chorus structure works well)"
        disabled={busy || pending}
      />

      {submitErr ? (
        <p className="text-red-600 mb-4" role="alert">
          {submitErr}
        </p>
      ) : null}
      {pollErr ? (
        <p className="text-red-600 mb-4" role="alert">
          {String(pollErr)}
        </p>
      ) : null}
      {song?.failed ? (
        <pre className="bg-red-50 text-red-800 p-4 rounded-lg text-sm overflow-auto mb-4">
          {JSON.stringify(song.detail ?? song, null, 2)}
        </pre>
      ) : null}

      <div className="flex flex-wrap gap-3 mb-8">
        <button
          type="button"
          onClick={() => void generateSong()}
          className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-8 py-4 rounded-xl text-xl font-bold hover:shadow-xl disabled:opacity-50"
          disabled={busy || pending}
        >
          {busy ? 'Starting…' : pending ? 'Generating…' : 'Generate song'}
        </button>
        {(taskId || submitErr) && !pending ? (
          <button
            type="button"
            onClick={reset}
            className="border border-neutral-300 px-6 py-4 rounded-xl font-medium hover:bg-neutral-50"
          >
            New song
          </button>
        ) : null}
      </div>

      {pending ? (
        <p className="text-neutral-600">
          Generating… {song?.status ? `(${String(song.status)})` : ''}
          {song?.progress != null ? ` — ${JSON.stringify(song.progress)}` : ''}
        </p>
      ) : null}

      {song?.songUrl ? (
        <div className="space-y-4">
          <audio src={song.songUrl} controls className="w-full" />
          {stemList.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {stemList.map((src, i) => (
                <audio key={`${src}-${i}`} src={src} controls className="w-full" />
              ))}
            </div>
          ) : (
            <p className="text-sm text-neutral-500">
              No stem URLs in this response (Mureka may not expose stems on the public query payload).
            </p>
          )}
          {song.lyricsSung ? (
            <p className="text-sm whitespace-pre-wrap border rounded-lg p-4 bg-neutral-50">
              {song.lyricsSung}
            </p>
          ) : null}
          <a
            href={song.songUrl}
            download
            className="inline-block bg-green-600 text-white px-6 py-2 rounded-lg"
          >
            Download
          </a>
        </div>
      ) : null}
    </div>
  )
}
