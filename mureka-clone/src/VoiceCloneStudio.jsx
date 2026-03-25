import { useCallback, useEffect, useMemo, useState } from 'react'
import './VoiceCloneStudio.css'
import { IconDownload, IconMic, IconMusic, IconRefresh, IconSpark } from './UiIcons.jsx'
import { absoluteFromApiPath, postStudioGrowth } from './apiResolve.js'
import {
  openMurekaCreate,
  openMurekaLibrary,
  openMurekaPlatformDocs,
  syncMurekaPortalDraft,
} from './murekaPortalSync.js'
import { STUDIO_NAME } from './studioBrand.js'

/** Match BeatLab: host-only bases get `/api`. */
function normalizeApiRoot(raw) {
  const r = (raw || '/api').trim().replace(/\/$/, '')
  if (r === '/api' || r.endsWith('/api')) return r
  return `${r}/api`
}

function isStatusError(msg) {
  return /failed|error|invalid|timeout|refused|404|500|503|502|504/i.test(msg || '')
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
export default function VoiceCloneStudio({ apiBase }) {
  const [step, setStep] = useState(1)
  const [voiceId, setVoiceId] = useState(null)
  const [lyrics, setLyrics] = useState('')
  const [beatFile, setBeatFile] = useState(null)
  const [murekaStyle, setMurekaStyle] = useState('pop')
  const [songUrl, setSongUrl] = useState(null)
  const [status, setStatus] = useState('')
  const [stubMessage, setStubMessage] = useState('')
  const [beatPreviewUrl, setBeatPreviewUrl] = useState(null)

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

    const res = await fetch(`${apiRoot}/pure-song-mureka`, {
      method: 'POST',
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
  }, [apiRoot, beatFile, lyrics, murekaStyle])

  const generateSong = useCallback(async () => {
    if (!lyrics.trim() || !beatFile) {
      alert('Add lyrics and a beat file.')
      return
    }

    setStatus('Mureka is generating vocals — then we mix with your beat…')
    setStubMessage('')
    setStep(3)

    try {
      const data = await runMurekaBeatMix()
      const url = data.song_url || data.song || data.audio_url || null
      const message = data.message || ''
      const resolvedUrl = url ? absoluteFromApiPath(apiRoot, url) : null
      setSongUrl(resolvedUrl || beatPreviewUrl || null)
      setStubMessage(message)
      setStep(4)
      void postStudioGrowth(apiRoot, 'mureka_song_ready', 'voice_studio_pure_song')
      setStatus(
        resolvedUrl
          ? 'Your Mureka vocal mix is ready.'
          : beatPreviewUrl
            ? 'No mix URL returned — beat preview only. Check MUREKA_API_KEY on the server.'
            : 'Request finished — no audio URL yet.',
      )
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
  }, [apiRoot, beatFile, beatPreviewUrl, lyrics, runMurekaBeatMix])

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
    <div className="studio">
      <div className="header">
        <h1>
          <span className="brand-mark">{STUDIO_NAME}</span>
          <span className="brand-sub">Voice · Mureka</span>
        </h1>
        <div className="step-indicator">
          <span className={step === 1 ? 'active' : ''}>1 · Mureka link</span>
          <span className={step === 2 ? 'active' : ''}>2 · Beat + lyrics</span>
          <span className={step === 3 ? 'active' : ''}>3 · Generate</span>
          <span className={step === 4 ? 'active' : ''}>4 · Download</span>
        </div>
      </div>

      {step === 1 && (
        <div className="voice-portal-panel">
          <p className="voice-portal-lead">
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
            className="upload-zone upload-zone--optional"
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
        <div className="song-creator">
          <div className="voice-preview">
            <h3 className="voice-preview__title">
              <IconSpark className="voice-preview__icon" aria-hidden />
              {voiceId ? `Profile · ${String(voiceId).slice(0, 12)}…` : 'Mureka vocal mix'}
            </h3>
            <p className="stub-note">Beat preview:</p>
            {beatPreviewUrl ? (
              <audio controls src={beatPreviewUrl} />
            ) : (
              <p className="stub-note">Upload a beat below.</p>
            )}
          </div>

          <div className="mureka-style-row">
            <span className="mureka-style-label">Vocal style (Mureka prompt)</span>
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

          <textarea
            value={lyrics}
            onChange={(e) => setLyrics(e.target.value)}
            placeholder="Lyrics for Mureka to sing…"
          />

          <div className="file-row">
            <label>
              Beat file (instrumental):{' '}
              <input
                type="file"
                accept="audio/*"
                onChange={(e) => setBeatFile(e.target.files?.[0] || null)}
              />
            </label>
          </div>

          <div className="voice-row-back">
            <button type="button" className="generate generate--ghost" onClick={() => setStep(1)}>
              ← Mureka portal
            </button>
          </div>

          <button type="button" className="generate" onClick={generateSong}>
            <IconMusic className="btn-icon" aria-hidden />
            Generate with Mureka vocals + beat
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="loading">
          <div className="spinner" />
          <p>{status}</p>
        </div>
      )}

      {step === 4 && (
        <div className="song-result">
          {songUrl ? (
            <>
              <audio controls src={songUrl} crossOrigin="anonymous" />
              <a href={songUrl} download className="download-link">
                <IconDownload className="btn-icon" aria-hidden />
                Download
              </a>
            </>
          ) : (
            <p className="stub-note">{stubMessage || status}</p>
          )}
          {stubMessage && songUrl && <p className="stub-note">{stubMessage}</p>}
          <button
            type="button"
            className="generate generate--ghost"
            style={{ marginTop: 16 }}
            onClick={resetAll}
          >
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
