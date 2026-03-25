import { useCallback, useEffect, useRef, useState } from 'react'
import { trpc } from './trpc.js'
import { buildLandingMurekaPrompt, extractAudioUrl } from './murekaHelpers.js'
import { fetchStudioGrowth, parseFetchJson, postStudioGrowth } from './apiResolve.js'
import { dieterUseTrpc, audioCrossOriginForSrc } from './dieterClientConfig.js'
import { useBeatVisualizer } from './useBeatVisualizer.js'
import { isTransientMurekaError, sleep, withMurekaRetries } from './murekaResilience.js'
import './MurekaPromptStudio.css'
import { STUDIO_NAME } from './studioBrand.js'

const USE_TRPC = dieterUseTrpc()

/**
 * Create tab: ordered gateway — Connections → prompt/controls → Mureka (cloud AI).
 * Audio is produced by Mureka via {STUDIO_NAME} FastAPI proxy, not in-browser synthesis.
 */
export default function MurekaPromptStudio({ apiBase, apiKey, onOpenKeys, onStudioPulse, onGoLocalWithLyrics }) {
  const [userPrompt, setUserPrompt] = useState('')
  const [genre, setGenre] = useState('all')
  const [mood, setMood] = useState('happy')
  const [tempo, setTempo] = useState('120')
  const [vocal, setVocal] = useState('female')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [err, setErr] = useState('')
  const [audioUrl, setAudioUrl] = useState('')
  const [apiHealth, setApiHealth] = useState(null)

  const audioRef = useRef(null)
  const canvasRef = useRef(null)
  useBeatVisualizer(audioRef, canvasRef, audioUrl)

  useEffect(() => {
    let cancelled = false
    setApiHealth(null)
    ;(async () => {
      try {
        const r = await fetch(`${apiBase}/health`, { method: 'GET' })
        if (!cancelled) setApiHealth(r.ok)
      } catch {
        if (!cancelled) setApiHealth(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [apiBase])

  const generate = useCallback(async () => {
    setErr('')
    setStatus('')
    if (!apiKey?.trim()) {
      setErr('Add your Mureka API key: click Connections (step 1), then Save.')
      onOpenKeys?.()
      return
    }
    const text = userPrompt.trim()
    if (!text) {
      setErr('Enter a creative prompt (step 2) — style direction or lyrics.')
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
    setStatus(USE_TRPC ? 'Gateway: starting Mureka (tRPC)…' : 'Gateway: starting Mureka (REST)…')
    try {
      let j
      if (USE_TRPC) {
        j = await withMurekaRetries(
          () =>
            trpc.murekaSongGenerate.mutate({
              lyrics: lyricPayload,
              model: 'auto',
              prompt,
              murekaApiKey: key,
            }),
          { attempts: 4, baseMs: 800 },
        )
      } else {
        j = await withMurekaRetries(async () => {
          const r = await fetch(`${apiBase}/mureka/song/generate`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${key}`,
            },
            body: JSON.stringify({ lyrics: lyricPayload, model: 'auto', prompt }),
          })
          return parseFetchJson(r)
        }, { attempts: 4, baseMs: 800 })
      }
      const taskId = String(j.id || j.task_id || j.taskId || '')
      if (!taskId) throw new Error('No task id: ' + JSON.stringify(j))

      let transientPollFails = 0
      const maxTransientPoll = 18
      for (let i = 0; i < 90; i++) {
        setStatus(`Gateway: rendering… ${i + 1}/90${USE_TRPC ? ' · tRPC' : ''}`)
        let qj
        try {
          if (USE_TRPC) {
            qj = await trpc.murekaSongQuery.query({
              taskId,
              murekaApiKey: key,
            })
          } else {
            const q = await fetch(`${apiBase}/mureka/song/query/${encodeURIComponent(taskId)}`, {
              headers: { Authorization: `Bearer ${key}` },
            })
            qj = await parseFetchJson(q)
          }
          transientPollFails = 0
        } catch (pollErr) {
          const msg = String(pollErr?.message || pollErr)
          if (isTransientMurekaError(msg) && transientPollFails < maxTransientPoll) {
            transientPollFails += 1
            setStatus(
              `Gateway sync — retry ${transientPollFails}/${maxTransientPoll} (task ${taskId.slice(0, 8)}…)`,
            )
            await sleep(3200 + transientPollFails * 400)
            i -= 1
            continue
          }
          throw pollErr
        }
        const url = extractAudioUrl(qj)
        if (url) {
          setAudioUrl(url)
          void postStudioGrowth(apiBase, 'mureka_song_ready', taskId)
          const g = await fetchStudioGrowth(apiBase)
          if (g && onStudioPulse) onStudioPulse(g)
          setStatus('Ready — Play streams from Mureka through your gateway.')
          return
        }
        const st = (qj.status || qj.state || '').toString().toLowerCase()
        if (st.includes('fail') || st.includes('error')) throw new Error(JSON.stringify(qj.error || qj))
        await sleep(2000)
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
        <div className="mps-logo">{STUDIO_NAME}</div>
        <p className="mps-tagline">
          <strong>AI music gateway</strong> — this app routes your prompts to <strong>Mureka</strong> through the{' '}
          {STUDIO_NAME} API (<code>/api/mureka/*</code>): one portal for authentication, retries, and same-origin speed
          when you deploy the full stack. Tracks and vocals are generated by Mureka’s models, not by toy synthesizers in
          the browser.
        </p>
        <div className="mps-api-pill" title="FastAPI gateway base">
          Gateway {USE_TRPC ? '· tRPC + ' : '· REST '}
          {apiBase}
        </div>

        {apiHealth === false && (
          <p className="mps-status mps-banner mps-banner--warn" role="status">
            API unreachable — set <strong>VITE_API_BASE</strong> (split UI) or deploy the <strong>single Docker</strong> URL
            so the UI and <code>/api</code> share one host. Without the gateway, Mureka cannot run from this page.
          </p>
        )}

        <ol className="mps-flow-steps" aria-label="Create workflow">
          <li>
            <strong>1 · Connections</strong> — Mureka key + API base (server can hold <code>MUREKA_API_KEY</code>).
          </li>
          <li>
            <strong>2 · Prompt &amp; controls</strong> — describe the track; genre, mood, tempo, vocals shape the request.
          </li>
          <li>
            <strong>3 · Generate</strong> — cloud AI renders audio; playback uses the returned streaming URL.
          </li>
        </ol>

        <div className="mps-card mps-card--primary">
          <div className="mps-keys-row">
            <button type="button" className="mps-keys-btn" onClick={() => onOpenKeys?.()}>
              1 — Connections · keys &amp; API base
            </button>
            {apiKey?.trim() ? (
              <span className="mps-status" style={{ marginTop: 0 }}>
                Mureka key connected
              </span>
            ) : (
              <span className="mps-status mps-muted" style={{ marginTop: 0 }}>
                Mureka key required for cloud generation
              </span>
            )}
          </div>

          <label className="mps-field-label" htmlFor="mps-prompt">
            2 — Prompt
          </label>
          <input
            id="mps-prompt"
            className="mps-input"
            value={userPrompt}
            onChange={(e) => setUserPrompt(e.target.value)}
            placeholder="e.g. upbeat electronic, synth leads, Daft Punk energy, 128 BPM — or paste lyrics"
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
            {busy ? '3 — Working…' : '3 — Generate with Mureka (cloud AI)'}
          </button>

          {status && <p className="mps-status">{status}</p>}
          {err && <p className="mps-status mps-status--err">{err}</p>}

          {audioUrl && (
            <div className="mps-player">
              <audio
                key={audioUrl}
                ref={audioRef}
                controls
                src={audioUrl}
                crossOrigin={audioCrossOriginForSrc(audioUrl)}
              />
              <canvas ref={canvasRef} className="mps-viz" width={800} height={160} />
            </div>
          )}
        </div>

        <div className="mps-card mps-card--local-bridge">
          <h3 className="mps-local-bridge-title">Optional · Local pipeline (same gateway)</h3>
          <p className="mps-local-bridge-hint">
            Beat + vocal mix runs on <strong>your FastAPI host</strong> (Librosa, FFmpeg, pipeline modules) — not a
            browser demo. Paste lyrics in the prompt above, then open <strong>Local</strong> and use{' '}
            <strong>Make Song</strong> with a beat file.
          </p>
          <button
            type="button"
            className="mps-local-bridge-btn"
            disabled={busy}
            onClick={() => {
              const t = userPrompt.trim()
              if (!t) {
                setErr('Enter prompt or lyrics first (step 2).')
                return
              }
              setErr('')
              onGoLocalWithLyrics?.(t)
            }}
          >
            Continue to Local lab with this text
          </button>
        </div>
      </div>

      <section className="mps-features">
        <div className="mps-fcard">
          <div className="mps-ficon">GATE</div>
          <h3>Single portal</h3>
          <p>
            Browser → <code>/api</code> → Mureka and optional OpenAI for lyrics. Keys and quotas stay behind the server
            when you configure env vars — see gateway docs in the repo.
          </p>
        </div>
        <div className="mps-fcard">
          <div className="mps-ficon">SYNC</div>
          <h3>Resilient calls</h3>
          <p>
            Automatic retries on rate limits and transient upstream errors; polling stays in sync until the render URL is
            ready.
          </p>
        </div>
        <div className="mps-fcard">
          <div className="mps-ficon">PLUG</div>
          <h3>Extensions</h3>
          <p>
            Beat lab, voice path, and storage plug into the same FastAPI surface so you can add engines and learning
            modules server-side without changing Mureka’s contracts.
          </p>
        </div>
      </section>
    </div>
  )
}
