import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { trpc } from './trpc.js'
import { generateLyricsLocal, optimizeLyricsLocal } from './lyricsHelpers.js'
import LocalStudio from './LocalStudio.jsx'
import BeatLab from './BeatLab.jsx'
import VoiceCloneStudio from './VoiceCloneStudio.jsx'
import MurekaPromptStudio from './MurekaPromptStudio.jsx'
import { fetchStudioGrowth, normalizeApiRoot, postStudioGrowth } from './apiResolve.js'
import { extractAudioUrl } from './murekaHelpers.js'
import { useBeatVisualizer } from './useBeatVisualizer.js'

const DEFAULT_BASE = import.meta.env.VITE_API_BASE || '/api'
/** When true (default), Mureka calls go through Dieter tRPC → FastAPI. Set VITE_USE_TRPC=false to use REST /api only. */
const USE_TRPC = import.meta.env.VITE_USE_TRPC !== 'false'

const STYLE_PRESETS = [
  'Grand Piano',
  'Melodic Trap',
  'Post Rock',
  'Dream Pop',
  'Afrobeat',
  'Phonk',
  'Cinematic',
  'Lo-fi Bedroom',
]

/** Build Mureka prompt: style + optional vocals + lyrics or instrumental. */
function buildCreationPrompt({ instrumental, lyrics, style, vocal, title }) {
  const chunks = []
  const t = (title || 'Untitled').trim()
  chunks.push(`Title: ${t}`)
  chunks.push(`Musical style / production: ${style.trim() || 'modern pop'}`)
  if (instrumental) {
    chunks.push('Instrumental track only — no lead vocals, no sung lyrics.')
    chunks.push('Focus on melody in instruments, arrangement, and mix.')
  } else {
    chunks.push(`${vocal === 'male' ? 'Male' : 'Female'} lead vocal.`)
    const lyr = lyrics.trim()
    if (lyr) chunks.push(`Lyrics to perform:\n${lyr}`)
    else chunks.push('Write a memorable topline and lyrics matching the style.')
  }
  return chunks.join('\n\n')
}

export default function App() {
  /** `create` = Mureka hero. `local` / `beatlab` / `voicestudio` / `cloud` = labs + advanced cloud form. */
  const [appMode, setAppMode] = useState(
    () =>
      import.meta.env.VITE_DEFAULT_MODE === 'create'
        ? 'create'
        : import.meta.env.VITE_DEFAULT_MODE === 'cloud'
          ? 'cloud'
          : import.meta.env.VITE_DEFAULT_MODE === 'beatlab'
            ? 'beatlab'
            : import.meta.env.VITE_DEFAULT_MODE === 'voicestudio'
              ? 'voicestudio'
              : import.meta.env.VITE_DEFAULT_MODE === 'local'
                ? 'local'
                : 'create',
  )
  const [lyrics, setLyrics] = useState('')
  const [style, setStyle] = useState('Melodic Trap')
  const [title, setTitle] = useState('')
  const [vocal, setVocal] = useState('female')
  const [instrumental, setInstrumental] = useState(false)
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('mureka_api_key') || '')
  const [openaiKey, setOpenaiKey] = useState(() => localStorage.getItem('openai_api_key') || '')
  const [apiBase, setApiBase] = useState(() =>
    normalizeApiRoot(localStorage.getItem('dieter_api_base') || DEFAULT_BASE),
  )
  const [showAuth, setShowAuth] = useState(false)
  const [status, setStatus] = useState('')
  const [err, setErr] = useState('')
  const [audioUrl, setAudioUrl] = useState('')
  const [lyricsBusy, setLyricsBusy] = useState(false)
  const [studioPulse, setStudioPulse] = useState(null)
  const canvasRef = useRef(null)
  const audioRef = useRef(null)

  useBeatVisualizer(audioRef, canvasRef, audioUrl)

  const saveAuth = () => {
    localStorage.setItem('mureka_api_key', apiKey.trim())
    localStorage.setItem('openai_api_key', openaiKey.trim())
    localStorage.setItem('dieter_api_base', normalizeApiRoot(apiBase || DEFAULT_BASE))
    setShowAuth(false)
  }

  const base = useMemo(() => normalizeApiRoot(apiBase || DEFAULT_BASE), [apiBase])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const g = await fetchStudioGrowth(base)
      if (!cancelled && g) setStudioPulse(g)
    })()
    void postStudioGrowth(base, 'session_ping', 'app_open')
    return () => {
      cancelled = true
    }
  }, [base])

  const handleGenerateLyrics = useCallback(async () => {
    if (instrumental) return
    setLyricsBusy(true)
    setErr('')
    try {
      const keyOpt = openaiKey.trim() || undefined
      let text
      let source
      if (USE_TRPC) {
        const r = await trpc.lyricsGenerate.mutate({
          style,
          title,
          vocal,
          openaiApiKey: keyOpt,
        })
        text = r.text
        source = r.source
      } else {
        const r = await fetch(`${base}/lyrics/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            style,
            title,
            vocal,
            openaiApiKey: keyOpt,
          }),
        })
        if (!r.ok) throw new Error(await r.text())
        const j = await r.json()
        text = j.text
        source = j.source
      }
      setLyrics(text)
      void postStudioGrowth(base, 'lyrics_generated', source || 'lyrics')
      setStatus(
        source === 'openai'
          ? 'Lyrics generated (OpenAI via backend). Edit, Optimize, then Create.'
          : 'Lyrics generated (local template on server). Set OPENAI_API_KEY on FastAPI or add an optional OpenAI key below for AI.',
      )
    } catch (e) {
      const fallback = generateLyricsLocal(style, title, vocal)
      setLyrics(fallback)
      setErr(`Backend: ${e?.message || e} — browser fallback template.`)
      setStatus('Could not reach lyrics API; using local template.')
    } finally {
      setLyricsBusy(false)
    }
  }, [instrumental, openaiKey, style, title, vocal, base])

  const handleOptimizeLyrics = useCallback(async () => {
    if (instrumental || !lyrics.trim()) {
      setErr('Add lyrics first, or turn off Instrumental.')
      return
    }
    setLyricsBusy(true)
    setErr('')
    try {
      const keyOpt = openaiKey.trim() || undefined
      let text
      let source
      if (USE_TRPC) {
        const r = await trpc.lyricsOptimize.mutate({
          lyrics: lyrics.trim(),
          openaiApiKey: keyOpt,
        })
        text = r.text
        source = r.source
      } else {
        const r = await fetch(`${base}/lyrics/optimize`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lyrics: lyrics.trim(), openaiApiKey: keyOpt }),
        })
        if (!r.ok) throw new Error(await r.text())
        const j = await r.json()
        text = j.text
        source = j.source
      }
      setLyrics(text)
      void postStudioGrowth(base, 'lyrics_optimized', source || 'optimize')
      setStatus(
        source === 'openai'
          ? 'Lyrics optimized (OpenAI via backend). Review and Create when ready.'
          : 'Lyrics optimized (local rules on server). Add OPENAI_API_KEY or optional key for AI polish.',
      )
    } catch (e) {
      setLyrics(optimizeLyricsLocal(lyrics))
      setErr(`Backend: ${e?.message || e} — optimized in browser.`)
      setStatus('Could not reach lyrics API; used local optimizer.')
    } finally {
      setLyricsBusy(false)
    }
  }, [instrumental, openaiKey, lyrics, base])

  const submit = useCallback(async () => {
    setErr('')
    setStatus('')
    if (!apiKey.trim()) {
      setShowAuth(true)
      return
    }
    /** Blank lyrics ⇒ instrumental (product default); checkbox forces instrumental and ignores typed lyrics. */
    const effectiveInstrumental = instrumental || !lyrics.trim()
    const prompt = buildCreationPrompt({
      instrumental: effectiveInstrumental,
      lyrics,
      style,
      vocal,
      title,
    })
    const lyricPayload = effectiveInstrumental ? '' : lyrics.trim()
    const key = apiKey.trim()
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
        const r = await fetch(`${base}/mureka/song/generate`, {
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
        setStatus(`Polling ${taskId} (${i + 1}/90)${USE_TRPC ? ' [tRPC]' : ''}…`)
        let qj
        if (USE_TRPC) {
          qj = await trpc.murekaSongQuery.query({
            taskId,
            murekaApiKey: key,
          })
        } else {
          const q = await fetch(`${base}/mureka/song/query/${encodeURIComponent(taskId)}`, {
            headers: { Authorization: `Bearer ${key}` },
          })
          if (!q.ok) throw new Error(await q.text())
          qj = await q.json()
        }
        const url = extractAudioUrl(qj)
        if (url) {
          setAudioUrl(url)
          void postStudioGrowth(base, 'mureka_song_ready', taskId)
          void fetchStudioGrowth(base).then((g) => g && setStudioPulse(g))
          setStatus('Ready — press play to drive the visualizer.')
          return
        }
        const st = (qj.status || qj.state || '').toString().toLowerCase()
        if (st.includes('fail') || st.includes('error'))
          throw new Error(JSON.stringify(qj.error || qj))
        await new Promise((res) => setTimeout(res, 2000))
      }
      throw new Error('Timeout waiting for Mureka')
    } catch (e) {
      setErr(String(e.message || e))
      setStatus('')
    }
  }, [apiKey, base, instrumental, lyrics, style, title, vocal])

  const recordVideo = useCallback(() => {
    const canvas = canvasRef.current
    const audio = audioRef.current
    if (!canvas || !audio) {
      alert('Generate a track first, then press play on the player.')
      return
    }
    if (typeof MediaRecorder === 'undefined') {
      alert('MediaRecorder not supported.')
      return
    }
    let mime = 'video/webm;codecs=vp9'
    if (!MediaRecorder.isTypeSupported(mime)) mime = 'video/webm'
    const vStream = canvas.captureStream(30)
    let combined = vStream
    if (audio.captureStream) {
      try {
        const aStream = audio.captureStream()
        combined = new MediaStream([
          ...vStream.getVideoTracks(),
          ...aStream.getAudioTracks(),
        ])
      } catch {
        /* video-only */
      }
    }
    const rec = new MediaRecorder(combined, { mimeType: mime })
    const chunks = []
    rec.ondataavailable = (e) => {
      if (e.data?.size) chunks.push(e.data)
    }
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: mime.split(';')[0] || 'video/webm' })
      const u = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = u
      a.download = 'dieter-esq-visual.webm'
      a.click()
      URL.revokeObjectURL(u)
    }
    rec.start(200)
    audio.play().catch(() => {})
    const dur = Number.isFinite(audio.duration) ? audio.duration : 30
    setTimeout(() => {
      try {
        rec.stop()
      } catch {
        /* ignore */
      }
    }, Math.min(180000, Math.max(4000, dur * 1000 + 800)))
  }, [])

  return (
    <div className="app">
      <header className="header">
        <nav className="nav-main">
          <strong>
            {appMode === 'create'
              ? 'Dieter Esq. · Create'
              : appMode === 'local'
                ? 'Dieter Esq. · Local'
                : appMode === 'beatlab'
                  ? 'Dieter Esq. · Beat lab'
                  : appMode === 'voicestudio'
                    ? 'Dieter Esq. · Voice'
                    : 'Dieter Esq. · Cloud'}
          </strong>
        </nav>
        <div className="user-actions" style={{ flexWrap: 'wrap', gap: 8 }}>
          <button
            type="button"
            className={appMode === 'create' ? 'pill-btn' : 'btn-mode'}
            onClick={() => setAppMode('create')}
          >
            Create
          </button>
          <button
            type="button"
            className={appMode === 'local' ? 'pill-btn' : 'btn-mode'}
            onClick={() => setAppMode('local')}
          >
            Local (8787)
          </button>
          <button
            type="button"
            className={appMode === 'beatlab' ? 'pill-btn' : 'btn-mode'}
            onClick={() => setAppMode('beatlab')}
          >
            Beat lab (8000)
          </button>
          <button
            type="button"
            className={appMode === 'voicestudio' ? 'pill-btn' : 'btn-mode'}
            onClick={() => setAppMode('voicestudio')}
          >
            Voice studio
          </button>
          <button
            type="button"
            className={appMode === 'cloud' ? 'pill-btn' : 'btn-mode'}
            onClick={() => setAppMode('cloud')}
          >
            Cloud
          </button>
          {(appMode === 'cloud' || appMode === 'create') && (
            <button type="button" className="pill-btn" onClick={() => setShowAuth(true)}>
              API keys
            </button>
          )}
        </div>
      </header>

      {showAuth && (
        <div className="modal" role="dialog">
          <div className="modal-bg" onClick={() => setShowAuth(false)} aria-hidden />
          <div className="modal-card">
            <h2>Connections</h2>
            <p className="hint">
              <strong>Mureka</strong> key from{' '}
              <a href="https://platform.mureka.ai" target="_blank" rel="noreferrer">
                platform.mureka.ai
              </a>
              . Dev: Vite proxies <code>/trpc</code> → tRPC (8790) and <code>/api</code> → FastAPI (see{' '}
              <code>vite.config.js</code>).
              <br />
              <strong>Production (full app)</strong>: deploy the <strong>single Docker image</strong> (
              <code>dieter-backend/Dockerfile</code> from repo root). Open your host URL — UI and <code>/api</code> are
              the same origin (see <code>DIETER_ESQ_START.md</code> in the repo). Only if you host the UI separately
              (e.g. Cloudflare Pages) set <code>VITE_API_BASE</code> and optional <code>DIETER_CORS_ORIGINS</code> on
              the API.
              <br />
              <strong>OpenAI</strong> (optional): set <code>OPENAI_API_KEY</code> on the FastAPI server for AI lyrics;
              or paste a key here to pass through to the backend. Generate/Optimize call FastAPI via tRPC (or{' '}
              <code>/api/lyrics/*</code> when tRPC is off).
            </p>
            <label>Mureka API key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              autoComplete="off"
            />
            <label>OpenAI API key (optional)</label>
            <input
              type="password"
              value={openaiKey}
              onChange={(e) => setOpenaiKey(e.target.value)}
              autoComplete="off"
              placeholder="sk-… for Generate / Optimize lyrics"
            />
            <label>API base (REST)</label>
            <input
              type="text"
              value={apiBase}
              onChange={(e) => setApiBase(e.target.value)}
              placeholder="/api or https://your-api.com/api"
            />
            <div className="row">
              <button type="button" className="primary" onClick={saveAuth}>
                Save
              </button>
              <button type="button" className="btn-secondary" onClick={() => setShowAuth(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {appMode === 'create' ? (
        <MurekaPromptStudio
          apiBase={base}
          apiKey={apiKey}
          onOpenKeys={() => setShowAuth(true)}
          onStudioPulse={(g) => setStudioPulse(g)}
        />
      ) : appMode === 'local' ? (
        <main className="main main-local">
          <LocalStudio apiBase={base} />
        </main>
      ) : appMode === 'beatlab' ? (
        <main className="main main-local">
          <BeatLab apiBase={base} />
        </main>
      ) : appMode === 'voicestudio' ? (
        <main className="main main-local">
          <VoiceCloneStudio apiBase={base} />
        </main>
      ) : (
        <>
      <main className="main">
        <p className="workflow-intro">
          <strong>Workflow:</strong> write your own lyrics or use <strong>Generate Lyrics</strong>, refine with{' '}
          <strong>Optimize</strong>, pick <strong>vocal gender</strong> and <strong>style</strong> (mood,
          instruments, e.g. Grand Piano, Melodic Trap). <strong>Instrumental:</strong> leave lyrics blank, or turn
          on <strong>Instrumental</strong> to ignore any pasted lyrics. Then <strong>Create</strong> for melody +
          vocals (or instrumental).
        </p>

        <div className="tabs">
          {['Easy', 'Custom', '1 Free', 'V8'].map((t) => (
            <span key={t} className="tab">
              {t}
            </span>
          ))}
        </div>
        <div className="tabs">
          {['Reference', 'Remix', 'New', 'Vocal', 'Lyrics', 'Instrumental'].map((t) => (
            <span key={t} className="tab dim">
              {t}
            </span>
          ))}
        </div>

        <label htmlFor="lyrics-field">Lyrics</label>
        <p className="field-hint">
          Type your own words, or use Generate / Optimize. Empty lyrics create an <strong>instrumental</strong>; the
          checkbox below also forces instrumental and ignores the field.
        </p>
        <textarea
          id="lyrics-field"
          value={lyrics}
          onChange={(e) => setLyrics(e.target.value)}
          rows={8}
          disabled={instrumental}
          placeholder={
            instrumental
              ? 'Instrumental mode — lyrics disabled. Describe everything in Style + title.'
              : '[Verse]\nYour lines…\n\n[Chorus]\n…'
          }
        />

        <div className="lyrics-toolbar">
          <button
            type="button"
            className="btn-secondary"
            onClick={handleGenerateLyrics}
            disabled={instrumental || lyricsBusy}
          >
            {lyricsBusy ? '…' : 'Generate Lyrics'}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleOptimizeLyrics}
            disabled={instrumental || lyricsBusy || !lyrics.trim()}
          >
            Optimize
          </button>
        </div>

        <div className="instrumental-row">
          <input
            type="checkbox"
            id="instrumental"
            checked={instrumental}
            onChange={(e) => setInstrumental(e.target.checked)}
          />
          <label htmlFor="instrumental" className="instrumental-label">
            <strong>Instrumental</strong> — no lead vocal; lyrics are ignored for creation. Style still drives the
            arrangement.
          </label>
        </div>

        <label htmlFor="style-field">Style (mood, instruments, genre)</label>
        <p className="field-hint">Examples: Grand Piano, Melodic Trap, Post Rock — combined with your lyrics for the final sound.</p>
        <div className="style-chips">
          {STYLE_PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              className={'style-chip' + (style === p ? ' active' : '')}
              onClick={() => setStyle(p)}
            >
              {p}
            </button>
          ))}
        </div>
        <input
          id="style-field"
          value={style}
          onChange={(e) => setStyle(e.target.value)}
          placeholder="e.g. Grand Piano, Melodic Trap, Post Rock"
        />

        <label>Vocal gender</label>
        <p className="field-hint">Used when Instrumental is off. Mureka uses this for the performed vocal.</p>
        <div className="vocal">
          <label>
            <input
              type="radio"
              name="v"
              checked={vocal === 'female'}
              onChange={() => setVocal('female')}
              disabled={instrumental}
            />{' '}
            Female
          </label>
          <label>
            <input
              type="radio"
              name="v"
              checked={vocal === 'male'}
              onChange={() => setVocal('male')}
              disabled={instrumental}
            />{' '}
            Male
          </label>
        </div>

        <label htmlFor="title-field">Title ({title.length}/50)</label>
        <input
          id="title-field"
          maxLength={50}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Song title"
        />

        <button type="button" className="primary wide" onClick={submit}>
          Create
        </button>
        {status && <p className="ok">{status}</p>}
        {err && <p className="bad">{err}</p>}

        {!audioUrl && <div className="empty">No audio yet — fill the form and press Create.</div>}

        {audioUrl && (
          <>
            <audio
              key={audioUrl}
              ref={audioRef}
              controls
              src={audioUrl}
              crossOrigin="anonymous"
              className="player"
            />
            <canvas ref={canvasRef} width={800} height={160} className="viz" />
            <div className="row">
              <button type="button" className="primary" onClick={recordVideo}>
                Export Video (WebM)
              </button>
            </div>
            <p className="hint">Visualizer uses Web Audio (AnalyserNode). Lyrics tools use the backend proxy.</p>
          </>
        )}
      </main>
        </>
      )}

      <footer
        className="studio-pulse-footer"
        style={{
          padding: '14px 20px 20px',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          fontSize: '0.82rem',
          opacity: 0.88,
          lineHeight: 1.5,
        }}
      >
        <strong>Studio pulse</strong>{' '}
        {studioPulse?.counters ? (
          <span>
            lyrics {studioPulse.counters.lyrics_generated ?? 0} · masters {studioPulse.counters.masters_built ?? 0} ·
            cloud tracks {studioPulse.counters.mureka_songs ?? 0} · beats {studioPulse.counters.beats_analyzed ?? 0} ·
            ref. voices {studioPulse.counters.voice_clones ?? 0}
          </span>
        ) : (
          <span>Deploy the Docker image — API lives at <code>/api</code> on this same host.</span>
        )}
      </footer>
    </div>
  )
}
