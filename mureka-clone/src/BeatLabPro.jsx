import { useCallback, useState } from 'react'
import { absoluteFromApiPath, normalizeApiRoot, postStudioGrowth } from './apiResolve.js'

/**
 * Local release pipeline: beat + lyrics → procedural vocal → mix → master (`POST /api/pipeline/generate-master`).
 * Optional: save DistroKid-prep package, FFmpeg waveform video (`/api/local/music-video`).
 */
export default function BeatLabPro({ apiBase }) {
  const base = normalizeApiRoot(apiBase || '/api')
  const [lyrics, setLyrics] = useState('')
  const [titleHint, setTitleHint] = useState('')
  const [beatFile, setBeatFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [status, setStatus] = useState('')
  const [masteredUrl, setMasteredUrl] = useState('')
  const [pipeline, setPipeline] = useState(null)
  const [distroMsg, setDistroMsg] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [autoPrep, setAutoPrep] = useState(true)
  /** After master: FFmpeg showwaves + beat flashes (needs ffmpeg on server). */
  const [autoVideo, setAutoVideo] = useState(true)
  const [videoMsg, setVideoMsg] = useState('')
  /** Fine-tune semitones; combined with optional preset on the server (±12 clamp). */
  const [pitch, setPitch] = useState(0)
  /** Optional: deep_male, male, neutral, female, bright_female — sent as `pitch_preset`. */
  const [pitchPreset, setPitchPreset] = useState('')

  const uploadDistrokidPrep = useCallback(
    async (masterAbsoluteUrl, metadata) => {
      const r = await fetch(masterAbsoluteUrl)
      if (!r.ok) throw new Error(`Could not read master file: ${r.status}`)
      const blob = await r.blob()
      const fd = new FormData()
      fd.append('file', new File([blob], 'master.mp3', { type: blob.type || 'audio/mpeg' }))
      fd.append('metadata_json', JSON.stringify(metadata ?? {}))
      const res = await fetch(`${base}/pipeline/upload-distrokid-prep`, {
        method: 'POST',
        body: fd,
      })
      const text = await res.text()
      if (!res.ok) throw new Error(text || res.statusText)
      return JSON.parse(text)
    },
    [base],
  )

  const generateMusicVideo = useCallback(
    async (masterAbsoluteUrl) => {
      const r = await fetch(masterAbsoluteUrl)
      if (!r.ok) throw new Error(`Could not read master for video: ${r.status}`)
      const blob = await r.blob()
      const fd = new FormData()
      fd.append('file', new File([blob], 'master.mp3', { type: blob.type || 'audio/mpeg' }))
      fd.append('beat_times_json', '[]')
      fd.append('detect_beats', 'true')
      const res = await fetch(`${base}/local/music-video`, { method: 'POST', body: fd })
      const text = await res.text()
      if (!res.ok) throw new Error(text || res.statusText)
      const j = JSON.parse(text)
      const u = j.url
      if (!u) throw new Error('No video url in response')
      setVideoUrl(absoluteFromApiPath(base, u))
      return j
    },
    [base],
  )

  const generateSong = async () => {
    if (!beatFile) {
      setErr('Choose a beat file first.')
      return
    }
    setBusy(true)
    setErr('')
    setStatus('')
    setMasteredUrl('')
    setPipeline(null)
    setDistroMsg('')
    setVideoMsg('')
    setVideoUrl('')
    try {
      const formData = new FormData()
      formData.append('beat', beatFile)
      formData.append('lyrics', lyrics)
      formData.append('pitch_semitones', String(pitch))
      formData.append('pitch_preset', pitchPreset)
      if (titleHint.trim()) formData.append('title_hint', titleHint.trim())

      const res = await fetch(`${base}/pipeline/generate-master`, {
        method: 'POST',
        body: formData,
      })
      const text = await res.text()
      if (!res.ok) throw new Error(text || res.statusText)
      const data = JSON.parse(text)
      const mu = data.masterUrl
      if (!mu) throw new Error('Response missing masterUrl — check FastAPI version')
      const abs = absoluteFromApiPath(base, mu)
      setMasteredUrl(abs)
      setPipeline(data)
      void postStudioGrowth(base, 'master_built', String(data.pipelineId || ''))
      const presetBit =
        data.pitch_preset_applied != null && String(data.pitch_preset_applied).trim() !== ''
          ? ` · preset ${data.pitch_preset_applied}`
          : ''
      const pitchBit =
        data.pitch_semitones != null && Number(data.pitch_semitones) !== 0
          ? ` · vocal pitch ${data.pitch_semitones > 0 ? '+' : ''}${data.pitch_semitones} st`
          : ''
      setStatus(
        `Master ready · pipeline ${data.pipelineId ?? '—'} · ${data.engine ?? 'engine'} @ ${data.bpm ?? '?'} BPM${presetBit}${pitchBit}`,
      )

      if (autoPrep && data.metadata) {
        try {
          const prep = await uploadDistrokidPrep(abs, data.metadata)
          setDistroMsg(prep.message || prep.status || 'Saved under storage/distro_prep/')
        } catch (e) {
          setDistroMsg(`Distro prep failed: ${e.message || e}`)
        }
      }

      if (autoVideo) {
        setStatus('Generating beat-synced video (FFmpeg + librosa beats)…')
        try {
          await generateMusicVideo(abs)
          setVideoMsg('Beat-synced waveform video ready — upload to YouTube/TikTok or edit elsewhere.')
          setStatus(
            `Done · master + ${autoPrep ? 'DistroKid prep · ' : ''}video · pipeline ${data.pipelineId ?? '—'}`,
          )
        } catch (e) {
          const msg = String(e.message || e)
          setVideoMsg(`Video step skipped: ${msg} (install ffmpeg on the API host and retry the button below.)`)
          setStatus(`Master ready — video failed: ${msg.slice(0, 120)}`)
        }
      }
    } catch (e) {
      setErr(String(e.message || e))
    } finally {
      setBusy(false)
    }
  }

  const onPrepAgain = async () => {
    if (!masteredUrl || !pipeline?.metadata) {
      setErr('Generate a master first.')
      return
    }
    setBusy(true)
    setErr('')
    try {
      const prep = await uploadDistrokidPrep(masteredUrl, pipeline.metadata)
      setDistroMsg(prep.message || 'Saved.')
    } catch (e) {
      setErr(String(e.message || e))
    } finally {
      setBusy(false)
    }
  }

  const onVideo = async () => {
    if (!masteredUrl) {
      setErr('Generate a master first.')
      return
    }
    setBusy(true)
    setErr('')
    setStatus('Rendering FFmpeg waveform video…')
    try {
      await generateMusicVideo(masteredUrl)
      setStatus('Waveform video ready (H.264 + AAC).')
    } catch (e) {
      setErr(String(e.message || e))
    } finally {
      setBusy(false)
    }
  }

  const metaJson = pipeline?.metadata ? JSON.stringify(pipeline.metadata, null, 2) : ''

  return (
    <section className="beat-lab-pro suno-style">
      <h2 className="beat-lab-title">AI Music Studio — local pipeline</h2>
      <p className="field-hint">
        Uses <code>POST {base}/pipeline/generate-master</code> on the DIETER FastAPI app (same as Local Studio — typically
        Vite proxy <code>/api</code> → <code>8787</code>). Paste metadata into DistroKid manually; there is no upload
        API.
      </p>

      <label htmlFor="beat-pro-lyrics">Lyrics</label>
      <textarea
        id="beat-pro-lyrics"
        className="beat-lab-textarea"
        rows={5}
        value={lyrics}
        onChange={(e) => setLyrics(e.target.value)}
        placeholder="Drop the bass, feel the rhythm…"
        disabled={busy}
      />

      <label htmlFor="beat-pro-title">Title hint (optional)</label>
      <input
        id="beat-pro-title"
        type="text"
        className="beat-lab-textarea"
        style={{ maxWidth: '100%' }}
        value={titleHint}
        onChange={(e) => setTitleHint(e.target.value)}
        placeholder="Track title for distributor metadata"
        disabled={busy}
      />

      <label htmlFor="beat-pro-file">Beat file</label>
      <input
        id="beat-pro-file"
        type="file"
        accept="audio/*"
        disabled={busy}
        onChange={(e) => setBeatFile(e.target.files?.[0] ?? null)}
      />

      <label htmlFor="beat-pro-pitch-preset">Pitch character (optional)</label>
      <select
        id="beat-pro-pitch-preset"
        className="beat-lab-select"
        value={pitchPreset}
        onChange={(e) => setPitchPreset(e.target.value)}
        disabled={busy}
      >
        <option value="">None (slider only)</option>
        <option value="deep_male">Deep male (-8)</option>
        <option value="male">Male (-4)</option>
        <option value="neutral">Neutral (0)</option>
        <option value="female">Female (+4)</option>
        <option value="bright_female">Bright female (+8)</option>
      </select>
      <p className="field-hint" style={{ marginTop: 0 }}>
        Preset + slider add together; server clamps to ±12 semitones. Uses rubberband (if ffmpeg has it), else librosa.
      </p>

      <label htmlFor="beat-pro-pitch">
        Fine-tune pitch (semitones) <strong>{pitch > 0 ? '+' : ''}{pitch}</strong>
      </label>
      <input
        id="beat-pro-pitch"
        type="range"
        min={-12}
        max={12}
        step={1}
        value={pitch}
        disabled={busy}
        onChange={(e) => setPitch(Number(e.target.value))}
        className="beat-lab-pitch"
        aria-valuemin={-12}
        aria-valuemax={12}
        aria-valuenow={pitch}
      />

      <details className="beat-lab-journey">
        <summary>Release journey (5 steps)</summary>
        <ol className="beat-lab-journey-list">
          <li>Type lyrics → choose beat file.</li>
          <li>
            <strong>Generating…</strong> → pro master (≤~3 min, fades, loudness-normalized MP3).
          </li>
          <li>
            Open DistroKid — metadata JSON + optional prep files; paste/upload in their dashboard (no DistroKid API).
          </li>
          <li>Beat-synced waveform video (FFmpeg) — optional auto-run after master if enabled below.</li>
          <li>Store go-live: set in DistroKid; timing varies by platform (often days, not instant).</li>
        </ol>
      </details>

      <label className="beat-lab-checkbox">
        <input
          type="checkbox"
          checked={autoPrep}
          onChange={(e) => setAutoPrep(e.target.checked)}
          disabled={busy}
        />{' '}
        After master, save DistroKid-prep package on server (metadata JSON + file copy)
      </label>

      <label className="beat-lab-checkbox">
        <input
          type="checkbox"
          checked={autoVideo}
          onChange={(e) => setAutoVideo(e.target.checked)}
          disabled={busy}
        />{' '}
        Auto-generate beat-synced waveform video after master (requires ffmpeg on API server)
      </label>

      <button type="button" className="primary wide" disabled={busy} onClick={generateSong}>
        {busy ? 'Generating…' : 'Generate pro track'}
      </button>

      {status && <p className="ok beat-lab-sync">{status}</p>}
      {err && <p className="bad">{err}</p>}

      {masteredUrl && (
        <div className="beat-lab-master">
          <audio controls src={masteredUrl} style={{ width: '100%', marginTop: 8 }} />
          {metaJson && (
            <details className="beat-lab-meta">
              <summary>Metadata (copy into DistroKid)</summary>
              <pre className="beat-lab-pre">{metaJson}</pre>
            </details>
          )}
          <div className="beat-lab-pro-actions">
            <a
              href="https://distrokid.com"
              target="_blank"
              rel="noreferrer"
              className="primary wide distro-btn"
              style={{ display: 'inline-block', textAlign: 'center', textDecoration: 'none' }}
            >
              Open DistroKid (manual upload)
            </a>
            <button type="button" className="btn-secondary wide" disabled={busy} onClick={onPrepAgain}>
              Save DistroKid prep again
            </button>
            <button type="button" className="btn-secondary wide" disabled={busy} onClick={onVideo}>
              Generate waveform video (FFmpeg)
            </button>
          </div>
          {distroMsg && <p className="hint beat-lab-sync">{distroMsg}</p>}
          {videoMsg && <p className="hint beat-lab-sync">{videoMsg}</p>}
          {videoUrl && (
            <video src={videoUrl} controls style={{ width: '100%', marginTop: 12, borderRadius: 8 }} />
          )}
        </div>
      )}
    </section>
  )
}
