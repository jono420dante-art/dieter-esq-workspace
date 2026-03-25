import { useCallback, useRef, useState } from 'react'

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * Play / Pause / Stop plus elapsed · duration. Forwards ref to &lt;audio&gt; (e.g. Web Audio visualizer).
 */
export default function AudioTransport({
  audioRef,
  src,
  crossOrigin,
  className = '',
  withNativeControls = true,
  /** Optional: parent sync (e.g. lyrics highlight). */
  onPlaybackTick,
}) {
  const [tick, setTick] = useState(0)
  const [dur, setDur] = useState(NaN)

  const a = audioRef?.current
  const cur = a?.currentTime ?? 0
  void tick

  const play = useCallback(() => {
    audioRef?.current?.play().catch(() => {})
  }, [audioRef])
  const pause = useCallback(() => {
    audioRef?.current?.pause()
  }, [audioRef])
  const stop = useCallback(() => {
    const el = audioRef?.current
    if (!el) return
    el.pause()
    try {
      // eslint-disable-next-line react-hooks/immutability -- DOM API: reset audio playhead
      el.currentTime = 0
    } catch {
      /* ignore */
    }
    setTick((x) => x + 1)
  }, [audioRef])

  return (
    <div className="audio-transport">
      <audio
        ref={audioRef}
        key={src || 'empty'}
        src={src || undefined}
        crossOrigin={crossOrigin}
        className={className}
        controls={withNativeControls}
        preload="metadata"
        onTimeUpdate={() => {
          setTick((x) => x + 1)
          onPlaybackTick?.()
        }}
        onLoadedMetadata={(e) => {
          setDur(e.currentTarget.duration)
          onPlaybackTick?.()
        }}
        onDurationChange={(e) => setDur(e.currentTarget.duration)}
        onEnded={() => {
          setTick((x) => x + 1)
          onPlaybackTick?.()
        }}
      />
      <div className="audio-transport-controls" role="group" aria-label="Playback">
        <button type="button" className="audio-transport-btn" onClick={play}>
          Play
        </button>
        <button type="button" className="audio-transport-btn" onClick={pause}>
          Pause
        </button>
        <button type="button" className="audio-transport-btn audio-transport-btn--stop" onClick={stop}>
          Stop
        </button>
        <span className="audio-transport-time" title="Elapsed time · total duration">
          {formatTime(cur)} · {formatTime(dur)}
        </span>
      </div>
    </div>
  )
}

/** Own ref — use when the parent does not need the audio element (Cover preview, etc.). */
export function AudioTransportLocal({ src, crossOrigin, className = '', withNativeControls = true }) {
  const r = useRef(null)
  return (
    <AudioTransport
      audioRef={r}
      src={src}
      crossOrigin={crossOrigin}
      className={className}
      withNativeControls={withNativeControls}
    />
  )
}
