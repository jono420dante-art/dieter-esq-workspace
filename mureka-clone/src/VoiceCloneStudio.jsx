import { useCallback, useEffect, useMemo, useState } from 'react'
import './VoiceCloneStudio.css'
import { IconDownload, IconMic, IconMusic, IconRefresh, IconSpark } from './UiIcons.jsx'
import { absoluteFromApiPath, postStudioGrowth } from './apiResolve.js'

/** Match BeatLab: host-only bases get `/api`. */
function normalizeApiRoot(raw) {
  const r = (raw || '/api').trim().replace(/\/$/, '')
  if (r === '/api' || r.endsWith('/api')) return r
  return `${r}/api`
}

function isStatusError(msg) {
  return /failed|error|invalid|timeout|refused|404|500/i.test(msg || '')
}

/**
 * Multi-step voice clone → lyrics + beat → generate.
 * Backend: POST /api/mureka/clone, POST /api/mureka/generate (stubs until you wire Mureka/RVC).
 */
export default function VoiceCloneStudio({ apiBase }) {
  const [step, setStep] = useState(1)
  const [voiceId, setVoiceId] = useState(null)
  const [lyrics, setLyrics] = useState('')
  const [beatFile, setBeatFile] = useState(null)
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

  const cloneVoice = useCallback(
    async (audioFile) => {
      if (!audioFile || !audioFile.size) {
        setStatus('Choose an audio file first.')
        return
      }

      setStatus('Cloning your voice…')
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
          setStatus(`Voice registered · ${String(data.voice_id).slice(0, 12)}…`)
          void postStudioGrowth(apiRoot, 'voice_clone', String(data.voice_id).slice(0, 80))
          setStep(2)
        } else {
          throw new Error('No voice_id in response')
        }
      } catch (error) {
        setStatus(`${error.message || 'Cloning failed'}. Try a clear ~30s speech sample.`)
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

  const tryPureSongMureka = useCallback(async () => {
    const fd = new FormData()
    fd.append('beat', beatFile)
    fd.append('lyrics', lyrics.trim())
    fd.append('mureka_style', 'pop')

    const res = await fetch(`${apiRoot}/pure-song-mureka`, {
      method: 'POST',
      body: fd,
    })
    const text = await res.text()
    let data = {}
    try {
      data = text ? JSON.parse(text) : {}
    } catch {
      throw new Error(text || 'Invalid JSON from /pure-song-mureka')
    }
    if (!res.ok) {
      throw new Error(typeof data.detail === 'string' ? data.detail : text || res.statusText)
    }
    return data
  }, [apiRoot, beatFile, lyrics])

  const generateSong = useCallback(async () => {
    if (!lyrics.trim() || !beatFile) {
      alert('Add lyrics and a beat file.')
      return
    }
    if (!voiceId) {
      alert('Clone a voice first.')
      return
    }

    setStatus('Generating your track…')
    setStubMessage('')
    setStep(3)

    const formData = new FormData()
    formData.append('voice_id', voiceId)
    formData.append('lyrics', lyrics.trim())
    formData.append('beat_file', beatFile)

    try {
      const response = await fetch(`${apiRoot}/mureka/generate`, {
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

      let url = data.song_url || data.audio_url || null
      let message = data.message || (data.stub ? 'Backend stub — wire to real pipeline.' : '')

      if (!url && data.stub) {
        setStatus('Primary endpoint returned stub — trying alternate pipeline…')
        try {
          const alt = await tryPureSongMureka()
          url = alt.song_url || alt.song || alt.audio_url || null
          message = alt.message || message
        } catch (e) {
          message = `${message} Alternate call failed: ${e.message || e}`.trim()
        }
      }

      setSongUrl(url ? absoluteFromApiPath(apiRoot, url) : null)
      setStubMessage(message)
      setStep(4)
      setStatus(
        url ? 'Your song is ready.' : 'Request finished — no audio URL yet. Check backend wiring.',
      )
    } catch (error) {
      setStatus(error.message || 'Generation failed')
      setStep(2)
    }
  }, [apiRoot, beatFile, lyrics, tryPureSongMureka, voiceId])

  const statusClass = `status${isStatusError(status) ? ' status--bad' : ''}`

  return (
    <div className="studio">
      <div className="header">
        <h1>
          <span className="brand-mark">Dieter Esq.</span>
          <span className="brand-sub">Voice</span>
        </h1>
        <div className="step-indicator">
          <span className={step === 1 ? 'active' : ''}>1 · Clone</span>
          <span className={step === 2 ? 'active' : ''}>2 · Create</span>
          <span className={step === 3 ? 'active' : ''}>3 · Generate</span>
          <span className={step === 4 ? 'active' : ''}>4 · Download</span>
        </div>
      </div>

      {step === 1 && (
        <div
          className="upload-zone"
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
          <h2>Upload voice sample</h2>
          <p>~30s clear speech · No music in the background</p>
          <input
            type="file"
            accept="audio/*"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) cloneVoice(f)
            }}
          />
        </div>
      )}

      {step === 2 && (
        <div className="song-creator">
          <div className="voice-preview">
            <h3 className="voice-preview__title">
              <IconSpark className="voice-preview__icon" aria-hidden />
              {voiceId ? `${String(voiceId).slice(0, 12)}…` : 'Voice ready'}
            </h3>
            <p className="stub-note">Beat preview (after you choose a file):</p>
            {beatPreviewUrl ? (
              <audio controls src={beatPreviewUrl} />
            ) : (
              <p className="stub-note">No beat yet — upload below.</p>
            )}
          </div>

          <textarea
            value={lyrics}
            onChange={(e) => setLyrics(e.target.value)}
            placeholder="Your lyrics here…"
          />

          <div className="file-row">
            <label>
              Beat file:{' '}
              <input
                type="file"
                accept="audio/*"
                onChange={(e) => setBeatFile(e.target.files?.[0] || null)}
              />
            </label>
          </div>

          <button type="button" className="generate" onClick={generateSong}>
            <IconMusic className="btn-icon" aria-hidden />
            Generate song
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
          <button
            type="button"
            className="generate generate--ghost"
            style={{ marginTop: 16 }}
            onClick={() => {
              setStep(1)
              setVoiceId(null)
              setBeatFile(null)
              setLyrics('')
              setSongUrl(null)
              setStatus('')
              setStubMessage('')
            }}
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
