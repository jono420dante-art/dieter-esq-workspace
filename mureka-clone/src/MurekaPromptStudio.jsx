import { useCallback, useRef, useState } from 'react'
import { trpc } from './trpc.js'
import { buildLandingMurekaPrompt, extractAudioUrl } from './murekaHelpers.js'
import { fetchStudioGrowth, postStudioGrowth } from './apiResolve.js'
import { useBeatVisualizer } from './useBeatVisualizer.js'
import './MurekaPromptStudio.css'

const USE_TRPC = import.meta.env.VITE_USE_TRPC !== 'false'

/**
 * Mureka-style hero: one prompt + controls → same Dieter pipeline as Cloud tab (tRPC or REST).
 */
export default function MurekaPromptStudio({ apiBase, apiKey, onOpenKeys, onStudioPulse }) {
  const [userPrompt, setUserPrompt] = useState('')
  const [genre, setGenre] = useState('all')
  const [mood, setMood] = useState('happy')
  const [tempo, setTempo] = useState('120')
  const [vocal, setVocal] = useState('female')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [err, setErr] = useState('')
  const [audioUrl, setAudioUrl] = useState('')

  const audioRef = useRef(null)
  const canvasRef = useRef(null)
  useBeatVisualizer(audioRef, canvasRef, audioUrl)

  const generate = useCallback(async () => {
    setErr('')
    setStatus('')
    if (!apiKey?.trim()) {
      onOpenKeys?.()
      setErr('Add your Mureka API key (Connections).')
      return
    }
    const text = userPrompt.trim()
    if (!text) {
      setErr('Describe your track in the prompt field.')
      return
    }

    const instrumental = vocal === 'none'
    const prompt = buildLandingMurekaPrompt({
      genre,
      mood,
      tempoBpm: tempo,
      vocal,
      userPrompt: text,
    })
    const lyricPayload = instrumental ? '' : text
    const key = apiKey.trim()

    setBusy(true)
    setAudioUrl('')
    setStatus(USE_TRPC ? 'Starting Mureka (via tRPC)…' : 'Starting Mureka (REST)…')
    try {
      let j
      if (USE_TRPC) {
        j = await trpc.murekaSongGenerate.mutate({
          lyrics: lyricPayload,
          model: 'auto',
          prompt,
          murekaApiKey: key,
        })
      } else {
        const r = await fetch(`${apiBase}/mureka/song/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${key}`,
          },
          body: JSON.stringify({ lyrics: lyricPayload, model: 'auto', prompt }),
        })
        if (!r.ok) throw new Error(await r.text())
        j = await r.json()
      }
      const taskId = String(j.id || j.task_id || j.taskId || '')
      if (!taskId) throw new Error('No task id: ' + JSON.stringify(j))

      for (let i = 0; i < 90; i++) {
        setStatus(`Rendering… ${i + 1}/90${USE_TRPC ? ' · tRPC' : ''}`)
        let qj
        if (USE_TRPC) {
          qj = await trpc.murekaSongQuery.query({
            taskId,
            murekaApiKey: key,
          })
        } else {
          const q = await fetch(`${apiBase}/mureka/song/query/${encodeURIComponent(taskId)}`, {
            headers: { Authorization: `Bearer ${key}` },
          })
          if (!q.ok) throw new Error(await q.text())
          qj = await q.json()
        }
        const url = extractAudioUrl(qj)
        if (url) {
          setAudioUrl(url)
          void postStudioGrowth(apiBase, 'mureka_song_ready', taskId)
          const g = await fetchStudioGrowth(apiBase)
          if (g && onStudioPulse) onStudioPulse(g)
          setStatus('Ready — press play.')
          return
        }
        const st = (qj.status || qj.state || '').toString().toLowerCase()
        if (st.includes('fail') || st.includes('error')) throw new Error(JSON.stringify(qj.error || qj))
        await new Promise((res) => setTimeout(res, 2000))
      }
      throw new Error('Timeout waiting for Mureka')
    } catch (e) {
      setErr(String(e?.message || e))
      setStatus('')
    } finally {
      setBusy(false)
    }
  }, [apiBase, apiKey, genre, mood, onOpenKeys, onStudioPulse, tempo, userPrompt, vocal])

  return (
    <div className="mps-page">
      <div className="mps-noise" aria-hidden />
      <div className="mps-hero">
        <div className="mps-logo">Dieter Esq.</div>
        <p className="mps-tagline">
          Create unique melodies from one prompt. Studio-quality AI music in seconds — royalty-aware workflow through
          your Dieter proxy.
        </p>
        <div className="mps-api-pill" title="REST base; tRPC uses /trpc when enabled">
          API {USE_TRPC ? '· tRPC + ' : '· '}
          {apiBase}
        </div>

        <div className="mps-card">
          <div className="mps-keys-row">
            <button type="button" className="mps-keys-btn" onClick={() => onOpenKeys?.()}>
              Connections · Mureka key
            </button>
            {apiKey?.trim() ? (
              <span className="mps-status" style={{ marginTop: 0 }}>
                Key on file
              </span>
            ) : (
              <span className="mps-status mps-status--err" style={{ marginTop: 0 }}>
                Key required
              </span>
            )}
          </div>

          <label className="mps-field-label" htmlFor="mps-prompt">
            Prompt
          </label>
          <input
            id="mps-prompt"
            className="mps-input"
            value={userPrompt}
            onChange={(e) => setUserPrompt(e.target.value)}
            placeholder="e.g. upbeat electronic, synth leads, Daft Punk energy, 128 BPM"
            maxLength={500}
            disabled={busy}
          />

          <div className="mps-grid">
            <select className="mps-select" value={genre} onChange={(e) => setGenre(e.target.value)} disabled={busy}>
              <option value="all">Genre · All</option>
              <option value="pop">Pop</option>
              <option value="electronic">Electronic</option>
              <option value="hip-hop">Hip-hop</option>
              <option value="jazz">Jazz</option>
              <option value="rock">Rock</option>
            </select>
            <select className="mps-select" value={mood} onChange={(e) => setMood(e.target.value)} disabled={busy}>
              <option value="happy">Mood · Happy</option>
              <option value="relaxed">Relaxed</option>
              <option value="energetic">Energetic</option>
              <option value="sad">Sad</option>
              <option value="inspired">Inspired</option>
            </select>
            <select className="mps-select" value={tempo} onChange={(e) => setTempo(e.target.value)} disabled={busy}>
              <option value="120">Tempo · 120 BPM</option>
              <option value="90">90 BPM</option>
              <option value="140">140 BPM</option>
              <option value="80">80 BPM</option>
            </select>
            <select className="mps-select" value={vocal} onChange={(e) => setVocal(e.target.value)} disabled={busy}>
              <option value="female">Vocals · Female</option>
              <option value="male">Male</option>
              <option value="none">Instrumental</option>
            </select>
          </div>

          <button type="button" className="mps-gen" disabled={busy} onClick={generate}>
            {busy ? 'Working…' : 'Generate music'}
          </button>

          {status && <p className="mps-status">{status}</p>}
          {err && <p className="mps-status mps-status--err">{err}</p>}

          {audioUrl && (
            <div className="mps-player">
              <audio key={audioUrl} ref={audioRef} controls src={audioUrl} crossOrigin="anonymous" />
              <canvas ref={canvasRef} className="mps-viz" width={800} height={160} />
            </div>
          )}
        </div>
      </div>

      <section className="mps-features">
        <div className="mps-fcard">
          <div className="mps-ficon">SONG</div>
          <h3>Full tracks</h3>
          <p>Mureka generates arrangement and vocals (unless instrumental) — routed through Dieter so your key never hits a random domain.</p>
        </div>
        <div className="mps-fcard">
          <div className="mps-ficon">BEAT</div>
          <h3>Then refine</h3>
          <p>Switch to Beat lab or Local for stems, FFmpeg tools, and the release pipeline on the same API.</p>
        </div>
        <div className="mps-fcard">
          <div className="mps-ficon">VOX</div>
          <h3>Voice lab</h3>
          <p>Use Voice studio for reference registration and clone-path experiments alongside cloud creation.</p>
        </div>
      </section>
    </div>
  )
}
