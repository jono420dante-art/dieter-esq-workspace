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
import AudioTransport from './AudioTransport.jsx'
import SongPlaybackPage from './SongPlaybackPage.jsx'
import TealVoicesStudio from './TealVoicesStudio.jsx'
import ReleaseMarketing from './ReleaseMarketing.jsx'
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
import { withMurekaRetries } from './murekaResilience.js'
import { useBeatVisualizer } from './useBeatVisualizer.js'
import { getStudioOutboundLinks } from './studioLinks.js'
import { STUDIO_NAME, STUDIO_SLUG, MUREKA_CLONE_LABEL } from './studioBrand.js'

const DEFAULT_BASE = import.meta.env.VITE_API_BASE || '/api'
const USE_TRPC = dieterUseTrpc()

function formatSessionSeconds(totalSec) {
  const s = Math.max(0, Math.floor(totalSec))
  const m = Math.floor(s / 60)
  const sec = s % 60
  if (m <= 0) return `${sec}s`
  return `${m}m ${sec.toString().padStart(2, '0')}s`
}

/** Header title per mode — keep in sync with sidebar groups. */
const APP_MODE_HEADER = {
  portal: 'Portal & guide',
  release: 'Release & reach',
  create: 'Create',
  cloud: 'Cloud',
  voicestudio: 'Voice',
  beatlab: 'Beat lab',
  v5: 'V5',
  cover: 'Cover',
  local: 'Local',
  player: 'Now playing',
  tealvoices: 'Teal Voices',
}

/** One-line UX intent under the header (driven / guided copy). */
const APP_MODE_SUB = {
  portal: 'Check health, then go to Create for the full Mureka path.',
  release: 'SEO pack, hashtags, and links to sell & post your finished tracks.',
  create: 'Keys → describe your track → Generate (Mureka renders real vocals).',
  cloud: 'Polish lyrics, pick style & vocal, then Create with Mureka.',
  voicestudio: 'Beat + lyrics → Mureka mix — optional sample for local tools.',
  beatlab: 'Beat + lyrics → master pipeline (DSP). AI vocals: use Create.',
  v5: 'Experimental V5 surface — Create stays the main Mureka entry.',
  cover: 'Cover / stems tools — lead vocals from models: Create + Mureka.',
  local: 'Local beat & draft stems — production vocals: Create.',
  player: 'Playback and lyrics follow-along.',
  tealvoices: 'Backend TTS acapella from lyrics (Coqui or fallback) — chart vocals: Create.',
}

/**
 * Top “guided path” strip: drives users through Connect → Prompt → Generate for Mureka modes.
 */
function StudioJourneyStrip({ mode, hasMurekaKey, onOpenKeys, onGoCreate }) {
  if (mode === 'player') return null

  if (mode === 'portal') {
    return (
      <div className="studio-journey studio-journey--portal" role="region" aria-label="Suggested studio path">
        <div className="studio-journey-head">
          <span className="studio-journey-eyebrow">Start here</span>
          <span className="studio-journey-lane">Orientation</span>
        </div>
        <p className="studio-journey-text">
          Confirm API health below, open <strong>Connections</strong> if you deploy split UI, then go to{' '}
          <button type="button" className="studio-journey-inline-btn" onClick={onGoCreate}>
            Create
          </button>{' '}
          for the main Mureka flow.
        </p>
      </div>
    )
  }

  if (mode === 'release') {
    return (
      <div className="studio-journey studio-journey--lab" role="region" aria-label="Release path">
        <div className="studio-journey-head">
          <span className="studio-journey-eyebrow">After the song is ready</span>
          <span className="studio-journey-lane">Distribute · SEO · social</span>
        </div>
        <p className="studio-journey-lab-copy">
          Generate on{' '}
          <button type="button" className="studio-journey-inline-btn" onClick={onGoCreate}>
            Create
          </button>
          , then return here for titles, hashtags, and portal links.
        </p>
      </div>
    )
  }

  if (mode === 'tealvoices') {
    return (
      <div className="studio-journey studio-journey--lab" role="region" aria-label="Teal Voices path">
        <div className="studio-journey-head">
          <span className="studio-journey-eyebrow">Teal Voices</span>
          <span className="studio-journey-lane">FastAPI · lyrics → WAV</span>
        </div>
        <p className="studio-journey-lab-copy">
          This tab calls <code>POST /api/tealvoices/sing</code> on your Dieter backend. For full sung productions with model
          vocals, use{' '}
          <button type="button" className="studio-journey-inline-btn" onClick={onGoCreate}>
            Create
          </button>{' '}
          (Mureka).
        </p>
      </div>
    )
  }

  if (mode === 'create' || mode === 'cloud' || mode === 'voicestudio') {
    return (
      <div className="studio-journey" role="region" aria-label="Mureka workflow steps">
        <div className="studio-journey-head">
          <span className="studio-journey-eyebrow">Guided path</span>
          <span className="studio-journey-lane">Mureka · model vocals &amp; mix</span>
        </div>
        <ol className="studio-journey-steps">
          <li
            className={
              'studio-journey-step' +
              (hasMurekaKey ? ' studio-journey-step-done' : ' studio-journey-step-active')
            }
          >
            <button type="button" className="studio-journey-step-btn" onClick={onOpenKeys}>
              <span className="studio-journey-step-num">1</span>
              <span>Connections</span>
            </button>
            {hasMurekaKey ? (
              <span className="studio-journey-badge">Ready</span>
            ) : (
              <span className="studio-journey-badge studio-journey-badge-need">Set key</span>
            )}
          </li>
          <li
            className={
              'studio-journey-step' +
              (hasMurekaKey ? ' studio-journey-step-active' : ' studio-journey-step-muted')
            }
          >
            <span className="studio-journey-step-num">2</span>
            <span className="studio-journey-step-label">Lyrics &amp; prompt</span>
          </li>
          <li className={'studio-journey-step' + (hasMurekaKey ? '' : ' studio-journey-step-muted')}>
            <span className="studio-journey-step-num">3</span>
            <span className="studio-journey-step-label">Generate &amp; listen</span>
          </li>
        </ol>
      </div>
    )
  }

  return (
    <div className="studio-journey studio-journey--lab" role="region" aria-label="Lab tools hint">
      <div className="studio-journey-head">
        <span className="studio-journey-eyebrow">Lab</span>
        <span className="studio-journey-lane">DSP · draft stems · experiments</span>
      </div>
      <p className="studio-journey-lab-copy">
        This area is for beats, FFmpeg, and tests. For <strong>Mureka-style AI lead vocals</strong>, use{' '}
        <button type="button" className="studio-journey-inline-btn" onClick={onGoCreate}>
          Create
        </button>
        .
      </p>
    </div>
  )
}

const HASH_TO_MODE = {
  portal: 'portal',
  guide: 'portal',
  release: 'release',
  sell: 'release',
  marketing: 'release',
  create: 'create',
  cloud: 'cloud',
  voicestudio: 'voicestudio',
  beatlab: 'beatlab',
  v5: 'v5',
  cover: 'cover',
  local: 'local',
  player: 'player',
  tealvoices: 'tealvoices',
  teal: 'tealvoices',
}

const SIDEBAR_GROUPS = [
  {
    title: 'Start',
    items: [{ id: 'portal', label: 'Portal & guide', hint: 'API health · quick links' }],
  },
  {
    title: 'Release & reach',
    items: [{ id: 'release', label: 'Sell & share', hint: 'SEO pack · DSPs · social' }],
  },
  {
    title: 'Make music (Mureka)',
    items: [
      { id: 'create', label: 'Create', hint: 'Step flow · main generator' },
      { id: 'cloud', label: 'Cloud', hint: 'Lyrics panel · same engine' },
      { id: 'voicestudio', label: 'Voice studio', hint: 'Beat + Mureka vocal' },
      { id: 'tealvoices', label: 'Teal Voices', hint: 'Lyrics → backend WAV (Coqui / fallback)' },
    ],
  },
  {
    title: 'Labs & tools',
    items: [
      { id: 'beatlab', label: 'Beat lab', hint: 'Pipeline & master' },
      { id: 'local', label: 'Local', hint: 'Beat + draft stems' },
      { id: 'v5', label: 'V5', hint: 'Alt studio' },
      { id: 'cover', label: 'Cover', hint: 'Stems & cover DSP' },
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
  const [anthropicKey, setAnthropicKey] = useState(() => localStorage.getItem('anthropic_api_key') || '')
  const [apiBase, setApiBase] = useState(() => dieterInitialApiBase())
  const [showAuth, setShowAuth] = useState(false)
  const [status, setStatus] = useState('')
  const [err, setErr] = useState('')
  const [runtimeMode, setRuntimeMode] = useState('self-run')
  const [audioUrl, setAudioUrl] = useState('')
  const [lyricsBusy, setLyricsBusy] = useState(false)
  const [procBusy, setProcBusy] = useState(false)
  const [lyricsReport, setLyricsReport] = useState(null)
  const [lyricsAnalyzeErr, setLyricsAnalyzeErr] = useState('')
  const [studioPulse, setStudioPulse] = useState(null)
  const [playerTrack, setPlayerTrack] = useState(null)
  const canvasRef = useRef(null)
  const audioRef = useRef(null)
  const sessionStartedAt = useRef(Date.now())
  const [sessionTick, setSessionTick] = useState(0)

  useBeatVisualizer(audioRef, canvasRef, audioUrl)

  useEffect(() => {
    const id = window.setInterval(() => setSessionTick((n) => n + 1), 1000)
    return () => window.clearInterval(id)
  }, [])

  void sessionTick
  const wallClock = new Date().toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  })
  const sessionElapsedSec = Math.floor((Date.now() - sessionStartedAt.current) / 1000)

  const saveAuth = () => {
    localStorage.setItem('mureka_api_key', apiKey.trim())
    localStorage.setItem('openai_api_key', openaiKey.trim())
    localStorage.setItem('anthropic_api_key', anthropicKey.trim())
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

  const openPlayer = useCallback(
    ({ url, lyrics: lyricsText = '', title: trackTitle = '' }) => {
      if (!url) return
      setPlayerTrack({
        url,
        lyrics: lyricsText || lyrics || '',
        title: trackTitle || title || 'Generated track',
      })
      goMode('player')
    },
    [goMode, lyrics, title],
  )

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
            body: JSON.stringify({ lyrics: text, bpm: null, beatsPerBar: 4 }),
          })
          const j = await parseFetchJson(r)
          if (!cancelled && j) setLyricsReport(j)
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
      const anthropicOpt = anthropicKey.trim() || undefined
      let text
      let source
      if (USE_TRPC) {
        const r = await trpc.lyricsGenerate.mutate({
          style,
          title,
          vocal,
          openaiApiKey: keyOpt,
          anthropicApiKey: anthropicOpt,
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
            anthropicApiKey: anthropicOpt,
          }),
        })
        const j = await parseFetchJson(r)
        text = j?.text ?? ''
        source = j?.source ?? 'local'
      }
      setLyrics(text)
      void postStudioGrowth(base, 'lyrics_generated', source || 'lyrics')
      setStatus(
        source === 'openai'
          ? 'Lyrics generated (OpenAI via backend). Edit, Optimize, then Create.'
          : source === 'anthropic'
            ? 'Lyrics generated (Claude via backend). Edit, Optimize, then Create.'
            : 'Lyrics generated (local template on server). Set OPENAI_API_KEY or ANTHROPIC_API_KEY on FastAPI, or add optional keys below.',
      )
    } catch (e) {
      const fallback = generateLyricsLocal(style, title, vocal)
      setLyrics(fallback)
      setErr(`Backend: ${e?.message || e} — browser fallback template.`)
      setStatus('Could not reach lyrics API; using local template.')
    } finally {
      setLyricsBusy(false)
    }
  }, [instrumental, openaiKey, anthropicKey, style, title, vocal, base])

  const handleOptimizeLyrics = useCallback(async () => {
    if (instrumental || !lyrics.trim()) {
      setErr('Add lyrics first, or turn off Instrumental.')
      return
    }
    setLyricsBusy(true)
    setErr('')
    try {
      const keyOpt = openaiKey.trim() || undefined
      const anthropicOpt = anthropicKey.trim() || undefined
      let text
      let source
      if (USE_TRPC) {
        const r = await trpc.lyricsOptimize.mutate({
          lyrics: lyrics.trim(),
          openaiApiKey: keyOpt,
          anthropicApiKey: anthropicOpt,
        })
        text = r.text
        source = r.source
      } else {
        const r = await fetch(`${base}/lyrics/optimize`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lyrics: lyrics.trim(),
            openaiApiKey: keyOpt,
            anthropicApiKey: anthropicOpt,
          }),
        })
        const j = await parseFetchJson(r)
        text = j?.text ?? ''
        source = j?.source ?? 'local'
      }
      setLyrics(text)
      void postStudioGrowth(base, 'lyrics_optimized', source || 'optimize')
      setStatus(
        source === 'openai'
          ? 'Lyrics optimized (OpenAI via backend). Review and Create when ready.'
          : source === 'anthropic'
            ? 'Lyrics optimized (Claude via backend). Review and Create when ready.'
            : 'Lyrics optimized (local rules on server). Add OPENAI_API_KEY or ANTHROPIC_API_KEY, or paste keys below.',
      )
    } catch (e) {
      setLyrics(optimizeLyricsLocal(lyrics))
      setErr(`Backend: ${e?.message || e} — optimized in browser.`)
      setStatus('Could not reach lyrics API; used local optimizer.')
    } finally {
      setLyricsBusy(false)
    }
  }, [instrumental, openaiKey, anthropicKey, lyrics, base])

  /** Procedural multitrack WAV from the DIETER engine (FastAPI job); uses tRPC when enabled — real .wav mix + stems on disk. */
  const runProceduralWav = useCallback(async (mode = 'self-run') => {
    setErr('')
    setProcBusy(true)
    setRuntimeMode(mode)
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
      USE_TRPC
        ? 'Generating draft WAV (procedural vocal stem) via tRPC…'
        : 'Generating draft WAV (procedural vocal stem) via REST…',
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
          setStatus(
            'Draft procedural mix ready (lossless WAV). Vocal stem uses a simple synthesized timbre—not Mureka’s trained singers. For real voice, use Create with Mureka.',
          )
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

  const submit = useCallback(async () => {
    setErr('')
    setStatus('')
    if (!apiKey.trim()) {
      setStatus('No external key found. Running built-in engine in fallback mode…')
      await runProceduralWav('fallback')
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
    setRuntimeMode('external')
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
        j = await withMurekaRetries(
          async () => {
            const r = await fetch(`${base}/mureka/song/generate`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${key}`,
              },
              body: JSON.stringify({ lyrics: lyricPayload, model: 'auto', prompt }),
            })
            return parseFetchJson(r)
          },
          { attempts: 4, baseMs: 800 },
        )
      }
      if (!j || typeof j !== 'object') throw new Error('Invalid or empty response from Mureka (generate). Check gateway logs.')
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
          qj = await parseFetchJson(q)
        }
        if (!qj || typeof qj !== 'object') {
          await new Promise((res) => setTimeout(res, 2000))
          continue
        }
        const url = extractAudioUrl(qj)
        if (url) {
          setAudioUrl(url)
          void postStudioGrowth(base, 'mureka_song_ready', taskId)
          void fetchStudioGrowth(base).then((g) => g && setStudioPulse(g))
          setStatus('Ready — Mureka render (real model vocals). Press play.')
          setRuntimeMode('external')
          return
        }
        const st = (qj.status || qj.state || '').toString().toLowerCase()
        if (st.includes('fail') || st.includes('error'))
          throw new Error(JSON.stringify(qj.error || qj))
        await new Promise((res) => setTimeout(res, 2000))
      }
      throw new Error('Timeout waiting for Mureka')
    } catch (e) {
      const why = String(e?.message || e)
      setErr(`${why} — external failed; falling back to built-in engine.`)
      setStatus('External provider unavailable. Running internal engine now…')
      await runProceduralWav('fallback')
    }
  }, [apiKey, base, instrumental, lyrics, runProceduralWav, style, title, vocal])

  const submitProceduralWav = useCallback(async () => {
    await runProceduralWav('self-run')
  }, [runProceduralWav])

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
    appMode === 'tealvoices' ||
    appMode === 'portal' ||
    appMode === 'release'

  const runtimeModeLabel =
    runtimeMode === 'external' ? 'External' : runtimeMode === 'fallback' ? 'Fallback' : 'Self-Run'

  return (
    <div className="app">
      <div className="app-shell">
        <aside className="app-sidebar" aria-label="Studio navigation">
          <div className="sidebar-brand">
            <span className="sidebar-brand-title">{STUDIO_NAME}</span>
            <span className="sidebar-brand-sub">{MUREKA_CLONE_LABEL}</span>
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
                    aria-current={appMode === item.id ? 'page' : undefined}
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
            <a className="sidebar-linkout" href="/ed-geerdes-studio-guide.html" target="_blank" rel="noreferrer">
              Studio guide (offline doc) ↗
            </a>
            <a className="sidebar-linkout" href="/dieter-app-map.html" target="_blank" rel="noreferrer">
              App map &amp; performance ↗
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
            <nav className="nav-main nav-main--stack" aria-label="Current workspace">
              <strong className="nav-main-title">{APP_MODE_HEADER[appMode] ?? 'Studio'}</strong>
              <p className="header-driven-sub">{APP_MODE_SUB[appMode] ?? ''}</p>
            </nav>
            <div className="header-clocks" aria-live="polite">
              <span className="header-clock" title="Your device local time">
                {wallClock}
              </span>
              <span className="header-session" title="Time since this tab loaded (resets on refresh)">
                Session {formatSessionSeconds(sessionElapsedSec)}
              </span>
            </div>
          </header>

          <StudioJourneyStrip
            mode={appMode}
            hasMurekaKey={Boolean(apiKey?.trim())}
            onOpenKeys={() => setShowAuth(true)}
            onGoCreate={() => goMode('create')}
          />

          <div className="app-main-body">
      {showAuth && (
        <div className="modal" role="dialog">
          <div className="modal-bg" onClick={() => setShowAuth(false)} aria-hidden />
          <div className="modal-card">
            <h2>Connections — step 1</h2>
            <p className="hint">
              This is your <strong>connection panel</strong> (start every Mureka session here or via server env). For
              split UI, the app talks to Mureka through
              same‑origin <code>/api/mureka/*</code> (serverless). Add a key from{' '}
              <a href="https://platform.mureka.ai" target="_blank" rel="noreferrer">
                platform.mureka.ai
              </a>{' '}
              and you’re ready to generate.
              <br />
              <strong>Tip:</strong> for best security, store <code>MUREKA_API_KEY</code> in Vercel Environment Variables
              so you don’t need to paste it into the browser.
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
            <label>Anthropic API key (optional — Claude)</label>
            <input
              type="password"
              value={anthropicKey}
              onChange={(e) => setAnthropicKey(e.target.value)}
              autoComplete="off"
              placeholder="sk-ant-… — same Cloud tab lyrics; server tries OpenAI first by default"
            />
            <details style={{ marginTop: 10 }}>
              <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Advanced (optional)</summary>
              <p className="hint" style={{ marginTop: 8 }}>
                Only use this if you run a private backend for DSP tools (covers, stem mixing, etc.). Most users can leave
                it alone on Vercel.
              </p>
              <label>API base (advanced)</label>
              <input
                type="text"
                value={apiBase}
                onChange={(e) => setApiBase(e.target.value)}
                placeholder="/api or https://your-api.com"
              />
            </details>
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
      ) : appMode === 'release' ? (
        <ReleaseMarketing apiBase={base} />
      ) : appMode === 'create' ? (
        <MurekaPromptStudio
          apiBase={base}
          apiKey={apiKey}
          onSongReady={openPlayer}
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
          <StudioV5 apiBase={base} onSongReady={openPlayer} />
        </main>
      ) : appMode === 'cover' ? (
        <main className="main main-local">
          <CoverStudio apiBase={base} />
        </main>
      ) : appMode === 'player' ? (
        <SongPlaybackPage track={playerTrack} onBackToCreate={() => goMode('create')} />
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
          <VoiceCloneStudio apiBase={base} onSongReady={openPlayer} />
        </main>
      ) : appMode === 'tealvoices' ? (
        <main className="main main-local main-teal-voices">
          <TealVoicesStudio apiBase={base} />
        </main>
      ) : (
        <>
      <main className="main">
        <p className="workflow-intro">
          <strong>Workflow:</strong> write your own lyrics or use <strong>Generate Lyrics</strong>, refine with{' '}
          <strong>Optimize</strong>, pick <strong>vocal gender</strong> and <strong>style</strong>.{' '}
          <strong>Create</strong> calls <strong>Mureka</strong> so your words become a real model-generated vocal—not a
          toy browser synth. <strong>Instrumental:</strong> leave lyrics blank or use the checkbox. (For beat tests on the
          server without Mureka, use the labeled <strong>draft</strong> button—it uses a placeholder vocal stem.)
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
          <strong>Draft only (no Mureka):</strong> multitrack <code>.wav</code> on the API (
          {USE_TRPC ? 'tRPC' : 'REST'}) using a <strong>procedural</strong> vocal stem for timing checks—not the same as
          Mureka’s trained singers. Use <strong>Create</strong> above for real vocals from your lyrics.
        </p>
        <button type="button" className="btn-secondary wide" disabled={procBusy} onClick={submitProceduralWav}>
          {procBusy ? '…' : 'Generate draft WAV (procedural vocal only)'}
        </button>
        <p className={`runtime-mode runtime-mode-${runtimeMode}`}>
          Runtime mode: <strong>{runtimeModeLabel}</strong>
        </p>
        {status && <p className="ok">{status}</p>}
        {err && <p className="bad">{err}</p>}

        {!audioUrl && <div className="empty">No audio yet — fill the form and press Create.</div>}

        {audioUrl && (
          <>
            <AudioTransport
              audioRef={audioRef}
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
          <a className="footer-link" href="#release" onClick={(e) => { e.preventDefault(); goMode('release') }}>
            Sell &amp; share
          </a>
          {' · '}
            <a className="footer-link" href="/ed-geerdes-platform.html">
            ED-GEERDES showroom
          </a>
          {' · '}
          <a className="footer-link" href="/ed-geerdes-studio-guide.html" target="_blank" rel="noreferrer">
            Studio guide
          </a>
        </div>
      </footer>
        </div>
      </div>
    </div>
  )
}
