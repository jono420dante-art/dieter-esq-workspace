import { useCallback, useMemo, useRef, useState } from 'react'
import './StudioV5.css'
import { STUDIO_NAME, STUDIO_SLUG } from './studioBrand.js'
import { buildLandingMurekaPrompt, extractAudioUrl } from './murekaHelpers.js'
import { normalizeApiRoot, parseFetchJson, postStudioGrowth } from './apiResolve.js'
import { withMurekaRetries } from './murekaResilience.js'
import { audioCrossOriginForSrc } from './dieterClientConfig.js'

const V5_PRESETS = {
  edm: 'high-energy EDM festival anthem, massive drop, female vocals with harmonies, 128 BPM, 8-minute journey, laser synths, huge buildups',
  pop: 'catchy pop hit, radio-ready female vocals, perfect harmonies, 122 BPM, verse-chorus structure, 4-minute chart-topper',
  hiphop: 'smooth hip-hop/R&B, deep male vocals, trap hi-hats, 90 BPM, emotional storytelling, rich 808s',
  rock: 'epic rock anthem, powerful male vocals, driving guitars, huge chorus, 135 BPM, stadium energy',
  epic: '8-minute cinematic epic, orchestral build, vocal layers, dramatic drops, film-score quality',
}

function parseV5Prompt(prompt) {
  const p = String(prompt || '')
  const bpmMatch = p.match(/(\d{2,3})\s?bpm/i)
  const bpm = Math.max(60, Math.min(200, parseInt(bpmMatch?.[1] || '120', 10) || 120))
  const vocalMatch = p.match(/\b(male|female)\b/i)
  const vocals = vocalMatch?.[1]?.toLowerCase() === 'male' ? 'male' : 'female'
  const instrumental = /\binstrumental\b/i.test(p)
  return { bpm, vocals: instrumental ? 'none' : vocals }
}

export default function StudioV5({ apiBase, onSongReady }) {
  const apiRoot = useMemo(() => normalizeApiRoot(apiBase || '/api'), [apiBase])
  const [prompt, setPrompt] = useState('')
  const [lengthMin, setLengthMin] = useState('8')
  const [quality, setQuality] = useState('studio')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [err, setErr] = useState('')
  const [audioUrl, setAudioUrl] = useState('')
  const audioRef = useRef(null)

  const onPreset = (k) => {
    setPrompt(V5_PRESETS[k] || '')
  }

  const generate = useCallback(async () => {
    setErr('')
    setStatus('')
    const text = prompt.trim()
    if (!text) {
      setErr('Write a prompt first.')
      return
    }
    const key = (localStorage.getItem('mureka_api_key') || '').trim()
    if (!key) {
      setErr('Add your Mureka key via API keys (Connections) or the Voice studio key field.')
      return
    }

    const parsed = parseV5Prompt(text)
    const genre = /hip[- ]?hop|trap|drill/i.test(text)
      ? 'hip-hop'
      : /rock|guitar|anthem/i.test(text)
        ? 'rock'
        : /jazz/i.test(text)
          ? 'jazz'
          : /edm|electro|festival|house|techno/i.test(text)
            ? 'electronic'
            : 'pop'
    const mood = /sad|melanch|heartbreak/i.test(text)
      ? 'sad'
      : /relax|chill|lofi/i.test(text)
        ? 'relaxed'
        : /inspir|uplift/i.test(text)
          ? 'inspired'
          : /energy|hype|drop|epic/i.test(text)
            ? 'energetic'
            : 'happy'

    // Mureka API: we request a full track; length/quality are guidance text only.
    const promptForMureka = buildLandingMurekaPrompt({
      genre,
      mood,
      tempoBpm: String(parsed.bpm),
      vocal: parsed.vocals,
      userPrompt: `${text}\n\nTarget length: ~${lengthMin} min. Quality: ${quality === 'studio' ? 'studio clarity' : 'balanced'}.`,
    })
    const lyricPayload = parsed.vocals === 'none' ? '' : text

    setBusy(true)
    setAudioUrl('')
    setStatus('Starting Mureka render…')
    try {
      const start = await withMurekaRetries(async () => {
        const r = await fetch(`${apiRoot}/mureka/song/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
          body: JSON.stringify({ lyrics: lyricPayload, model: 'auto', prompt: promptForMureka }),
        })
        return parseFetchJson(r)
      }, { attempts: 4, baseMs: 800 })

      const taskId = String(start?.id || start?.task_id || start?.taskId || '')
      if (!taskId) throw new Error('No task id from Mureka')

      for (let i = 0; i < 90; i++) {
        setStatus(`Rendering… ${i + 1}/90`)
        const q = await withMurekaRetries(async () => {
          const r = await fetch(`${apiRoot}/mureka/song/query/${encodeURIComponent(taskId)}`, {
            headers: { Authorization: `Bearer ${key}` },
          })
          return parseFetchJson(r)
        }, { attempts: 3, baseMs: 700 })

        const url = extractAudioUrl(q)
        if (url) {
          setAudioUrl(url)
          onSongReady?.({ url, lyrics: lyricPayload, title: `${STUDIO_NAME} V5` })
          setStatus('Ready — press play.')
          void postStudioGrowth(apiRoot, 'mureka_song_ready', `v5:${taskId}`.slice(0, 80))
          return
        }
        const st = (q?.status || q?.state || '').toString().toLowerCase()
        if (st.includes('fail') || st.includes('error')) throw new Error(JSON.stringify(q?.error || q))
        await new Promise((r) => setTimeout(r, 2000))
      }
      throw new Error('Timeout waiting for Mureka')
    } catch (e) {
      setErr(String(e?.message || e))
      setStatus('')
    } finally {
      setBusy(false)
    }
  }, [apiRoot, lengthMin, prompt, quality])

  const downloadName = `${STUDIO_SLUG}-v5-master.mp3`

  return (
    <div className="v5-studio">
      <div className="v5-hero">
        <h1 className="v5-logo">{STUDIO_NAME} V5</h1>
        <p className="v5-subtitle">Long-form tracks · Real Mureka vocals · Mix-ready downloads</p>
        <p className="v5-subhint">Paste a natural-language prompt and generate a master track.</p>
      </div>

      <div className="prompt-engine">
        <div className="prompt-input">
          <h3 className="v5-h3">V5 Prompt (Natural Language)</h3>
          <textarea
            className="prompt-area"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="upbeat electronic pop, female vocals with harmonies, 128 BPM, neon city nightlife theme, massive drop at 1:30, 8-minute epic journey, rich synth layers, perfect vocal clarity…"
          />
          <div className="prompt-controls">
            <button className="control-btn" type="button" onClick={() => onPreset('edm')}>
              EDM Drop
            </button>
            <button className="control-btn" type="button" onClick={() => onPreset('pop')}>
              Pop Hit
            </button>
            <button className="control-btn" type="button" onClick={() => onPreset('hiphop')}>
              Hip-Hop
            </button>
            <button className="control-btn" type="button" onClick={() => onPreset('rock')}>
              Rock Anthem
            </button>
            <button className="control-btn" type="button" onClick={() => onPreset('epic')}>
              8min Epic
            </button>
          </div>
        </div>

        <div className="v5-controls">
          <h3 className="v5-h3">V5 Engine Controls</h3>
          <div className="v5-field">
            <label>Track length</label>
            <select value={lengthMin} onChange={(e) => setLengthMin(e.target.value)}>
              <option value="2">2 minutes</option>
              <option value="4">4 minutes</option>
              <option value="8">8 minutes (V5 Max)</option>
            </select>
          </div>
          <div className="v5-field">
            <label>Quality</label>
            <select value={quality} onChange={(e) => setQuality(e.target.value)}>
              <option value="balanced">Balanced</option>
              <option value="studio">Studio V5 (Max clarity)</option>
            </select>
          </div>
          <button className="v5-generate" type="button" onClick={generate} disabled={busy}>
            {busy ? 'Rendering…' : 'Generate V5 master'}
          </button>
          {status && <div className="v5-status">{status}</div>}
          {err && <div className="v5-err">{err}</div>}
        </div>
      </div>

      <div className="track-player">
        <h3 className="v5-h3">V5 master track</h3>
        <audio
          id="v5Player"
          ref={audioRef}
          controls
          src={audioUrl || ''}
          crossOrigin={audioCrossOriginForSrc(audioUrl)}
        />
        <div className="stems">
          <button className="stem-btn" type="button" disabled={!audioUrl} onClick={() => audioRef.current?.play?.()}>
            Play
          </button>
          <a className={`stem-btn ${audioUrl ? '' : 'disabled'}`} href={audioUrl || '#'} download={downloadName}>
            Download master
          </a>
        </div>
        <p className="v5-note">
          Stems (vocals/drums/bass/etc) require a stems-capable upstream. When available, we’ll surface them here.
        </p>
      </div>
    </div>
  )
}

