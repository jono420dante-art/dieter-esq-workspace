import { useCallback, useEffect, useRef, useState } from 'react'
import { absoluteFromApiPath, normalizeApiRoot, storageUrlFromKey } from './apiResolve.js'
import { audioCrossOriginForSrc } from './dieterClientConfig.js'
import { STUDIO_NAME } from './studioBrand.js'

/** Voice presets for local procedural layer (swap for RVC profile later). */
const VOICE_CHOICES = [
  { id: 'man2', label: 'Man 2', preset: 'Man-2' },
  { id: 'man1', label: 'Man 1', preset: 'Man-1' },
  { id: 'woman1', label: 'Woman 1', preset: 'Woman-1' },
  { id: 'woman2', label: 'Woman 2', preset: 'Woman-2' },
  { id: 'radio', label: 'Radio (neutral)', preset: 'Radio' },
]

/** FastAPI `{ detail: string | validation[] }` or plain text body */
async function parseApiError(res) {
  const t = await res.text()
  try {
    const j = JSON.parse(t)
    if (j.detail != null) {
      if (typeof j.detail === 'string') return j.detail
      if (Array.isArray(j.detail))
        return j.detail.map((x) => x.msg || JSON.stringify(x)).join('; ')
      return String(j.detail)
    }
  } catch {
    /* not JSON */
  }
  return t || res.statusText || `HTTP ${res.status}`
}

/** Beat detect (Librosa), FFmpeg mix, optional procedural vocal layer. For cloud AI vocals use Create / Cloud / Voice + Mureka; label training data with POST /api/vocal/analyze. */
export default function LocalStudio({ apiBase }) {
  const base = normalizeApiRoot(apiBase || '/api')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [pitchWarning, setPitchWarning] = useState('')
  const [beatResult, setBeatResult] = useState(null)
  const [beatKey, setBeatKey] = useState('')
  const [vocalKey, setVocalKey] = useState('')
  const [mixUrl, setMixUrl] = useState('')
  const [caps, setCaps] = useState(null)
  const [vocalStatus, setVocalStatus] = useState(null)

  const [lyrics, setLyrics] = useState('')
  const [pitchSemitones, setPitchSemitones] = useState(0)
  const [voiceId, setVoiceId] = useState('man2')
  const [vocalPreset, setVocalPreset] = useState('Man-2')
  const [lastBeatFile, setLastBeatFile] = useState(null)
  const [playUrl, setPlayUrl] = useState('')
  const dropRef = useRef(null)
  const [proceduralBpm, setProceduralBpm] = useState(120)
  const [durationSec, setDurationSec] = useState(45)
  const [proceduralUrl, setProceduralUrl] = useState('')
  const [alignFrom, setAlignFrom] = useState('')
  const [alignTo, setAlignTo] = useState('')

  /** `null` until first check; then `ok` or `fail` */
  const [apiHealth, setApiHealth] = useState(null)

  const pingHealth = useCallback(async () => {
    try {
      const r = await fetch(`${base}/health`, { cache: 'no-store' })
      setApiHealth(r.ok ? 'ok' : 'fail')
    } catch {
      setApiHealth('fail')
    }
  }, [base])

  const loadCaps = useCallback(async () => {
    try {
      const r = await fetch(`${base}/local/capabilities`)
      if (r.ok) setCaps(await r.json())
    } catch {
      /* ignore */
    }
  }, [base])

  const loadVocalStatus = useCallback(async () => {
    try {
      const r = await fetch(`${base}/local/vocal/status`)
      if (r.ok) setVocalStatus(await r.json())
    } catch {
      /* ignore */
    }
  }, [base])

  useEffect(() => {
    loadCaps()
    loadVocalStatus()
  }, [loadCaps, loadVocalStatus])

  useEffect(() => {
    void pingHealth()
  }, [pingHealth])

  /** Seed lyrics when user clicks "Open Local lab with my lyrics" from the Create tab. */
  useEffect(() => {
    try {
      const seed = sessionStorage.getItem('dieter_local_lyrics_seed')
      if (seed != null && seed !== '') {
        sessionStorage.removeItem('dieter_local_lyrics_seed')
        setLyrics((prev) => (prev.trim() ? prev : seed))
      }
    } catch {
      /* ignore */
    }
  }, [])

  /** @param {{ silentBusy?: boolean }} o — silentBusy: don't toggle global busy (used inside Make Song) */
  const runBeatDetect = async (file, o = {}) => {
    if (!file) return null
    const silent = o.silentBusy
    if (!silent) {
      setBusy(true)
      setErr('')
      setBeatResult(null)
    }
    try {
      const fd = new FormData()
      fd.append('file', file)
      const r = await fetch(`${base}/local/beat-detect`, { method: 'POST', body: fd })
      if (!r.ok) throw new Error(await parseApiError(r))
      const j = await r.json()
      setBeatResult(j)
      if (j.tempo_bpm) setProceduralBpm(Math.round(j.tempo_bpm))
      if (j.duration_seconds) setDurationSec(Math.min(240, Math.max(5, Math.ceil(j.duration_seconds))))
      setAlignTo(String(j.tempo_bpm ?? ''))
      return j
    } catch (e) {
      if (!silent) setErr(String(e.message || e))
      throw e
    } finally {
      if (!silent) setBusy(false)
    }
  }

  const analyzeBeatFile = async (file) => {
    try {
      await runBeatDetect(file, { silentBusy: false })
    } catch {
      /* err set in runBeatDetect */
    }
  }

  const onPickVoice = (id) => {
    setVoiceId(id)
    const v = VOICE_CHOICES.find((x) => x.id === id)
    if (v) setVocalPreset(v.preset)
  }

  const onBeatInput = (file) => {
    if (!file) return
    setLastBeatFile(file)
    analyzeBeatFile(file)
  }

  const onDropBeat = (e) => {
    e.preventDefault()
    e.stopPropagation()
    const f = e.dataTransfer?.files?.[0]
    if (f && (f.type.startsWith('audio/') || /\.(mp3|wav|flac|ogg|m4a)$/i.test(f.name)))
      onBeatInput(f)
    else setErr('Drop an audio file (e.g. MP3).')
  }

  /** One-click: detect beat → upload beat stem → procedural vocal → merge → play + download */
  const makeSong = async () => {
    if (!lastBeatFile) {
      setErr('Drag an MP3 (or any audio) beat onto the drop zone first.')
      return
    }
    if (!lyrics.trim()) {
      setErr('Type a line of lyrics first.')
      return
    }
    setBusy(true)
    setErr('')
    setPitchWarning('')
    setMixUrl('')
    setPlayUrl('')
    setProceduralUrl('')
    try {
      const bj = await runBeatDetect(lastBeatFile, { silentBusy: true })
      const bpm = bj?.tempo_bpm != null ? Math.round(bj.tempo_bpm) : proceduralBpm
      const dur =
        bj?.duration_seconds != null
          ? Math.min(240, Math.max(5, Math.ceil(bj.duration_seconds)))
          : durationSec

      const fdBeat = new FormData()
      fdBeat.append('file', lastBeatFile)
      const upR = await fetch(`${base}/upload`, { method: 'POST', body: fdBeat })
      if (!upR.ok) throw new Error(await parseApiError(upR))
      const beatUp = await upR.json()
      setBeatKey(beatUp.key)

      // Multipart → `/local/procedural-vocal-layer-form` (JSON body is only for `/procedural-vocal-layer`)
      const fdVocal = new FormData()
      fdVocal.append('voice_id', voiceId)
      fdVocal.append('pitchSemitones', String(pitchSemitones))
      fdVocal.append('lyrics', lyrics.trim())
      fdVocal.append('beat_bpm', String(bpm))
      fdVocal.append('vocal_duration_sec', String(dur))
      const rV = await fetch(`${base}/local/procedural-vocal-layer-form`, {
        method: 'POST',
        body: fdVocal,
      })
      if (!rV.ok) throw new Error(await parseApiError(rV))
      const jV = await rV.json()
      {
        const parts = []
        if (jV.pitchEngine) parts.push(`Engine: ${jV.pitchEngine}`)
        if (jV.pitchWarning) parts.push(String(jV.pitchWarning))
        setPitchWarning(parts.join(' — '))
      }
      setProceduralUrl(absoluteFromApiPath(base, jV.url))
      setVocalKey(jV.key)

      const rM = await fetch(`${base}/local/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ beatKey: beatUp.key, vocalKey: jV.key }),
      })
      if (!rM.ok) throw new Error(await parseApiError(rM))
      const jM = await rM.json()
      const mix = absoluteFromApiPath(base, jM.url)
      setMixUrl(mix)
      setPlayUrl(mix)
    } catch (e) {
      setErr(String(e.message || e))
    } finally {
      setBusy(false)
    }
  }

  const uploadStem = async (file, which) => {
    if (!file) return
    setBusy(true)
    setErr('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const r = await fetch(`${base}/upload`, { method: 'POST', body: fd })
      if (!r.ok) throw new Error(await parseApiError(r))
      const j = await r.json()
      if (which === 'beat') setBeatKey(j.key)
      else setVocalKey(j.key)
    } catch (e) {
      setErr(String(e.message || e))
    } finally {
      setBusy(false)
    }
  }

  const merge = async () => {
    if (!beatKey || !vocalKey) {
      setErr('Upload both beat and vocal stems first (or generate procedural vocal).')
      return
    }
    setBusy(true)
    setErr('')
    setMixUrl('')
    try {
      const r = await fetch(`${base}/local/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ beatKey, vocalKey }),
      })
      if (!r.ok) throw new Error(await parseApiError(r))
      const j = await r.json()
      setMixUrl(absoluteFromApiPath(base, j.url))
    } catch (e) {
      setErr(String(e.message || e))
    } finally {
      setBusy(false)
    }
  }

  const generateProceduralVocal = async () => {
    if (!lyrics.trim()) {
      setErr('Type a line of lyrics first (same box as Make Song).')
      return
    }
    setBusy(true)
    setErr('')
    setPitchWarning('')
    setProceduralUrl('')
    try {
      const fd = new FormData()
      fd.append('voice_id', voiceId)
      fd.append('pitchSemitones', String(pitchSemitones))
      fd.append('lyrics', lyrics.trim())
      fd.append('beat_bpm', String(proceduralBpm))
      fd.append('vocal_duration_sec', String(durationSec))
      const r = await fetch(`${base}/local/procedural-vocal-layer-form`, {
        method: 'POST',
        body: fd,
      })
      if (!r.ok) throw new Error(await parseApiError(r))
      const j = await r.json()
      {
        const parts = []
        if (j.pitchEngine) parts.push(`Engine: ${j.pitchEngine}`)
        if (j.pitchWarning) parts.push(String(j.pitchWarning))
        setPitchWarning(parts.join(' — '))
      }
      setProceduralUrl(absoluteFromApiPath(base, j.url))
      setVocalKey(j.key)
    } catch (e) {
      setErr(String(e.message || e))
    } finally {
      setBusy(false)
    }
  }

  const tempoAlign = async () => {
    if (!vocalKey) {
      setErr('Need a vocal file key (upload or procedural).')
      return
    }
    const from = parseFloat(alignFrom)
    const to = parseFloat(alignTo)
    if (!from || !to || from <= 0 || to <= 0) {
      setErr('Set align From BPM and To BPM (e.g. from your render vs detected beat).')
      return
    }
    setBusy(true)
    setErr('')
    try {
      const r = await fetch(`${base}/local/tempo-align`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioKey: vocalKey, fromBpm: from, toBpm: to }),
      })
      if (!r.ok) throw new Error(await parseApiError(r))
      const j = await r.json()
      setVocalKey(j.key)
      setProceduralUrl(absoluteFromApiPath(base, j.url))
    } catch (e) {
      setErr(String(e.message || e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="local-studio">
      <h2 className="local-studio-title">{STUDIO_NAME} · Local lab</h2>
      <p className="local-mureka-hint" role="note">
        Want <strong>real AI vocals</strong>? Use the <strong>Create</strong> or <strong>Voice studio</strong> tab with{' '}
        <strong>Mureka</strong> (API key in Connections or <code>MUREKA_API_KEY</code> on the server).
      </p>
      {apiHealth === 'fail' && (
        <div className="local-api-banner local-api-banner--bad" role="status">
          <p className="local-api-banner-text">
            <strong>Cannot reach the {STUDIO_NAME} API.</strong> The UI talks to your machine through the Vite proxy (
            <code>/api</code> → port <strong>8787</strong> by default). Start the backend from{' '}
            <code>dieter-backend</code>:{' '}
            <code className="local-api-cmd">uvicorn app.main:app --reload --host 127.0.0.1 --port 8787</code>
            <br />
            If you use another port, set <code>API_PROXY_TARGET</code> when starting Vite, or open{' '}
            <strong>API keys</strong> and set <strong>API base (REST)</strong> to your full URL including{' '}
            <code>/api</code>.
          </p>
          <button type="button" className="btn-secondary btn-tiny" onClick={() => void pingHealth()}>
            Check again
          </button>
        </div>
      )}
      <ol className="quick-steps">
        <li>
          Pick a voice (e.g. <strong>Man 2</strong>)
        </li>
        <li>Type your line — e.g. “Drop the bass, feel the rhythm tonight”</li>
        <li>Drag any <strong>MP3</strong> beat onto the zone below</li>
        <li>
          <strong>Make Song</strong> → then <strong>Play</strong> + <strong>Download</strong>
        </li>
      </ol>
      <p className="field-hint">
        <strong>No cloud APIs.</strong> Beat analysis: <strong>librosa</strong> (+ <strong>madmom</strong> if installed).
        Mix / tempo: <strong>FFmpeg</strong>. Vocal placeholder: built-in <strong>procedural</strong> stem — swap for{' '}
        <strong>RVC + Tortoise</strong> on your GPU box (see <code>dieter-backend/LOCAL_PIPELINE.md</code>).
      </p>

      <div className="make-song-card">
        <label htmlFor="voice-pick">Voice</label>
        <select
          id="voice-pick"
          className="voice-select"
          value={voiceId}
          onChange={(e) => onPickVoice(e.target.value)}
          disabled={busy}
        >
          {VOICE_CHOICES.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>

        <label htmlFor="pitch-quick">Pitch (−12 deep → +12 bright)</label>
        <div className="pitch-quick-row">
          <input
            id="pitch-quick"
            type="range"
            min={-12}
            max={12}
            step={0.5}
            value={pitchSemitones}
            onChange={(e) => setPitchSemitones(Number(e.target.value))}
            disabled={busy}
            className="pitch-quick-slider"
          />
          <span className="pitch-quick-val">
            {pitchSemitones > 0 ? '+' : ''}
            {pitchSemitones} st
          </span>
        </div>

        <label htmlFor="local-lyrics-quick">Lyrics</label>
        <p className="field-hint local-lyrics-hint">
          One or more lines here feed the procedural vocal and <strong>Make Song</strong>. Start typing — nothing is
          sent until you click a button.
        </p>
        <textarea
          id="local-lyrics-quick"
          rows={4}
          value={lyrics}
          onChange={(e) => setLyrics(e.target.value)}
          disabled={busy}
          className="local-textarea"
          placeholder="e.g. Drop the bass, feel the rhythm tonight"
          spellCheck={true}
        />

        <div
          ref={dropRef}
          className={'beat-drop-zone' + (lastBeatFile ? ' has-file' : '')}
          onDragOver={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
          onDrop={onDropBeat}
        >
          <p className="drop-title">Drag MP3 beat here</p>
          <p className="drop-sub">or choose a file</p>
          <input
            type="file"
            accept="audio/*,.mp3,.wav"
            disabled={busy}
            onChange={(e) => onBeatInput(e.target.files?.[0])}
          />
          {lastBeatFile && (
            <p className="ok file-pill">
              {lastBeatFile.name}
              {beatResult?.tempo_bpm != null && (
                <span className="bpm-tag"> · {Math.round(beatResult.tempo_bpm)} BPM</span>
              )}
            </p>
          )}
        </div>

        <button type="button" className="primary make-song-btn" disabled={busy} onClick={makeSong}>
          {busy ? 'Working…' : 'Make song'}
        </button>

        {err && (
          <div className="local-error-banner" role="alert">
            <p className="local-error-text">{err}</p>
            <button
              type="button"
              className="btn-retry"
              disabled={busy}
              onClick={() => {
                setErr('')
                void makeSong()
              }}
            >
              Retry
            </button>
          </div>
        )}
        {pitchWarning && !err && <p className="local-pitch-warn">{pitchWarning}</p>}

        {playUrl && (
          <div className="play-download">
            <p className="mini-label">Result</p>
            <audio
              controls
              src={playUrl}
              className="mix-player"
              crossOrigin={audioCrossOriginForSrc(playUrl)}
            />
            <a className="btn-dl" href={playUrl} download="dieter-mix.mp3">
              ⬇ Download mix
            </a>
          </div>
        )}
      </div>
      <div className="row gap" style={{ flexWrap: 'wrap' }}>
        <button type="button" className="btn-secondary btn-tiny" onClick={loadCaps}>
          Check capabilities
        </button>
        <button type="button" className="btn-secondary btn-tiny" onClick={loadVocalStatus}>
          RVC / Tortoise status
        </button>
      </div>
      {caps && (
        <pre className="caps-pre">
          {JSON.stringify(
            {
              librosa: caps.librosa,
              ffmpeg: caps.ffmpeg,
              madmom: caps.madmom_installed,
            },
            null,
            2,
          )}
        </pre>
      )}
      {vocalStatus && (
        <pre className="caps-pre">
          {JSON.stringify(
            {
              rvc: vocalStatus.rvc?.mode,
              rvcUrlSet: vocalStatus.rvc?.baseUrlConfigured,
              tortoise: vocalStatus.tortoise?.repo,
            },
            null,
            2,
          )}
        </pre>
      )}

      <label htmlFor="beat-file">1 — Analyze beat only (optional if you used the drop zone above)</label>
      <input
        id="beat-file"
        type="file"
        accept="audio/*,.wav,.mp3"
        disabled={busy}
        onChange={(e) => onBeatInput(e.target.files?.[0])}
      />
      {beatResult && (
        <div className="beat-result">
          <p>
            <strong>{beatResult.tempo_bpm} BPM</strong> (librosa) · {beatResult.beat_count} beats ·{' '}
            {beatResult.duration_seconds}s
          </p>
          {beatResult.madmom?.tempo_bpm != null && (
            <p className="field-hint">
              Madmom tempo: <strong>{beatResult.madmom.tempo_bpm} BPM</strong> · {beatResult.madmom.beat_count} beats
            </p>
          )}
          <p className="field-hint">
            First beat times (s):{' '}
            {beatResult.beat_times_seconds?.slice(0, 12).map((t) => t.toFixed(3)).join(', ')}
            {(beatResult.beat_times_seconds?.length || 0) > 12 ? '…' : ''}
          </p>
        </div>
      )}

      <h3 className="local-sub">2 — Local vocal layer (procedural, offline)</h3>
      <p className="field-hint">
        Lyrics / voice are set in the <strong>Make Song</strong> card above. Below: tweak BPM, duration, or preset;
        or generate a vocal stem without using <strong>Make Song</strong>.
      </p>
      <div className="row gap" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
        <label>
          BPM{' '}
          <input
            type="number"
            min={40}
            max={240}
            value={proceduralBpm}
            onChange={(e) => setProceduralBpm(Number(e.target.value))}
            disabled={busy}
            className="local-num"
          />
        </label>
        <label>
          Duration (s){' '}
          <input
            type="number"
            min={5}
            max={240}
            value={durationSec}
            onChange={(e) => setDurationSec(Number(e.target.value))}
            disabled={busy}
            className="local-num"
          />
        </label>
        <label>
          Preset{' '}
          <input
            type="text"
            value={vocalPreset}
            onChange={(e) => setVocalPreset(e.target.value)}
            disabled={busy}
            className="local-preset"
            placeholder="Radio"
          />
        </label>
      </div>
      <button type="button" className="btn-secondary" disabled={busy} onClick={generateProceduralVocal}>
        {busy ? '…' : 'Generate procedural vocal (WAV)'}
      </button>
      {proceduralUrl && (
        <p className="ok">
          Vocal stem:{' '}
          <a href={proceduralUrl} download>
            download WAV
          </a>{' '}
          · key <code>{vocalKey}</code>
        </p>
      )}

      <h3 className="local-sub">3 — Tempo-align vocal (FFmpeg)</h3>
      <p className="field-hint">
        If your vocal render used a different BPM than the beat, stretch it here before mixing. &quot;To&quot; often
        matches detected beat BPM.
      </p>
      <div className="row gap" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
        <label>
          From BPM{' '}
          <input
            type="number"
            step="0.1"
            value={alignFrom}
            onChange={(e) => setAlignFrom(e.target.value)}
            placeholder="e.g. 100"
            className="local-num"
          />
        </label>
        <label>
          To BPM{' '}
          <input
            type="number"
            step="0.1"
            value={alignTo}
            onChange={(e) => setAlignTo(e.target.value)}
            placeholder="e.g. 120"
            className="local-num"
          />
        </label>
        <button type="button" className="btn-secondary" disabled={busy || !vocalKey} onClick={tempoAlign}>
          Align vocal
        </button>
      </div>

      <h3 className="local-sub">4 — Upload stems &amp; mix</h3>
      <p className="field-hint">
        Upload the beat file for mixing (can be the same one you analyzed). Vocal: your RVC/Tortoise bounce or the
        procedural WAV from step 2.
      </p>
      <div className="row gap">
        <div>
          <span className="mini-label">Beat</span>
          <input
            type="file"
            accept="audio/*"
            disabled={busy}
            onChange={(e) => uploadStem(e.target.files?.[0], 'beat')}
          />
          {beatKey && (
            <div>
              <code className="key-hint">{beatKey}</code>{' '}
              <a href={storageUrlFromKey(base, beatKey)} download>
                download
              </a>
            </div>
          )}
        </div>
        <div>
          <span className="mini-label">Vocal</span>
          <input
            type="file"
            accept="audio/*"
            disabled={busy}
            onChange={(e) => uploadStem(e.target.files?.[0], 'vocal')}
          />
          {vocalKey && (
            <div>
              <code className="key-hint">{vocalKey}</code>{' '}
              <a href={storageUrlFromKey(base, vocalKey)} download>
                download
              </a>
            </div>
          )}
        </div>
      </div>
      <button type="button" className="primary" disabled={busy || !beatKey || !vocalKey} onClick={merge}>
        {busy ? '…' : 'Merge beat + vocal (FFmpeg → MP3)'}
      </button>
      {mixUrl && (
        <p className="ok">
          Mix:{' '}
          <a href={mixUrl} download>
            download MP3
          </a>
        </p>
      )}
      {err && <p className="bad">{err}</p>}
    </section>
  )
}
