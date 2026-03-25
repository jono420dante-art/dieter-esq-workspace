import { useCallback, useEffect, useRef, useState } from 'react'
import WaveSurfer from 'wavesurfer.js'
import Regions from 'wavesurfer.js/dist/plugins/regions.esm.js'
import BeatLabPro from './BeatLabPro.jsx'
import { absoluteFromApiPath, parseFetchJson, postStudioGrowth } from './apiResolve.js'

/** Empty = same origin (FastAPI serves React + /api). Dev: set VITE_BEAT_API_URL=http://127.0.0.1:8000 if API runs on another port. */
const BEAT_API = (import.meta.env.VITE_BEAT_API_URL ?? '').replace(/\/$/, '')

/** Host-only URLs get `/api` appended; `/api` and `https://x.com/api` stay as-is. */
function normalizeApiRoot(raw) {
  const r = (raw || '/api').trim().replace(/\/$/, '')
  if (r === '/api' || r.endsWith('/api')) return r
  return `${r}/api`
}

function decodeWaveformBase64(b64) {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Float32Array(bytes.buffer, 0, bytes.byteLength / 4)
}

export default function BeatLab({ apiBase: apiBaseProp }) {
  const apiRoot = normalizeApiRoot(apiBaseProp || BEAT_API || '/api')
  const containerRef = useRef(null)
  const wsRef = useRef(null)
  const regionsRef = useRef(null)
  const objectUrlRef = useRef(null)

  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [bpm, setBpm] = useState(null)
  const [beats, setBeats] = useState([])
  const [duration, setDuration] = useState(0)
  const [syncMsg, setSyncMsg] = useState('')
  const [lyrics, setLyrics] = useState('[Verse]\nLine synced to grid…')
  const [beatFile, setBeatFile] = useState(null)
  const [murekaStyle, setMurekaStyle] = useState('pop')
  const [murekaStatus, setMurekaStatus] = useState('')
  const [masteredUrl, setMasteredUrl] = useState('')

  const teardownWave = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
    if (wsRef.current) {
      try {
        wsRef.current.destroy()
      } catch {
        /* ignore */
      }
      wsRef.current = null
      regionsRef.current = null
    }
  }, [])

  useEffect(() => () => teardownWave(), [teardownWave])

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    setErr('')
    setBpm(null)
    setBeats([])
    setDuration(0)
    setSyncMsg('')
    setMurekaStatus('')
    setMasteredUrl('')
    setBeatFile(file)
    teardownWave()

    try {
      const fd = new FormData()
      fd.append('file', file)
      const r = await fetch(`${apiRoot}/analyze-beats`, { method: 'POST', body: fd })
      const data = await parseFetchJson(r)

      setBpm(data.bpm)
      setBeats(Array.isArray(data.beats) ? data.beats : [])
      setDuration(Number(data.duration) || 0)

      const peaks = decodeWaveformBase64(data.waveform)
      const peakArr = Array.from(peaks)
      const beatList = Array.isArray(data.beats) ? data.beats : []
      const durHint = Number(data.duration) || 0

      const url = URL.createObjectURL(file)
      objectUrlRef.current = url

      const regions = Regions.create()
      regionsRef.current = regions

      const el = containerRef.current
      if (!el) throw new Error('Waveform container missing')

      const ws = WaveSurfer.create({
        container: el,
        height: 128,
        url,
        peaks: [peakArr],
        duration: durHint,
        waveColor: 'rgba(168, 85, 247, 0.45)',
        progressColor: 'rgba(76, 29, 149, 0.85)',
        cursorColor: '#fbbf24',
        plugins: [regions],
        normalize: true,
      })
      wsRef.current = ws

      ws.on('ready', () => {
        const dur = durHint || ws.getDuration() || 0
        beatList.forEach((t, i) => {
          const start = Math.max(0, t)
          const end = Math.min(start + 0.06, dur > start ? dur : start + 0.06)
          regions.addRegion({
            id: `beat-${i}`,
            start,
            end,
            color: 'rgba(250, 204, 21, 0.28)',
            drag: false,
            resize: false,
          })
        })
      })
      void postStudioGrowth(apiRoot, 'beat_analyzed', file.name || 'beat')
    } catch (err0) {
      setErr(String(err0.message || err0))
    } finally {
      setBusy(false)
    }
  }

  const syncWithMureka = async () => {
    if (!beatFile) {
      setMurekaStatus('Upload a beat file first (same file you analyzed).')
      return
    }
    if (!lyrics.trim()) {
      setMurekaStatus('Add lyrics for Mureka.')
      return
    }
    setBusy(true)
    setMurekaStatus('Sending to Mureka + mixing with your beat…')
    setMasteredUrl('')
    try {
      const fd = new FormData()
      fd.append('beat', beatFile)
      fd.append('lyrics', lyrics)
      fd.append('mureka_style', murekaStyle)
      const r = await fetch(`${apiRoot}/pure-song-mureka`, { method: 'POST', body: fd })
      const text = await r.text()
      if (!r.ok) throw new Error(text || r.statusText)
      const result = JSON.parse(text)
      const path = result.song || result.song_url
      if (!path) throw new Error('No song path in response')
      const full = absoluteFromApiPath(apiRoot, path)
      setMasteredUrl(full)
      setMurekaStatus(
        `Done — ${result.bpm ?? '?'} BPM · Mureka (${murekaStyle}). Play below.`,
      )
    } catch (e) {
      setMurekaStatus(String(e.message || e))
    } finally {
      setBusy(false)
    }
  }

  const syncVocals = async () => {
    if (!bpm || !beats.length) {
      setSyncMsg('Analyze a beat first.')
      return
    }
    setBusy(true)
    setSyncMsg('')
    try {
      const r = await fetch(`${apiRoot}/sync-vocals-stub`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bpm, beats, lyrics }),
      })
      const j = await parseFetchJson(r)
      setSyncMsg(j.message || JSON.stringify(j))
    } catch (e) {
      setSyncMsg(String(e.message || e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="beat-lab">
      <h2 className="beat-lab-title">Beat lab</h2>
      <p className="field-hint">
        API root: <code>{apiRoot}</code> — dev: Vite proxies <code>/api</code> → FastAPI (e.g. <code>8787</code>). Optional{' '}
        <code>VITE_BEAT_API_URL</code> for a different host (host-only URLs get <code>/api</code> appended).
      </p>

      <label htmlFor="beat-lab-file">Upload beat / loop</label>
      <input id="beat-lab-file" type="file" accept="audio/*" disabled={busy} onChange={onFile} />

      {bpm != null && (
        <p className="ok beat-lab-bpm">
          <strong>{bpm} BPM</strong>
          {duration > 0 && ` · ${duration.toFixed(2)}s · ${beats.length} beats`}
        </p>
      )}

      <div ref={containerRef} className="beat-lab-wave" />

      <label htmlFor="beat-lab-lyrics">Lyrics (stub + Mureka)</label>
      <textarea
        id="beat-lab-lyrics"
        rows={4}
        value={lyrics}
        onChange={(e) => setLyrics(e.target.value)}
        className="beat-lab-textarea"
      />

      <label htmlFor="mureka-style">Mureka style (prompt preset)</label>
      <select
        id="mureka-style"
        className="beat-lab-select"
        value={murekaStyle}
        disabled={busy}
        onChange={(e) => setMurekaStyle(e.target.value)}
      >
        <option value="rap">rap</option>
        <option value="pop">pop</option>
        <option value="edm">edm</option>
        <option value="rnb">r&amp;b</option>
      </select>

      <button type="button" className="primary wide" disabled={busy || beats.length === 0} onClick={syncVocals}>
        Sync Vocals to Beat (stub)
      </button>

      <button
        type="button"
        className="primary wide mureka-btn"
        disabled={busy || !beatFile}
        onClick={syncWithMureka}
        title="Server needs MUREKA_API_KEY — never put the key in the browser"
      >
        Mureka AI + pro mix (beat)
      </button>

      {masteredUrl && (
        <div className="beat-lab-master">
          <audio controls src={masteredUrl} style={{ width: '100%', marginTop: 8 }} />
        </div>
      )}

      {syncMsg && <p className="hint beat-lab-sync">{syncMsg}</p>}
      {murekaStatus && <p className="hint beat-lab-sync">{murekaStatus}</p>}
      {err && <p className="bad">{err}</p>}

      <BeatLabPro apiBase={apiRoot} />
    </div>
  )
}
