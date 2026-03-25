import { useCallback, useEffect, useMemo, useState } from 'react'
import './VoiceCloneStudio.css'
import { IconDownload, IconMic, IconMusic, IconRefresh, IconSpark } from './UiIcons.jsx'
import { absoluteFromApiPath, postStudioGrowth } from './apiResolve.js'
import { AudioTransportLocal } from './AudioTransport.jsx'
import {
  openMurekaCreate,
  openMurekaLibrary,
  openMurekaPlatformDocs,
  syncMurekaPortalDraft,
} from './murekaPortalSync.js'
import { STUDIO_NAME } from './studioBrand.js'
import { loadVoiceVault, pushVoiceVault, replaceVoiceVault } from './voiceSongVault.js'

/** Match BeatLab: host-only bases get `/api`. */
function normalizeApiRoot(raw) {
  const r = (raw || '/api').trim().replace(/\/$/, '')
  if (r === '/api' || r.endsWith('/api')) return r
  return `${r}/api`
}

function isStatusError(msg) {
  return /failed|error|invalid|timeout|refused|404|500|503|502|504/i.test(msg || '')
}

function formatSavedAt(ts) {
  if (!ts) return ''
  try {
    return new Date(ts).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return ''
  }
}

const MUREKA_STYLE_CHIPS = [
  { id: 'pop', label: 'Pop' },
  { id: 'rap', label: 'Rap / hip-hop' },
  { id: 'edm', label: 'EDM' },
  { id: 'rnb', label: 'R&B' },
]

/**
 * **Mureka-first:** real AI vocals via `POST /api/pure-song-mureka` (server `MUREKA_API_KEY`)
 * mixed with your beat. Optional voice sample registers an offline fingerprint only (not Mureka cloning).
 */
export default function VoiceCloneStudio({ apiBase, onSongReady }) {
  const [step, setStep] = useState(1)
  const [voiceId, setVoiceId] = useState(null)
  const [lyrics, setLyrics] = useState('')
  const [beatFile, setBeatFile] = useState(null)
  const [murekaStyle, setMurekaStyle] = useState('pop')
  const [songUrl, setSongUrl] = useState(null)
  const [status, setStatus] = useState('')
  const [stubMessage, setStubMessage] = useState('')
  const [beatPreviewUrl, setBeatPreviewUrl] = useState(null)
  const [murekaKey, setMurekaKey] = useState(() => localStorage.getItem('mureka_api_key') || '')
  const [savedSongs, setSavedSongs] = useState(() => loadVoiceVault())

  const apiRoot = useMemo(() => normalizeApiRoot(apiBase || '/api'), [apiBase])

  useEffect(() => {
    if (!beatFile) {
      setBeatPreviewUrl(null)
      return undefined
    }
    const u = URL.createObjectURL(beatFile)
    setBeatPreviewUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [beatFile])

  const rememberSong = useCallback(
    (url, title, extra = {}) => {
      if (!url) return
      const next = pushVoiceVault({
        url,
        title: title || `${STUDIO_NAME} Voice`,
        lyricsPreview: (lyrics || '').trim().slice(0, 160),
        style: murekaStyle,
        ...extra,
      })
      setSavedSongs(next)
    },
    [lyrics, murekaStyle],
  )

  const removeSaved = useCallback((id) => {
    const next = savedSongs.filter((s) => s.id !== id)
    setSavedSongs(next)
    replaceVoiceVault(next)
  }, [savedSongs])

  const loadSavedIntoPlayer = useCallback((row) => {
    if (!row?.url) return
    setSongUrl(row.url)
    setStubMessage('')
    setStep(4)
  }, [])

  const pushPortalAndOpen = useCallback(() => {
    syncMurekaPortalDraft({
      title: '',
      style: murekaStyle,
      lyrics: lyrics.trim(),
      vocal: 'female',
      instrumental: false,
    })
    openMurekaCreate()
  }, [lyrics, murekaStyle])

  const cloneVoice = useCallback(
    async (audioFile) => {
      if (!audioFile || !audioFile.size) {
        setStatus('Choose an audio file first.')
        return
      }

      setStatus('Registering optional offline voice fingerprint…')
      setStep(3)

      const formData = new FormData()
      formData.append('voice_sample', audioFile)
      formData.append('voice_name', 'Custom Voice')

      try {
        const response = await fetch(`${apiRoot}/mureka/clone`, {
          method: 'POST',
          body: formData,
        })
        const text = await response.text()
        let data = {}
        try {
          data = text ? JSON.parse(text) : {}
        } catch {
          throw new Error(text || 'Invalid JSON')
        }
        if (!response.ok) {
          throw new Error(typeof data.detail === 'string' ? data.detail : text || response.statusText)
        }

        if (data.voice_id) {
          setVoiceId(data.voice_id)
          setStatus(`Optional profile saved · ${String(data.voice_id).slice(0, 12)}… (Mureka voices: platform.mureka.ai)`)
          void postStudioGrowth(apiRoot, 'voice_clone', String(data.voice_id).slice(0, 80))
          setStep(2)
        } else {
          throw new Error('No voice_id in response')
        }
      } catch (error) {
        setStatus(`${error.message || 'Registration failed'}. You can still continue without it.`)
        setStep(1)
      }
    },
    [apiRoot],
  )

  const onDropZone = useCallback(
    (e) => {
      e.preventDefault()
      e.currentTarget.classList.remove('dragover')
      const f = e.dataTransfer.files?.[0]
      if (f) cloneVoice(f)
    },
    [cloneVoice],
  )

  const runMurekaBeatMix = useCallback(async () => {
    const fd = new FormData()
    fd.append('beat', beatFile)
    fd.append('lyrics', lyrics.trim())
    fd.append('mureka_style', murekaStyle)

    const headers = {}
    const key = (murekaKey || '').trim()
    if (key) headers.Authorization = `Bearer ${key}`
    const res = await fetch(`${apiRoot}/pure-song-mureka`, {
      method: 'POST',
      headers,
      body: fd,
    })
    const text = await res.text()
    let data = {}
    try {
      data = text ? JSON.parse(text) : {}
    } catch {
      throw new Error(text || 'Invalid JSON from /api/pure-song-mureka')
    }
    if (!res.ok) {
      const d = data.detail
      const msg = typeof d === 'string' ? d : Array.isArray(d) ? d.map((x) => x.msg).join('; ') : text
      throw new Error(msg || res.statusText || `HTTP ${res.status}`)
    }
    return data
  }, [apiRoot, beatFile, lyrics, murekaKey, murekaStyle])

  const runMurekaCloudOnly = useCallback(async () => {
    const key = (murekaKey || '').trim() || (localStorage.getItem('mureka_api_key') || '').trim()
    if (!key) throw new Error('Add your Mureka key in Connections.')
    const prompt = `Musical style / production: ${murekaStyle}\n\n${
      lyrics.trim() ? `Lyrics to perform:\n${lyrics.trim()}` : 'Write a memorable topline and lyrics matching the style.'
    }\n\nLead vocal: female.`
    const start = await fetch(`${apiRoot}/mureka/song/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ lyrics: lyrics.trim(), model: 'auto', prompt }),
    })
    const sj = await start.text()
    if (!start.ok) throw new Error(sj || start.statusText)
    const s = sj ? JSON.parse(sj) : {}
    const taskId = String(s.id || s.task_id || s.taskId || '')
    if (!taskId) throw new Error('No task id from Mureka')
    for (let i = 0; i < 90; i++) {
      const q = await fetch(`${apiRoot}/mureka/song/query/${encodeURIComponent(taskId)}`, {
        headers: { Authorization: `Bearer ${key}` },
      })
      const tj = await q.text()
      if (!q.ok) throw new Error(tj || q.statusText)
      const qj = tj ? JSON.parse(tj) : {}
      const url = qj.audio_url || qj.mp3_url || qj.url || null
      if (typeof url === 'string' && url.startsWith('http')) return { url, taskId }
      await new Promise((r) => setTimeout(r, 2000))
    }
    throw new Error('Timeout waiting for Mureka')
  }, [apiRoot, lyrics, murekaKey, murekaStyle])

  const generateVoiceOnlyCloud = useCallback(async () => {
    if (!lyrics.trim()) {
      setStatus('Add lyrics first.')
      return
    }
    const key = (murekaKey || '').trim() || (localStorage.getItem('mureka_api_key') || '').trim()
    if (!key) {
      setStatus('Paste your Mureka API key below or save one in Connections.')
      return
    }
    setStatus('Generating full song on Mureka (no beat upload)…')
    setStubMessage('')
    setStep(3)
    try {
      const out = await runMurekaCloudOnly()
      const title = `${STUDIO_NAME} · Mureka cloud`
      setSongUrl(out.url)
      rememberSong(out.url, title, { source: 'mureka_cloud', taskId: out.taskId })
      onSongReady?.({ url: out.url, lyrics: lyrics.trim(), title })
      setStep(4)
      void postStudioGrowth(apiRoot, 'mureka_song_ready', `voice_cloud:${out.taskId}`.slice(0, 80))
      setStatus('Ready — saved to your library in this browser.')
    } catch (error) {
      const m = error.message || 'Generation failed'
      setStatus(m)
      setStubMessage(
        /MUREKA|503|401/i.test(m)
          ? `Confirm API key and that ${STUDIO_NAME} can reach Mureka (server env or Vercel routes).`
          : '',
      )
      setStep(2)
    }
  }, [apiRoot, lyrics, murekaKey, onSongReady, rememberSong, runMurekaCloudOnly])

  const generateSong = useCallback(async () => {
    if (!lyrics.trim() || !beatFile) {
      setStatus('Add lyrics and a beat WAV/MP3, or use “Full song on Mureka” below without a beat.')
      return
    }

    setStatus('Generating…')
    setStubMessage('')
    setStep(3)

    try {
      try {
        setStatus('Generating vocals + mixing with your beat…')
        const data = await runMurekaBeatMix()
        const url = data.song_url || data.song || data.audio_url || null
        const message = data.message || ''
        const resolvedUrl = url ? absoluteFromApiPath(apiRoot, url) : null
        const finalUrl = resolvedUrl || beatPreviewUrl || null
        setSongUrl(finalUrl)
        const title = `${STUDIO_NAME} · Beat mix`
        if (finalUrl) {
          rememberSong(finalUrl, title, { source: 'beat_mix' })
          onSongReady?.({ url: finalUrl, lyrics: lyrics.trim(), title })
        }
        setStubMessage(message)
        setStep(4)
        void postStudioGrowth(apiRoot, 'mureka_song_ready', 'voice_studio_mix')
        setStatus(resolvedUrl ? 'Your track is ready and saved locally.' : 'Finished — no mix URL returned.')
      } catch (e) {
        const msg = String(e?.message || e)
        if (/404|not found|pure-song-mureka/i.test(msg)) {
          setStatus('Beat-mix route missing — generating a full track on Mureka instead…')
          const out = await runMurekaCloudOnly()
          const title = `${STUDIO_NAME} · Cloud (fallback)`
          setSongUrl(out.url)
          rememberSong(out.url, title, { source: 'mureka_cloud_fallback', taskId: out.taskId })
          onSongReady?.({ url: out.url, lyrics: lyrics.trim(), title })
          setStep(4)
          void postStudioGrowth(apiRoot, 'mureka_song_ready', `voice_cloud:${out.taskId}`.slice(0, 80))
          setStatus('Ready — cloud track. Saved in your library.')
        } else {
          throw e
        }
      }
    } catch (error) {
      const m = error.message || 'Generation failed'
      setStatus(m)
      setStubMessage(
        /MUREKA_API_KEY|503/i.test(m)
          ? `Add MUREKA_API_KEY to your ${STUDIO_NAME} API host (Render/Docker). Or open Mureka in the browser and finish the track there.`
          : '',
      )
      setStep(2)
    }
  }, [apiRoot, beatFile, beatPreviewUrl, lyrics, onSongReady, rememberSong, runMurekaBeatMix, runMurekaCloudOnly])

  const statusClass = `status${isStatusError(status) ? ' status--bad' : ''}`

  const resetAll = () => {
    setStep(1)
    setVoiceId(null)
    setBeatFile(null)
    setLyrics('')
    setSongUrl(null)
    setStatus('')
    setStubMessage('')
  }

  return (
    <div className="studio studio--immersive">
      <div className="header immersive-header">
        <h1>
          <span className="brand-mark">{STUDIO_NAME}</span>
          <span className="brand-sub">Voice · Mureka</span>
        </h1>
        <div className="step-indicator immersive-steps">
          <span className={step === 1 ? 'active' : ''}>1 · Link</span>
          <span className={step === 2 ? 'active' : ''}>2 · Craft</span>
          <span className={step === 3 ? 'active' : ''}>3 · Render</span>
          <span className={step === 4 ? 'active' : ''}>4 · Listen</span>
        </div>
      </div>

      {savedSongs.length > 0 && (
        <section className="voice-vault immersive-panel" aria-label="Saved voice tracks">
          <div className="voice-vault__head">
            <h2 className="voice-vault__title">Your library · this browser</h2>
            <p className="voice-vault__sub">Replay or download past renders. Stored only on your device.</p>
          </div>
          <div className="voice-vault__grid">
            {savedSongs.map((row) => (
              <article key={row.id} className="vault-card">
                <div className="vault-card__meta">
                  <strong className="vault-card__title">{row.title || 'Voice track'}</strong>
                  <span className="vault-card__date">{formatSavedAt(row.savedAt)}</span>
                </div>
                {row.lyricsPreview ? <p className="vault-card__lyric">{row.lyricsPreview}{row.lyricsPreview.length >= 160 ? '…' : ''}</p> : null}
                <div className="vault-card__actions">
                  <button type="button" className="vault-chip" onClick={() => loadSavedIntoPlayer(row)}>
                    Play here
                  </button>
                  <button
                    type="button"
                    className="vault-chip vault-chip--ghost"
                    onClick={() =>
                      onSongReady?.({
                        url: row.url,
                        lyrics: row.lyricsPreview || '',
                        title: row.title || `${STUDIO_NAME} Voice`,
                      })
                    }
                  >
                    Full player
                  </button>
                  <a className="vault-chip vault-chip--link" href={row.url} download target="_blank" rel="noreferrer">
                    Download
                  </a>
                  <button type="button" className="vault-chip vault-chip--danger" onClick={() => removeSaved(row.id)}>
                    Remove
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {step === 1 && (
        <div className="voice-portal-panel immersive-panel voice-portal-panel--glow">
          <p className="voice-portal-lead immersive-lead">
            <strong>Real AI vocals</strong> run on <strong>Mureka</strong>. This lab calls their API on your server
            (needs <code>MUREKA_API_KEY</code>), then mixes the result with <em>your</em> instrumental. Custom singing
            voices are created on{' '}
            <a href="https://platform.mureka.ai" target="_blank" rel="noreferrer">
              platform.mureka.ai
            </a>
            .
          </p>
          <div className="voice-portal-actions">
            <button type="button" className="voice-portal-btn voice-portal-btn--primary" onClick={pushPortalAndOpen}>
              Sync draft &amp; open Mureka Create
            </button>
            <button type="button" className="voice-portal-btn" onClick={openMurekaCreate}>
              Mureka Create
            </button>
            <button type="button" className="voice-portal-btn" onClick={openMurekaLibrary}>
              Mureka Library
            </button>
            <button type="button" className="voice-portal-btn voice-portal-btn--ghost" onClick={openMurekaPlatformDocs}>
              API docs
            </button>
          </div>
          <button type="button" className="voice-continue-btn" onClick={() => setStep(2)}>
            Continue → beat + lyrics
          </button>

          <div
            className="upload-zone upload-zone--optional immersive-dropzone"
            onDrop={onDropZone}
            onDragOver={(e) => {
              e.preventDefault()
              e.currentTarget.classList.add('dragover')
            }}
            onDragLeave={(e) => e.currentTarget.classList.remove('dragover')}
          >
            <div className="mic-circle" aria-hidden>
              <IconMic className="mic-circle__icon" />
            </div>
            <h2>Optional: voice sample</h2>
            <p>~30s speech · For offline {STUDIO_NAME} tools only — not a Mureka voice clone</p>
            <input
              type="file"
              accept="audio/*"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) cloneVoice(f)
              }}
            />
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="song-creator immersive-panel song-creator--wide">
          <div className="voice-preview immersive-inset">
            <h3 className="voice-preview__title">
              <IconSpark className="voice-preview__icon" aria-hidden />
              {voiceId ? `Profile · ${String(voiceId).slice(0, 12)}…` : 'Mureka vocal mix'}
            </h3>
            <p className="stub-note voice-preview__hint">Beat preview</p>
            {beatPreviewUrl ? (
              <AudioTransportLocal src={beatPreviewUrl} className="voice-audio" />
            ) : (
              <p className="stub-note">Upload a beat below — or skip the beat and use cloud-only generation.</p>
            )}
          </div>

          <div className="mureka-style-row">
            <span className="mureka-style-label immersive-label">Vocal style (Mureka prompt)</span>
            <div className="mureka-style-chips voice-style-chips">
              {MUREKA_STYLE_CHIPS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  className={`mureka-style-chip${murekaStyle === id ? ' active' : ''}`}
                  onClick={() => setMurekaStyle(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="immersive-field">
            <label className="immersive-label" htmlFor="voice-mureka-key">
              Mureka API key <span className="immersive-label__muted">(optional if server has MUREKA_API_KEY)</span>
            </label>
            <input
              id="voice-mureka-key"
              className="immersive-input"
              type="password"
              value={murekaKey}
              onChange={(e) => {
                const v = e.target.value
                setMurekaKey(v)
                try {
                  localStorage.setItem('mureka_api_key', v)
                } catch {
                  /* ignore */
                }
              }}
              placeholder="Bearer key — paste or leave blank when proxied"
              autoComplete="off"
            />
          </div>

          <div className="immersive-field">
            <label className="immersive-label" htmlFor="voice-lyrics">
              Lyrics{' '}
              <span className="immersive-label__muted">— lines Mureka will sing</span>
            </label>
            <textarea
              id="voice-lyrics"
              className="immersive-textarea"
              value={lyrics}
              onChange={(e) => setLyrics(e.target.value)}
              placeholder="[Verse]&#10;Your words become the lead vocal…&#10;&#10;[Chorus]&#10;…"
              rows={8}
            />
          </div>

          <div className="immersive-field">
            <label className="immersive-label" htmlFor="voice-beat">
              Beat file <span className="immersive-label__muted">(instrumental WAV / MP3 for mix mode)</span>
            </label>
            <input
              id="voice-beat"
              className="immersive-file"
              type="file"
              accept="audio/*"
              onChange={(e) => setBeatFile(e.target.files?.[0] || null)}
            />
            {beatFile ? (
              <p className="immersive-hint">Selected: {beatFile.name}</p>
            ) : (
              <p className="immersive-hint">Optional if you only use “Full song on Mureka” (cloud).</p>
            )}
          </div>

          <div className="voice-actions-row">
            <button type="button" className="generate generate--ghost" onClick={() => setStep(1)}>
              ← Mureka portal
            </button>
          </div>

          <div className="voice-primary-actions immersive-actions">
            <button type="button" className="generate generate--shine" onClick={generateSong} disabled={!beatFile || !lyrics.trim()}>
              <IconMusic className="btn-icon" aria-hidden />
              Mix: Mureka vocals + your beat
            </button>
            <button
              type="button"
              className="generate generate--aurora"
              onClick={generateVoiceOnlyCloud}
              disabled={!lyrics.trim()}
            >
              <IconMusic className="btn-icon" aria-hidden />
              Full song on Mureka (lyrics only · needs key)
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="loading immersive-loading">
          <div className="spinner" />
          <p className="immersive-loading-text">{status}</p>
        </div>
      )}

      {step === 4 && (
        <div className="song-result immersive-panel song-result--hero">
          {songUrl ? (
            <>
              <AudioTransportLocal src={songUrl} crossOrigin="anonymous" className="voice-audio" />
              <a href={songUrl} download className="download-link immersive-download">
                <IconDownload className="btn-icon" aria-hidden />
                Download file
              </a>
              <p className="immersive-hint">This take is also in <strong>Your library</strong> above.</p>
            </>
          ) : (
            <p className="stub-note">{stubMessage || status}</p>
          )}
          {stubMessage && songUrl ? <p className="stub-note">{stubMessage}</p> : null}
          <button type="button" className="generate generate--ghost immersive-restart" onClick={resetAll}>
            <IconRefresh className="btn-icon" aria-hidden />
            Start over
          </button>
        </div>
      )}

      {step !== 3 && (
        <div className={statusClass} role="status">
          {status}
        </div>
      )}
    </div>
  )
}
