import { memo, useCallback, useRef, useState } from 'react'
import { getEngineBase } from '../lib/engineUrl'
import Spinner from './Spinner'

const STYLES = [
  ['afro-house', 'Afro house'],
  ['pop', 'Pop'],
  ['r&b', 'R&B'],
  ['edm', 'EDM'],
  ['hip-hop', 'Hip-hop'],
]

const AudioPlayer = memo(function AudioPlayer({ src }) {
  if (!src) return null
  return (
    <div className="fade-in" style={{ marginTop: 28 }}>
      <audio
        src={src}
        controls
        preload="metadata"
        style={{ width: '100%', borderRadius: 10 }}
      />
      <a
        href={src}
        download
        style={{
          display: 'inline-flex',
          marginTop: 14,
          padding: '0.65rem 1.1rem',
          borderRadius: 10,
          background: 'rgba(52, 211, 153, 0.2)',
          color: 'var(--ok)',
          fontWeight: 600,
          border: '1px solid rgba(52, 211, 153, 0.35)',
          transition: 'background 0.2s ease',
        }}
      >
        Download track
      </a>
    </div>
  )
})

export default function SongMaker() {
  const engine = getEngineBase()
  const resultRef = useRef(null)
  const [lyrics, setLyrics] = useState(`[Verse 1]
Jozi nights we rise high

[Chorus]
Sing these words back bright`)
  const [style, setStyle] = useState('afro-house')
  const [duration, setDuration] = useState(180)
  const [voice, setVoice] = useState('woman_soul')
  const [songUrl, setSongUrl] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [phase, setPhase] = useState('')

  const generate = useCallback(async () => {
    setErr('')
    setSongUrl('')
    setPhase('Sending lyrics to engine…')
    setBusy(true)
    const t = window.setTimeout(() => setPhase('Mureka is rendering vocals — often 1–3 min…'), 12000)
    try {
      const res = await fetch(`${engine}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lyrics,
          style,
          voice,
          duration,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        const detail =
          typeof j?.detail === 'string'
            ? j.detail
            : JSON.stringify(j?.detail ?? j)
        throw new Error(detail || res.statusText)
      }
      const path = j?.full_song
      if (!path || typeof path !== 'string') {
        throw new Error('No full_song in response')
      }
      setSongUrl(`${engine}${path}`)
      setPhase('')
      requestAnimationFrame(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    } catch (e) {
      setErr(String(e?.message ?? e))
      setPhase('')
    } finally {
      window.clearTimeout(t)
      setBusy(false)
    }
  }, [engine, lyrics, style, voice, duration])

  return (
    <div>
      <h1 style={{ marginTop: 0, fontSize: '1.85rem' }}>Generate</h1>
      <p style={{ color: 'var(--muted)', fontSize: '0.95rem', lineHeight: 1.55 }}>
        Engine:{' '}
        <code style={{ color: 'var(--text)', wordBreak: 'break-all' }}>{engine}</code>
      </p>

      <div
        style={{
          display: 'grid',
          gap: 12,
          marginTop: 20,
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        }}
      >
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.85rem', color: 'var(--muted)' }}>
          Style
          <select
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            disabled={busy}
            style={{
              padding: '0.65rem 0.75rem',
              borderRadius: 10,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)',
            }}
          >
            {STYLES.map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.85rem', color: 'var(--muted)' }}>
          Target length (sec)
          <input
            type="number"
            min={30}
            max={600}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value) || 180)}
            disabled={busy}
            style={{
              padding: '0.65rem 0.75rem',
              borderRadius: 10,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)',
            }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.85rem', color: 'var(--muted)' }}>
          Voice hint
          <input
            type="text"
            value={voice}
            onChange={(e) => setVoice(e.target.value)}
            disabled={busy}
            placeholder="woman_soul"
            style={{
              padding: '0.65rem 0.75rem',
              borderRadius: 10,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)',
            }}
          />
        </label>
      </div>

      <label
        style={{
          display: 'block',
          marginTop: 18,
          fontSize: '0.85rem',
          color: 'var(--muted)',
          fontWeight: 600,
        }}
      >
        Lyrics
      </label>
      <textarea
        value={lyrics}
        onChange={(e) => setLyrics(e.target.value)}
        placeholder="Verse / chorus structure works best"
        disabled={busy}
        style={{
          width: '100%',
          minHeight: 220,
          marginTop: 8,
          padding: 14,
          fontSize: '1rem',
          lineHeight: 1.5,
          borderRadius: 12,
          border: '1px solid var(--border)',
          background: 'rgba(0,0,0,0.25)',
          color: 'var(--text)',
          resize: 'vertical',
          transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
        }}
      />

      <button
        type="button"
        onClick={() => void generate()}
        disabled={busy || lyrics.trim().length < 10}
        className={busy ? 'shimmer' : ''}
        style={{
          marginTop: 18,
          padding: '0.95rem 1.4rem',
          borderRadius: 12,
          border: 'none',
          fontWeight: 700,
          fontSize: '1rem',
          cursor: busy ? 'wait' : 'pointer',
          opacity: lyrics.trim().length < 10 ? 0.55 : 1,
          background: busy ? 'rgba(168, 85, 247, 0.35)' : 'linear-gradient(115deg, var(--accent), var(--accent2))',
          color: '#fff',
          boxShadow: busy ? 'none' : '0 8px 28px rgba(168, 85, 247, 0.35)',
          transition: 'transform 0.15s ease, box-shadow 0.2s ease, opacity 0.2s ease',
        }}
      >
        {busy ? 'Generating…' : 'Generate sung song'}
      </button>

      {phase && busy ? <Spinner label={phase} /> : null}

      {err ? (
        <p className="fade-in" style={{ color: 'var(--err)', marginTop: 18 }} role="alert">
          {err}
        </p>
      ) : null}

      <div ref={resultRef} />
      <AudioPlayer src={songUrl} />
    </div>
  )
}
