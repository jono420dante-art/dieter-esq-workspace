import { useCallback, useMemo, useRef, useState } from 'react'
import AudioTransport from './AudioTransport.jsx'
import { audioCrossOriginForSrc } from './dieterClientConfig.js'
import './SongPlaybackPage.css'

function tokenizeLyrics(text) {
  const src = String(text || '').trim()
  if (!src) return []
  return src
    .replace(/\n+/g, ' \n ')
    .split(/\s+/)
    .filter(Boolean)
}

export default function SongPlaybackPage({ track, onBackToCreate }) {
  const audioRef = useRef(null)
  const [playhead, setPlayhead] = useState({ cur: 0, dur: 0 })
  const words = useMemo(() => tokenizeLyrics(track?.lyrics || ''), [track?.lyrics])

  const onPlaybackTick = useCallback(() => {
    const el = audioRef.current
    if (!el) return
    setPlayhead({ cur: el.currentTime, dur: el.duration })
  }, [])

  const { cur, dur } = playhead
  const idx =
    words.length > 0 && Number.isFinite(dur) && dur > 0
      ? Math.min(words.length - 1, Math.floor((cur / dur) * words.length))
      : -1

  return (
    <main className="player-page" key={track?.url || 'none'}>
      <header className="player-head">
        <div>
          <h2>{track?.title || 'Generated track'}</h2>
          <p>Now playing · synced word highlight</p>
        </div>
        <button type="button" className="player-back glow-red-soft" onClick={onBackToCreate}>
          Back to Create
        </button>
      </header>

      <section className="player-card">
        <AudioTransport
          audioRef={audioRef}
          src={track?.url || ''}
          crossOrigin={audioCrossOriginForSrc(track?.url || '')}
          onPlaybackTick={onPlaybackTick}
        />
      </section>

      <section className="lyrics-card">
        <h3>Lyrics follow</h3>
        {words.length ? (
          <p className="lyrics-flow">
            {words.map((w, i) => (
              <span key={`${w}_${i}`} className={i === idx ? 'ly-word active' : 'ly-word'}>
                {w}
              </span>
            ))}
          </p>
        ) : (
          <p className="lyrics-empty">No lyrics provided for this track.</p>
        )}
      </section>
    </main>
  )
}
