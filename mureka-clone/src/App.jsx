import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { trpc } from './trpc.js'
import { generateLyricsLocal, optimizeLyricsLocal } from './lyricsHelpers.js'
import LocalStudio from './LocalStudio.jsx'
import BeatLab from './BeatLab.jsx'
import VoiceCloneStudio from './VoiceCloneStudio.jsx'
import MurekaPromptStudio from './MurekaPromptStudio.jsx'
import StudioV5 from './StudioV5.jsx'
import CoverStudio from './CoverStudio.jsx'
import StudioPortal from './StudioPortal.jsx'
import {
  fetchStudioGrowth,
  normalizeApiRoot,
  parseFetchJson,
  postStudioGrowth,
  publicOriginForApiRoot,
  absoluteFromApiPath,
} from './apiResolve.js'
import { dieterInitialApiBase, dieterUseTrpc, audioCrossOriginForSrc } from './dieterClientConfig.js'
import { extractAudioUrl } from './murekaHelpers.js'
import { useBeatVisualizer } from './useBeatVisualizer.js'
import { getStudioOutboundLinks } from './studioLinks.js'
import { STUDIO_NAME, STUDIO_SLUG } from './studioBrand.js'

const DEFAULT_BASE = import.meta.env.VITE_API_BASE || '/api'
const USE_TRPC = dieterUseTrpc()

/** Header subtitle per mode — keep in sync with mode button order (gateway / AI labs first). */
const APP_MODE_HEADER = {
  portal: 'Portal & guide',
  create: 'Create',
  cloud: 'Cloud',
  voicestudio: 'Voice',
  beatlab: 'Beat lab',
  v5: 'V5',
  cover: 'Cover',
  local: 'Local',
}

const HASH_TO_MODE = {
  portal: 'portal',
  guide: 'portal',
  create: 'create',
  cloud: 'cloud',
  voicestudio: 'voicestudio',
  beatlab: 'beatlab',
  v5: 'v5',
  cover: 'cover',
  local: 'local',
}

const SIDEBAR_GROUPS = [
  {
    title: 'Start here',
    items: [{ id: 'portal', label: 'Portal & guide', hint: 'Health, links, Mureka' }],
  },
  {
    title: 'Mureka cloud',
    items: [
      { id: 'create', label: 'Create', hint: 'Mureka gateway' },
      { id: 'cloud', label: 'Cloud', hint: 'Lyrics + cloud' },
      { id: 'voicestudio', label: 'Voice studio', hint: 'Clone & cloud' },
    ],
  },
  {
    title: 'Labs',
    items: [
      { id: 'beatlab', label: 'Beat lab' },
      { id: 'local', label: 'Local pipeline' },
      { id: 'v5', label: 'V5' },
      { id: 'cover', label: 'Cover' },
    ],
  },
]

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
  const [appMode, setAppMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const h = (window.location.hash || '').replace(/^#/, '').toLowerCase().trim()
      if (h && HASH_TO_MODE[h]) return HASH_TO_MODE[h]
    }
    const m = import.meta.env.VITE_DEFAULT_MODE
    if (m === 'portal') return 'portal'
    if (m === 'create') return 'create'
    if (m === 'v5') return 'v5'
    if (m === 'cover') return 'cover'
    if (m === 'cloud') return 'cloud'
    if (m === 'beatlab') return 'beatlab'
    if (m === 'voicestudio') return 'voicestudio'
    if (m === 'local') return 'local'
    /** Default: Create (Mureka + real cloud vocals). Set VITE_DEFAULT_MODE=local for offline procedural lab first. */
    return 'create'
  })
  const [lyrics, setLyrics] = useState('')
  const [style, setStyle] = useState('Melodic Trap')
  const [title, setTitle] = useState('')
  const [vocal, setVocal] = useState('female')
  const [instrumental, setInstrumental] = useState(false)
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('mureka_api_key') || '')
  const [openaiKey, setOpenaiKey] = useState(() => localStorage.getItem('openai_api_key') || '')
  const [apiBase, setApiBase] = useState(() => dieterInitialApiBase())
  const [showAuth, setShowAuth] = useState(false)
  const [status, setStatus] = useState('')
  const [err, setErr] = useState('')
  const [audioUrl, setAudioUrl] = useState('')
  const [lyricsBusy, setLyricsBusy] = useState(false)
  const [procBusy, setProcBusy] = useState(false)
  const [lyricsReport, setLyricsReport] = useState(null)
  const [lyricsAnalyzeErr, setLyricsAnalyzeErr] = useState('')
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
  const outboundLinks = useMemo(() => getStudioOutboundLinks(), [])

  const goMode = useCallback((mode) => {
    setAppMode(mode)
    if (typeof window !== 'undefined' && window.history?.replaceState) {
      window.history.replaceState(null, '', `#${mode === 'portal' ? 'portal' : mode}`)
    }
  }, [])

  useEffect(() => {
    const onHash = () => {
      const h = (window.location.hash || '').replace(/^#/, '').toLowerCase().trim()
      if (h && HASH_TO_MODE[h]) setAppMode(HASH_TO_MODE[h])
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

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

  useEffect(() => {
    if (appMode !== 'cloud' || instrumental) {
      setLyricsReport(null)
      setLyricsAnalyzeErr('')
      return
    }
    const text = lyrics.trim()
    if (!text) {
      setLyricsReport(null)
      setLyricsAnalyzeErr('')
      return
    }
    let cancelled = false
    const t = setTimeout(() => {
      ;(async () => {
        setLyricsAnalyzeErr('')
        try {
          const r = await fetch(`${base}/lyrics/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lyrics: text, beatsPerBar: 4 }),
          })
          if (!r.ok) {
            const msg = await r.text()
            throw new Error(msg || r.statusText)
          }
          const j = await r.json()
          if (!cancelled) setLyricsReport(j)
        } catch (e) {
          if (!cancelled) {
            setLyricsReport(null)
            setLyricsAnalyzeErr(e?.message || String(e))
          }
        }
      })()
    }, 550)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [lyrics, instrumental, appMode, base])

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

  /** Procedural multitrack WAV from the DIETER engine (FastAPI job); uses tRPC when enabled — real .wav mix + stems on disk. */
  const submitProceduralWav = useCallback(async () => {
    setErr('')
    setProcBusy(true)
    setStatus('')
    const effectiveInstrumental = instrumental || !lyrics.trim()
    const prompt = buildCreationPrompt({
      instrumental: effectiveInstrumental,
      lyrics,
      style,
      vocal,
      title,
    })
    const lyricPayload = effectiveInstrumental ? '' : lyrics.trim()
    const payload = {
      prompt,
      lyrics: lyricPayload || undefined,
      bpm: 128,
      mood: (style || '—').trim() || '—',
      style: style.trim() || 'Cinematic',
      language: 'en',
      vocalPreset: 'Radio',
      modelLine: 'V7.5',
      tier: 'pro',
      stems: true,
      durationSec: 45,
    }
    const origin = publicOriginForApiRoot(base)
    setStatus(
      USE_TRPC ? 'Generating procedural WAV (tRPC → FastAPI job)…' : 'Generating procedural WAV (REST job)…',
    )
    try {
      let jobId = ''
      if (USE_TRPC) {
        const gen = await trpc.musicGenerate.mutate(payload)
        jobId = String(gen?.jobId || '')
      } else {
        const r = await fetch(`${base}/music/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const j = await parseFetchJson(r)
        jobId = String(j?.jobId || '')
      }
      if (!jobId) throw new Error('No jobId from server')

      for (let i = 0; i < 120; i++) {
        let row
        if (USE_TRPC) {
          row = await trpc.jobWithPlaybackUrls.query({
            jobId,
            publicOrigin: origin || undefined,
          })
        } else {
          const r = await fetch(`${base}/jobs/${encodeURIComponent(jobId)}`)
          row = await parseFetchJson(r)
        }
        const st = String(row?.status || '')
        if (st === 'succeeded' && row?.output?.mix?.wavUrl) {
          const mix = row.output.mix
          const playUrl =
            (typeof mix.wavUrlAbsolute === 'string' && mix.wavUrlAbsolute) ||
            absoluteFromApiPath(base, mix.wavUrl)
          setAudioUrl(playUrl)
          void postStudioGrowth(base, 'procedural_wav_ready', jobId)
          void fetchStudioGrowth(base).then((g) => g && setStudioPulse(g))
          setStatus('Procedural mix ready — lossless WAV from the backend engine.')
          return
        }
        if (st === 'failed') throw new Error(row?.error || 'Job failed')
        await new Promise((res) => setTimeout(res, 500))
      }
      throw new Error('Timeout waiting for procedural job')
    } catch (e) {
      setErr(String(e.message || e))
      setStatus('')
    } finally {
      setProcBusy(false)
    }
  }, [base, instrumental, lyrics, style, title, vocal])

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
      a.download = `${STUDIO_SLUG}-visual.webm`
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

  const showKeysFab =
    appMode === 'cloud' ||
    appMode === 'create' ||
    appMode === 'local' ||
    appMode === 'beatlab' ||
    appMode === 'voicestudio' ||
    appMode === 'portal'

  return (
    <div className="app">
      <div className="app-shell">
        <aside className="app-sidebar" aria-label="Studio navigation">
          <div className="sidebar-brand">
            <span className="sidebar-brand-title">{STUDIO_NAME}</span>
            <span className="sidebar-brand-sub">Mureka + API</span>
          </div>
          <nav className="sidebar-nav">
            {SIDEBAR_GROUPS.map((g) => (
              <div key={g.title} className="sidebar-group">
                <div className="sidebar-group-title">{g.title}</div>
                {g.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={'sidebar-nav-btn' + (appMode === item.id ? ' sidebar-nav-btn-active' : '')}
                    onClick={() => goMode(item.id)}
                    title={item.hint || item.label}
                  >
                    <span className="sidebar-nav-label">{item.label}</span>
                    {item.hint ? <span className="sidebar-nav-hint">{item.hint}</span> : null}
                  </button>
                ))}
              </div>
            ))}
          </nav>
          <div className="sidebar-footer">
            <a className="sidebar-linkout" href="/ed-geerdes-platform.html">
              Static showroom ↗
            </a>
            {showKeysFab && (
              <button type="button" className="sidebar-keys-btn" onClick={() => setShowAuth(true)}>
                API keys &amp; sync
              </button>
            )}
          </div>
        </aside>

        <div className="app-main">
          <header className="header header-compact">
            <nav className="nav-main">
              <strong>{APP_MODE_HEADER[appMode] ?? 'Studio'}</strong>
            </nav>
          </header>

          <div className="app-main-body">
      {showAuth && (
        <div className="modal" role="dialog">
          <div className="modal-bg" onClick={() => setShowAuth(false)} aria-hidden />
          <div className="modal-card">
            <h2>Connections</h2>
            <p className="hint">
              <strong>Gateway:</strong> this panel is your <strong>sync portal</strong> for keys and API base.{' '}
              <strong>Mureka</strong> powers cloud models on <strong>Create</strong>, <strong>Cloud</strong>, and{' '}
              <strong>Voice studio</strong>. Get a key from{' '}
              <a href="https://platform.mureka.ai" target="_blank" rel="noreferrer">
                platform.mureka.ai
              </a>
              ; in Docker/Railway set <code>MUREKA_API_KEY</code> on the server so clients do not need to paste it. The{' '}
              <strong>Local</strong> tab runs <strong>server-side DSP</strong> (ffmpeg / stems) through the same API — not
              an in-browser demo synth.
              <br />
              Dev: Vite proxies <code>/trpc</code> → tRPC (8790) and <code>/api</code> → FastAPI (see{' '}
              <code>vite.config.js</code>). <strong>tRPC</strong> is on by default in dev only; production builds use{' '}
              <strong>REST</strong> unless you set <code>VITE_USE_TRPC=true</code>.
              <br />
              <strong>Production (full app)</strong>: deploy the <strong>single Docker image</strong> (
              <code>dieter-backend/Dockerfile</code> from repo root). Open your host URL — UI and <code>/api</code> are
              the same origin. Only if you host the UI separately
              (e.g. Vercel + Railway) set <code>VITE_API_BASE</code> and optional <code>DIETER_CORS_ORIGINS</code> on
              the API — see <code>DEPLOY_VERCEL_RAILWAY.md</code> (ED-GEERDES / Vercel).
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

      {appMode === 'portal' ? (
        <StudioPortal apiBase={base} onOpenKeys={() => setShowAuth(true)} onNavigateMode={goMode} />
      ) : appMode === 'create' ? (
        <MurekaPromptStudio
          apiBase={base}
          apiKey={apiKey}
          onOpenKeys={() => setShowAuth(true)}
          onStudioPulse={(g) => setStudioPulse(g)}
          onGoLocalWithLyrics={(text) => {
            try {
              sessionStorage.setItem('dieter_local_lyrics_seed', String(text || '').trim())
            } catch {
              /* ignore quota / private mode */
            }
            goMode('local')
          }}
        />
      ) : appMode === 'v5' ? (
        <main className="main main-local">
          <StudioV5 apiBase={base} />
        </main>
      ) : appMode === 'cover' ? (
        <main className="main main-local">
          <CoverStudio apiBase={base} />
        </main>
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

        {!instrumental && lyrics.trim() && (
          <div className="lyrics-lint-panel" style={{ marginTop: 8 }}>
            {lyricsAnalyzeErr && (
              <p className="bad" style={{ fontSize: '0.88rem' }}>
                Lyrics analyze: {lyricsAnalyzeErr} (needs reachable <code>/api/lyrics/analyze</code>)
              </p>
            )}
            {lyricsReport && !lyricsAnalyzeErr && (
              <>
                {(lyricsReport.errors?.length > 0 || !lyricsReport.ok) && (
                  <ul className="bad" style={{ fontSize: '0.88rem', margin: '6px 0' }}>
                    {(lyricsReport.errors || []).map((x, i) => (
                      <li key={`e-${i}`}>{x}</li>
                    ))}
                  </ul>
                )}
                {lyricsReport.warnings?.length > 0 && (
                  <ul
                    className="hint"
                    style={{
                      fontSize: '0.88rem',
                      margin: '6px 0',
                      opacity: 0.95,
                      listStyle: 'disc',
                      paddingLeft: '1.2rem',
                    }}
                  >
                    {lyricsReport.warnings.map((x, i) => (
                      <li key={`w-${i}`}>{x}</li>
                    ))}
                  </ul>
                )}
                {lyricsReport.metrics && (
                  <p className="hint" style={{ fontSize: '0.82rem', margin: '4px 0 0' }}>
                    {lyricsReport.metrics.lineCount} sung lines · {lyricsReport.metrics.sectionTagCount} section tag(s)
                    {lyricsReport.barsHint
                      ? ` · bar ~${lyricsReport.barsHint.secondsPerBar}s @ ${lyricsReport.barsHint.bpmAssumed} BPM (hint)`
                      : ''}
                  </p>
                )}
              </>
            )}
          </div>
        )}

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
        <p className="field-hint" style={{ marginTop: 10 }}>
          <strong>Local WAV engine:</strong> render a real multitrack <code>.wav</code> on the API (
          {USE_TRPC ? 'via tRPC' : 'REST'}) — no Mureka key. Same lyrics/style as above; uses the procedural engine on the
          server.
        </p>
        <button type="button" className="btn-secondary wide" disabled={procBusy} onClick={submitProceduralWav}>
          {procBusy ? '…' : 'Generate procedural WAV (backend)'}
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
              crossOrigin={audioCrossOriginForSrc(audioUrl)}
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
          </div>

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
        <div style={{ marginBottom: 10 }}>
          <strong>Studio pulse</strong>{' '}
          {studioPulse?.counters ? (
            <span>
              lyrics {studioPulse.counters.lyrics_generated ?? 0} · masters {studioPulse.counters.masters_built ?? 0} ·
              cloud tracks {studioPulse.counters.mureka_songs ?? 0} · beats{' '}
              {studioPulse.counters.beats_analyzed ?? 0} · ref. voices {studioPulse.counters.voice_clones ?? 0}
            </span>
          ) : (
            <span>
              Deploy the Docker image — API at <code>/api</code>. Vercel UI only: set <code>VITE_API_BASE</code> to your
              API origin.
            </span>
          )}
        </div>
        {outboundLinks.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 16px', alignItems: 'center' }}>
            <strong>Outbound</strong>
            {outboundLinks.map(({ label, href }) => (
              <a key={href + label} href={href} target="_blank" rel="noreferrer">
                {label}
              </a>
            ))}
          </div>
        )}
        <div style={{ marginTop: 10 }}>
          <a className="footer-link" href="#portal" onClick={(e) => { e.preventDefault(); goMode('portal') }}>
            Portal &amp; API health
          </a>
          {' · '}
          <a className="footer-link" href="/ed-geerdes-platform.html">
            ED-GEERDES showroom
          </a>
        </div>
      </footer>
        </div>
      </div>
    </div>
  )
}
