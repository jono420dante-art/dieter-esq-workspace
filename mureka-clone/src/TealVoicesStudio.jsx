import { useCallback, useEffect, useState } from 'react'
import {
  absoluteFromApiPath,
  normalizeApiRoot,
  parseFetchJson,
} from './apiResolve.js'
import { audioCrossOriginForSrc } from './dieterClientConfig.js'

export default function TealVoicesStudio({ apiBase }) {
  const base = normalizeApiRoot(apiBase || '/api')
  const [lyrics, setLyrics] = useState(
    '[Verse]\nYour words become a vocal take on the Dieter backend.\n\n[Chorus]\nTeal Voices routes through FastAPI, not Java.',
  )
  const [voiceId, setVoiceId] = useState('')
  const [pitch, setPitch] = useState(0)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [note, setNote] = useState('')
  const [mode, setMode] = useState('')
  const [audioUrl, setAudioUrl] = useState('')
  const [status, setStatus] = useState(null)

  const loadStatus = useCallback(async () => {
    try {
      const r = await fetch(`${base}/tealvoices/status`, { cache: 'no-store' })
      if (r.ok) setStatus(await r.json())
    } catch {
      setStatus(null)
    }
  }, [base])

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  const onSing = async () => {
    setErr('')
    setNote('')
    setAudioUrl('')
    const text = lyrics.trim()
    if (!text) {
      setErr('Add lyrics first.')
      return
    }
    setBusy(true)
    try {
      const r = await fetch(`${base}/tealvoices/sing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lyrics: text,
          voiceId: voiceId.trim() || null,
          pitchSemitones: Number(pitch) || 0,
        }),
      })
      const data = await parseFetchJson(r)

      const urlField = data.url || data.URL
      if (urlField) {
        setAudioUrl(absoluteFromApiPath(base, urlField))
      }
      setMode(data.tealvoicesMode || data.engine || '')
      setNote(data.note || '')
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
      void loadStatus()
    }
  }

  return (
    <div className="teal-voices-studio">
      <header className="teal-voices-hero">
        <h1 className="teal-voices-title">Teal Voices</h1>
        <p className="teal-voices-lead">
          Lyrics → <strong>Dieter FastAPI</strong> → WAV playback. Coqui TTS when the backend has the{' '}
          <code>TTS</code> package; otherwise a labeled procedural fallback. Production-grade sung vocals:{' '}
          <strong>Create → Mureka</strong>.
        </p>
      </header>

      {status && (
        <div className="teal-voices-status-pill" role="status">
          <span className={status.coquiAvailable ? 'teal-dot teal-dot--ok' : 'teal-dot teal-dot--warn'} />
          {status.coquiAvailable ? 'Coqui TTS ready' : 'Coqui offline — fallback stems only'}
          {typeof status.registeredCloneVoices === 'number' ? (
            <span className="teal-voices-status-meta">
              · {status.registeredCloneVoices} clone profile(s) on server
            </span>
          ) : null}
        </div>
      )}

      <label className="teal-voices-label" htmlFor="teal-lyrics">
        Lyrics
      </label>
      <textarea
        id="teal-lyrics"
        className="teal-voices-textarea"
        rows={10}
        value={lyrics}
        onChange={(e) => setLyrics(e.target.value)}
        placeholder="[Verse] ... [Chorus] ..."
      />

      <div className="teal-voices-controls">
        <div className="teal-voices-field">
          <label htmlFor="teal-voice-id">Clone voice id (optional)</label>
          <input
            id="teal-voice-id"
            type="text"
            value={voiceId}
            onChange={(e) => setVoiceId(e.target.value)}
            placeholder="e.g. from Voice studio registry — F0 hint when Coqui runs"
          />
        </div>
        <div className="teal-voices-field">
          <label htmlFor="teal-pitch">
            Pitch shift (semitones): <strong>{pitch}</strong>
          </label>
          <input
            id="teal-pitch"
            type="range"
            min={-12}
            max={12}
            step={0.5}
            value={pitch}
            onChange={(e) => setPitch(Number(e.target.value))}
          />
        </div>
      </div>

      {err ? (
        <p className="teal-voices-err" role="alert">
          {err}
        </p>
      ) : null}
      {note ? <p className="teal-voices-note">{note}</p> : null}
      {mode ? (
        <p className="teal-voices-mode">
          <span>Engine mode:</span> <code>{mode}</code>
        </p>
      ) : null}

      <div className="teal-voices-actions">
        <button type="button" className="teal-voices-primary" disabled={busy} onClick={onSing}>
          {busy ? 'Rendering…' : 'Sing my lyrics (backend)'}
        </button>
      </div>

      {audioUrl ? (
        <div className="teal-voices-player">
          <p className="teal-voices-label">Playback</p>
          <audio className="teal-voices-audio" controls src={audioUrl} crossOrigin={audioCrossOriginForSrc()} />
          <a className="teal-voices-dl" href={audioUrl} download>
            Download WAV
          </a>
        </div>
      ) : null}
    </div>
  )
}
