import { useCallback, useEffect, useRef, useState } from 'react'
import { trpc } from './trpc.js'
import { buildLandingMurekaPrompt, extractAudioUrl } from './murekaHelpers.js'
import { fetchStudioGrowth, parseFetchJson, postStudioGrowth } from './apiResolve.js'
import { dieterUseTrpc, audioCrossOriginForSrc } from './dieterClientConfig.js'
import { BUILT_IN_PRESETS } from './offlinePresets.js'
import { useBeatVisualizer } from './useBeatVisualizer.js'
import { isTransientMurekaError, sleep, withMurekaRetries } from './murekaResilience.js'
import './MurekaPromptStudio.css'
import { STUDIO_NAME } from './studioBrand.js'

const USE_TRPC = dieterUseTrpc()

/**
 * Mureka-style hero: one prompt + controls → same pipeline as Cloud tab (tRPC or REST).
 */
export default function MurekaPromptStudio({ apiBase, apiKey, onOpenKeys, onStudioPulse, onGoLocalWithLyrics }) {
  const [userPrompt, setUserPrompt] = useState('')
  const [genre, setGenre] = useState('all')
  const [mood, setMood] = useState('happy')
  const [tempo, setTempo] = useState('120')
  const [vocal, setVocal] = useState('female')
  const [busy, setBusy] = useState(false)
  const [offlineBusy, setOfflineBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [err, setErr] = useState('')
  const [audioUrl, setAudioUrl] = useState('')
  const [apiHealth, setApiHealth] = useState(null)
  const blobUrlRef = useRef(null)

  const audioRef = useRef(null)
  const canvasRef = useRef(null)
  useBeatVisualizer(audioRef, canvasRef, audioUrl)

  const setPlayerUrl = useCallback((url) => {
    if (blobUrlRef.current && blobUrlRef.current.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(blobUrlRef.current)
      } catch {
        /* ignore */
      }
    }
    blobUrlRef.current = url && url.startsWith('blob:') ? url : null
    setAudioUrl(url)
  }, [])

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
      setErr(
        'Mureka cloud needs a key under Connections — or use “Open Local lab with my lyrics” above: your poem + a beat, no Mureka.',
      )
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
    setPlayerUrl('')
    setStatus(USE_TRPC ? 'Starting Mureka (via tRPC)…' : 'Starting Mureka (REST)…')
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
        setStatus(`Rendering… ${i + 1}/90${USE_TRPC ? ' · tRPC' : ''}`)
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
              `Mureka gateway busy / network — retry poll ${transientPollFails}/${maxTransientPoll} (task ${taskId.slice(0, 8)}…)`,
            )
            await sleep(3200 + transientPollFails * 400)
            i -= 1
            continue
          }
          throw pollErr
        }
        const url = extractAudioUrl(qj)
        if (url) {
          setPlayerUrl(url)
          void postStudioGrowth(apiBase, 'mureka_song_ready', taskId)
          const g = await fetchStudioGrowth(apiBase)
          if (g && onStudioPulse) onStudioPulse(g)
          setStatus('Ready — press play.')
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
  }, [apiBase, apiKey, genre, mood, onOpenKeys, onStudioPulse, setPlayerUrl, tempo, userPrompt, vocal])

  useEffect(() => {
    return () => {
      if (blobUrlRef.current?.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(blobUrlRef.current)
        } catch {
          /* ignore */
        }
      }
    }
  }, [])

  return (
    <div className="mps-page">
      <div className="mps-noise" aria-hidden />
      <div className="mps-hero">
        <div className="mps-logo">{STUDIO_NAME}</div>
        <p className="mps-tagline">
          <strong>Mureka cloud</strong> gives you real AI vocals and full tracks when you add a key in Connections. The{' '}
          <strong>Local</strong> tab is an offline beat + placeholder-vocal lab (no Mureka account on that path).
        </p>
        <div className="mps-api-pill" title="REST base; tRPC uses /trpc when enabled">
          API {USE_TRPC ? '· tRPC + ' : '· '}
          {apiBase}
        </div>

        {apiHealth === false && (
          <p className="mps-status mps-banner mps-banner--warn" role="status">
            API offline — connect your <strong>{STUDIO_NAME}</strong> API (<strong>VITE_API_BASE</strong> or same-origin
            Docker) for{' '}
            <strong>Mureka</strong> proxy and Voice studio. Until then, use <strong>Local</strong> only for offline
            previews.
          </p>
        )}

        <div className="mps-card mps-card--local-bridge">
          <h3 className="mps-local-bridge-title">Poems &amp; lyrics → song (no Mureka key)</h3>
          <p className="mps-local-bridge-hint">
            Paste your lines in the <strong>Prompt</strong> field below (or describe the vibe — your words still seed the
            Local mix). Then open the <strong>Local</strong> tab: drop a beat, press <strong>Make Song</strong> — vocal +
            mix run on your API host (<code>/api</code>), not Mureka.
          </p>
          <button
            type="button"
            className="mps-local-bridge-btn"
            disabled={busy || offlineBusy}
            onClick={() => {
              const t = userPrompt.trim()
              if (!t) {
                setErr('Paste your poem or lyrics into the Prompt field first.')
                return
              }
              setErr('')
              onGoLocalWithLyrics?.(t)
            }}
          >
            Open Local lab with my lyrics
          </button>
        </div>

        <div className="mps-card mps-card--offline">
          <h3 className="mps-offline-title">Built-in royalty-free music</h3>
          <p className="mps-offline-hint">
            Generated in your browser with Tone.js — no samples, no account. Use for previews, scratch ideas, and
            placeholders. Download WAV for your timeline; connect the API when you want full Mureka tracks.
          </p>
          <div className="mps-preset-row" role="group" aria-label="Quick presets">
            {BUILT_IN_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                className="mps-preset-chip"
                disabled={offlineBusy || busy}
                onClick={async () => {
                  setErr('')
                  setStatus('')
                  setOfflineBusy(true)
                  setPlayerUrl('')
                  try {
                    setStatus(`Rendering “${p.label}”…`)
                    const { renderRoyaltyFreePreview } = await import('./offlineRoyaltyFreeStudio.js')
                    const url = await renderRoyaltyFreePreview({
                      genre: p.genre,
                      mood: p.mood,
                      tempoBpm: p.tempo,
                      vocal: p.vocal,
                      userPrompt: p.label,
                    })
                    setPlayerUrl(url)
                    setStatus('Ready — press play. Download WAV if you need the file.')
                  } catch (e) {
                    setErr(String(e?.message || e))
                    setStatus('')
                  } finally {
                    setOfflineBusy(false)
                  }
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="mps-offline-gen"
            disabled={offlineBusy || busy}
            onClick={async () => {
              setErr('')
              setStatus('')
              setOfflineBusy(true)
              setPlayerUrl('')
              try {
                setStatus('Rendering from your controls…')
                const { renderRoyaltyFreePreview } = await import('./offlineRoyaltyFreeStudio.js')
                const url = await renderRoyaltyFreePreview({
                  genre,
                  mood,
                  tempoBpm: tempo,
                  vocal,
                  userPrompt: userPrompt.trim() || `${STUDIO_NAME} session`,
                })
                setPlayerUrl(url)
                setStatus('Ready — press play.')
              } catch (e) {
                setErr(String(e?.message || e))
                setStatus('')
              } finally {
                setOfflineBusy(false)
              }
            }}
          >
            {offlineBusy ? 'Rendering…' : 'Generate from controls (genre · mood · tempo · vocals)'}
          </button>
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
              <span className="mps-status mps-muted" style={{ marginTop: 0 }}>
                Mureka key needed for cloud only
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
            disabled={busy || offlineBusy}
          />

          <div className="mps-grid">
            <select
              className="mps-select"
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              disabled={busy || offlineBusy}
            >
              <option value="all">Genre · All</option>
              <option value="pop">Pop</option>
              <option value="electronic">Electronic</option>
              <option value="hip-hop">Hip-hop</option>
              <option value="jazz">Jazz</option>
              <option value="rock">Rock</option>
            </select>
            <select className="mps-select" value={mood} onChange={(e) => setMood(e.target.value)} disabled={busy || offlineBusy}>
              <option value="happy">Mood · Happy</option>
              <option value="relaxed">Relaxed</option>
              <option value="energetic">Energetic</option>
              <option value="sad">Sad</option>
              <option value="inspired">Inspired</option>
            </select>
            <select className="mps-select" value={tempo} onChange={(e) => setTempo(e.target.value)} disabled={busy || offlineBusy}>
              <option value="120">Tempo · 120 BPM</option>
              <option value="90">90 BPM</option>
              <option value="140">140 BPM</option>
              <option value="80">80 BPM</option>
            </select>
            <select className="mps-select" value={vocal} onChange={(e) => setVocal(e.target.value)} disabled={busy || offlineBusy}>
              <option value="female">Vocals · Female</option>
              <option value="male">Male</option>
              <option value="none">Instrumental</option>
            </select>
          </div>

          <button type="button" className="mps-gen" disabled={busy || offlineBusy} onClick={generate}>
            {busy ? 'Working…' : 'Generate with Mureka (cloud)'}
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
              {audioUrl.startsWith('blob:') && (
                <a className="mps-dl" href={audioUrl} download={`dieter-royalty-free-${Date.now()}.wav`}>
                  Download WAV
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      <section className="mps-features">
        <div className="mps-fcard">
          <div className="mps-ficon">SONG</div>
          <h3>Full tracks</h3>
          <p>
            Mureka generates arrangement and vocals (unless instrumental) — routed through {STUDIO_NAME} so your key
            never hits a random domain.
          </p>
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
