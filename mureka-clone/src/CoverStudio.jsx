import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './CoverStudio.css'
import { absoluteFromApiPath, normalizeApiRoot, parseFetchJson } from './apiResolve.js'
import { audioCrossOriginForSrc } from './dieterClientConfig.js'
import { AudioTransportLocal } from './AudioTransport.jsx'

/** Presets: `instrument` must be one of backend Literal instruments; `key` is unique for React. */
const INSTRUMENT_GROUPS = [
  {
    id: 'drums',
    label: 'Drums',
    items: [
      {
        key: 'drum_brush_soul',
        instrument: 'brushed_snare',
        label: '70s soul · brushed snare',
        style: 'funky 70s soul drums, live feel, brushed snare',
      },
      {
        key: 'drum_trap',
        instrument: 'brushed_snare',
        label: 'Trap · tight hats + 808 feel',
        style: 'tight trap hi-hats, 808 kicks, crisp',
      },
      {
        key: 'drum_jazz_brush',
        instrument: 'brushed_snare',
        label: 'Jazz · brush kit swing',
        style: 'live jazz brush kit, swing feel',
      },
    ],
  },
  {
    id: 'guitars',
    label: 'Guitars',
    items: [
      {
        key: 'gt_12string',
        instrument: 'electric_guitar',
        label: '12-string folk · ringing',
        style: '12-string acoustic folk, ringing harmonics',
      },
      {
        key: 'gt_rock',
        instrument: 'electric_guitar',
        label: 'Rock · power chords',
        style: 'electric guitar power chords, stadium rock',
      },
      {
        key: 'gt_nylon',
        instrument: 'synth_pluck',
        label: 'Classical · nylon fingerstyle',
        style: 'fingerstyle nylon classical',
      },
    ],
  },
  {
    id: 'bass',
    label: 'Bass',
    items: [
      {
        key: 'bs_funk',
        instrument: 'sine_pad',
        label: 'Funk · picked electric',
        style: 'electric bass funk groove, picked tone',
      },
      {
        key: 'bs_walk',
        instrument: 'sine_pad',
        label: 'Jazz · walking upright',
        style: 'upright acoustic walking bass, jazz',
      },
      {
        key: 'bs_rnb',
        instrument: 'sine_pad',
        label: 'R&B · smooth synth',
        style: 'smooth R&B synth bass',
      },
    ],
  },
  {
    id: 'leads',
    label: 'Leads',
    items: [
      {
        key: 'ld_violin',
        instrument: 'violin',
        label: 'Violin · cinematic',
        style: 'violin lead melody, cinematic swells',
      },
      {
        key: 'ld_flute',
        instrument: 'sine_pad',
        label: 'Flute · breathy folk',
        style: 'flute folk melody, breathy tone',
      },
      {
        key: 'ld_lead_gt',
        instrument: 'electric_guitar',
        label: 'Lead · distorted solo',
        style: 'distorted lead guitar solo',
      },
    ],
  },
]

function applyFriendlyApiError(raw) {
  const s = String(raw || '')
  if (/\b405\b/.test(s)) {
    return `${s}\n\nTip: Cover generation uses POST /api/cover/generate on your Dieter API. If you see 405, the request may be hitting a static host or the wrong path — open DevTools → Network and confirm “Generate 2 takes” sent POST (not GET). Set VITE_API_BASE or DIETER_API_ORIGIN per DEPLOY_VERCEL_RAILWAY.md.`
  }
  return s
}

export default function CoverStudio({ apiBase }) {
  const apiRoot = useMemo(() => normalizeApiRoot(apiBase || '/api'), [apiBase])
  const [cap, setCap] = useState(() => ({ checked: false, ok: false }))
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [instrument, setInstrument] = useState('electric_guitar')
  const [stylePrompt, setStylePrompt] = useState('electric guitar power chords, stadium rock')
  const [harmonyOn, setHarmonyOn] = useState(false)
  const [harmonyInstrument, setHarmonyInstrument] = useState('violin')
  const [harmonySemitones, setHarmonySemitones] = useState(4)
  const [coverBlend, setCoverBlend] = useState(0.3)
  const [originalGainDb, setOriginalGainDb] = useState(0)
  const [coverGainDb, setCoverGainDb] = useState(-6)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [status, setStatus] = useState('')

  const [take1Url, setTake1Url] = useState('')
  const [take2Url, setTake2Url] = useState('')
  const [mixUrl, setMixUrl] = useState('')
  const [originalUrl, setOriginalUrl] = useState('')
  const [pickedTake, setPickedTake] = useState('take1')
  const fileInputRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch(`${apiRoot}/cover/generate`, { method: 'OPTIONS' })
        if (!cancelled) setCap({ checked: true, ok: r.status !== 404 })
      } catch {
        if (!cancelled) setCap({ checked: true, ok: false })
      }
    })()
    if (!file) {
      setPreviewUrl('')
      return
    }
    const u = URL.createObjectURL(file)
    setPreviewUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [apiRoot, file])

  const applyPreset = (item) => {
    setInstrument(item.instrument)
    setStylePrompt(item.style)
  }

  const onFileChosen = (f) => {
    if (f && f.type.startsWith('audio/')) setFile(f)
    else if (f) setErr('Please choose an audio file (WAV, MP3, etc.).')
  }

  const generate = useCallback(async () => {
    setErr('')
    setStatus('')
    if (!file) {
      setErr('Add a stem or clip first — drag it into the box above or use “Browse files”.')
      return
    }
    if (cap.checked && !cap.ok) {
      setErr(
        applyFriendlyApiError(
          'Cover resynthesis needs a local DSP engine (audio decode + pitch tracking). This Vercel build is cloud-only.\n\nUse Create/V5/Voice for Mureka cloud renders, or connect a local engine for Cover.',
        ),
      )
      return
    }
    setBusy(true)
    setTake1Url('')
    setTake2Url('')
    setMixUrl('')
    setOriginalUrl('')
    try {
      const fd = new FormData()
      fd.append('stem', file)
      fd.append('instrument', instrument)
      fd.append('style_prompt', stylePrompt)
      fd.append('cover_blend', String(coverBlend))
      fd.append('original_gain_db', String(originalGainDb))
      fd.append('cover_gain_db', String(coverGainDb))
      if (harmonyOn) {
        fd.append('harmony_instrument', harmonyInstrument)
        fd.append('harmony_semitones', String(harmonySemitones))
      }
      setStatus('Sending to API… rendering two takes (timing matched to your clip).')
      const r = await fetch(`${apiRoot}/cover/generate`, { method: 'POST', body: fd })
      const j = await parseFetchJson(r)
      const t1 = absoluteFromApiPath(apiRoot, j.take1Url)
      const t2 = absoluteFromApiPath(apiRoot, j.take2Url)
      const mx = j.mixUrl ? absoluteFromApiPath(apiRoot, j.mixUrl) : ''
      const og = j.originalUrl ? absoluteFromApiPath(apiRoot, j.originalUrl) : ''
      setTake1Url(t1)
      setTake2Url(t2)
      setMixUrl(mx)
      setOriginalUrl(og)
      setPickedTake('take1')
      setStatus('Done — A/B the two takes, or open the parallel mix.')
    } catch (e) {
      setErr(applyFriendlyApiError(e?.message || e))
      setStatus('')
    } finally {
      setBusy(false)
    }
  }, [
    cap.checked,
    cap.ok,
    apiRoot,
    coverBlend,
    coverGainDb,
    file,
    harmonyInstrument,
    harmonyOn,
    harmonySemitones,
    instrument,
    originalGainDb,
    stylePrompt,
  ])

  const pickedUrl = pickedTake === 'take2' ? take2Url : take1Url

  const stepDone = (n) =>
    (n === 1 && !!file) || (n === 2 && !!instrument && stylePrompt.trim().length > 0) || (n === 3 && (!!take1Url || !!take2Url))

  return (
    <div className="cover-page">
      <header className="cover-hero">
        <div className="cover-hero-top">
          <div>
            <h2>Instrument cover · rhythm &amp; timing kept</h2>
            <p className="cover-lead">
              Upload a short stem or loop. The API traces pitch and timing from your audio, then paints a{' '}
              <strong>new instrument</strong> on top — same groove, new sound. You get <strong>two slightly different
              takes</strong> plus an optional <strong>parallel blend</strong> with your original.
            </p>
          </div>
        </div>

        <ol className="cover-flow" aria-label="Steps">
          <li className={stepDone(1) ? 'cover-flow-step cover-flow-step--done' : 'cover-flow-step'}>
            <span className="cover-flow-num">1</span>
            <span className="cover-flow-text">Drop your clip</span>
          </li>
          <li className={stepDone(2) ? 'cover-flow-step cover-flow-step--done' : 'cover-flow-step'}>
            <span className="cover-flow-num">2</span>
            <span className="cover-flow-text">Pick a sound + describe style</span>
          </li>
          <li className={stepDone(3) ? 'cover-flow-step cover-flow-step--done' : 'cover-flow-step'}>
            <span className="cover-flow-num">3</span>
            <span className="cover-flow-text">Generate &amp; compare takes</span>
          </li>
        </ol>

        <div className="cover-defaults">
          <div className="cover-defaults-title">Sensible starting levels</div>
          <div className="cover-defaults-grid">
            <div className="cover-default-card">
              <span className="cover-default-kicker">Cover layer loudness</span>
              <strong className="cover-default-value">−6 dB</strong>
              <p className="cover-default-desc">
                The new instrument sits a bit quieter than full scale so it doesn’t jump out of the speakers before you
                tweak.
              </p>
            </div>
            <div className="cover-default-card">
              <span className="cover-default-kicker">Blend with original</span>
              <strong className="cover-default-value">30%</strong>
              <p className="cover-default-desc">
                How much of the <em>synthesized</em> layer is mixed in with your <em>uploaded</em> audio. Raise for more
                “re-covered” sound; lower to stay closer to the source stem.
              </p>
            </div>
          </div>
          <p className="cover-defaults-foot">
            You can change both under <strong>Mix controls</strong> before generating. Original stem gain defaults to{' '}
            <strong className="cover-mono">0 dB</strong>.
          </p>
        </div>

        <details className="cover-details">
          <summary>How is this different from a normal “cover”?</summary>
          <p>
            This is <strong>audio-to-audio</strong>: the engine keeps the timing and melodic contour it hears in your
            file, then replaces (or adds) timbre — it’s not a separate MIDI cover from scratch. Best results: clear
            single-line stems (melody, bass line, or similar), a few seconds to a couple of minutes, WAV or MP3.
          </p>
        </details>
      </header>
      {cap.checked && !cap.ok && (
        <div className="cover-banner" role="status">
          <strong>Cloud-only mode:</strong> Cover resynthesis isn’t available on Vercel serverless. Use <strong>Create</strong>{' '}
          or <strong>V5</strong> for Mureka cloud, or connect a local DSP engine for Cover.
        </div>
      )}

      <section className="cover-grid">
        <div className="cover-card">
          <h3>
            <span className="cover-card-badge">1</span> Your stem or clip
          </h3>
          <p className="cover-card-lead">Drag a file here or browse. We’ll play a quick preview before you send it.</p>
          <div
            className={`cover-dropzone ${file ? 'cover-dropzone--has-file' : ''}`}
            onDragEnter={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
            onDragLeave={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
            onDragOver={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
            onDrop={(e) => {
              e.preventDefault()
              e.stopPropagation()
              const f = e.dataTransfer?.files?.[0]
              onFileChosen(f)
            }}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                fileInputRef.current?.click()
              }
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              className="cover-file-input-hidden"
              onChange={(e) => onFileChosen(e.target.files?.[0] || null)}
            />
            {file ? (
              <>
                <span className="cover-dropzone-name">{file.name}</span>
                <span className="cover-dropzone-hint">Click to replace · drag a new file anytime</span>
              </>
            ) : (
              <>
                <span className="cover-dropzone-cta">Drop audio here</span>
                <span className="cover-dropzone-hint">or click to browse · WAV, MP3, M4A…</span>
              </>
            )}
          </div>
          {previewUrl && (
            <div className="cover-audio">
              <div className="cover-label">Preview (local, not uploaded until you generate)</div>
              <AudioTransportLocal
                src={previewUrl}
                crossOrigin={audioCrossOriginForSrc(previewUrl)}
                className="cover-player-audio"
              />
            </div>
          )}
        </div>

        <div className="cover-card">
          <h3>
            <span className="cover-card-badge">2</span> Instrument &amp; style
          </h3>
          <p className="cover-card-lead">
            Tap a preset to load a style sentence, then edit the text if you want. The <strong>engine</strong> pick
            chooses which synth/model family runs (guitar, strings, drums…).
          </p>
          {INSTRUMENT_GROUPS.map((g) => (
            <div key={g.id} className="cover-group">
              <div className="cover-group-title">{g.label}</div>
              <div className="cover-chips">
                {g.items.map((it) => (
                  <button key={it.key} type="button" className="cover-chip" onClick={() => applyPreset(it)}>
                    {it.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="cover-row">
            <label>
              Instrument engine
              <span className="cover-field-hint">Backend timbre family (maps to Dieter cover pipeline).</span>
            </label>
            <select value={instrument} onChange={(e) => setInstrument(e.target.value)}>
              <option value="electric_guitar">electric_guitar</option>
              <option value="violin">violin</option>
              <option value="brushed_snare">brushed_snare</option>
              <option value="synth_pluck">synth_pluck</option>
              <option value="sine_pad">sine_pad</option>
            </select>
          </div>
          <div className="cover-row">
            <label>
              Style prompt
              <span className="cover-field-hint">Plain language — genre, articulation, era, “live vs quantized”, etc.</span>
            </label>
            <textarea value={stylePrompt} onChange={(e) => setStylePrompt(e.target.value)} rows={3} />
          </div>
        </div>

        <div className="cover-card cover-card--wide">
          <h3>
            <span className="cover-card-badge">3</span> Mix controls, harmony, render
          </h3>
          <p className="cover-card-lead">
            Adjust gain and blend, optionally add a harmony line, then run once — the server returns two takes and a mix
            built from <strong>Take 1</strong>.
          </p>

          <div className="cover-mix-columns">
            <div className="cover-mix-col">
              <div className="cover-row">
                <label>
                  Cover layer gain
                  <span className="cover-field-hint">Loudness of the new instrument (dB). Default −6.</span>
                </label>
                <input type="number" step="1" value={coverGainDb} onChange={(e) => setCoverGainDb(Number(e.target.value))} />
              </div>
              <div className="cover-row">
                <label>
                  Original stem gain
                  <span className="cover-field-hint">Trim your uploaded clip in the blend. Usually 0 dB.</span>
                </label>
                <input
                  type="number"
                  step="1"
                  value={originalGainDb}
                  onChange={(e) => setOriginalGainDb(Number(e.target.value))}
                />
              </div>
              <div className="cover-row cover-row--range">
                <label>
                  How much cover in the blend
                  <span className="cover-field-hint">
                    0% = only original stem · 100% = mostly new layer (still parallel with original unless you change
                    gains).
                  </span>
                </label>
                <div className="cover-range-row">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={coverBlend}
                    onChange={(e) => setCoverBlend(Number(e.target.value))}
                  />
                  <span className="cover-mono cover-range-value">{Math.round(coverBlend * 100)}%</span>
                </div>
              </div>
            </div>
            <div className="cover-mix-col">
              <div className="cover-row cover-row--toggle">
                <label>
                  <input type="checkbox" checked={harmonyOn} onChange={(e) => setHarmonyOn(e.target.checked)} />
                  Add harmony layer (second instrument + interval)
                </label>
              </div>
              {harmonyOn && (
                <div className="cover-harmony">
                  <div className="cover-row">
                    <label>Harmony instrument</label>
                    <select value={harmonyInstrument} onChange={(e) => setHarmonyInstrument(e.target.value)}>
                      <option value="violin">violin</option>
                      <option value="electric_guitar">electric_guitar</option>
                      <option value="sine_pad">sine_pad</option>
                      <option value="synth_pluck">synth_pluck</option>
                    </select>
                  </div>
                  <div className="cover-row">
                    <label>
                      Interval (semitones)
                      <span className="cover-field-hint">e.g. 4 = major third above.</span>
                    </label>
                    <input
                      type="number"
                      step="1"
                      value={harmonySemitones}
                      onChange={(e) => setHarmonySemitones(Number(e.target.value))}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <button type="button" className="cover-generate" onClick={generate} disabled={busy}>
            {busy ? 'Rendering…' : 'Generate 2 takes'}
          </button>
          <p className="cover-api-hint">
            Uses <code className="cover-mono">POST {apiRoot}/cover/generate</code> with multipart audio — your Dieter API
            must be reachable from this app.
          </p>

          {status && <div className="cover-status">{status}</div>}
          {err && (
            <div className="cover-err" role="alert">
              {err.split('\n').map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          )}

          {(take1Url || take2Url || mixUrl) && (
            <div className="cover-results">
              <div className="cover-results-title">Listen &amp; download</div>
              <div className="cover-takes">
                <button
                  type="button"
                  className={pickedTake === 'take1' ? 'cover-take active' : 'cover-take'}
                  onClick={() => setPickedTake('take1')}
                  disabled={!take1Url}
                >
                  Take A
                </button>
                <button
                  type="button"
                  className={pickedTake === 'take2' ? 'cover-take active' : 'cover-take'}
                  onClick={() => setPickedTake('take2')}
                  disabled={!take2Url}
                >
                  Take B
                </button>
                <button
                  type="button"
                  className={pickedTake === 'mix' ? 'cover-take active' : 'cover-take'}
                  onClick={() => setPickedTake('mix')}
                  disabled={!mixUrl}
                >
                  Parallel mix
                </button>
              </div>
              <AudioTransportLocal
                src={(pickedTake === 'mix' ? mixUrl : pickedUrl) || ''}
                crossOrigin={audioCrossOriginForSrc(pickedTake === 'mix' ? mixUrl : pickedUrl)}
                className="cover-player-audio"
              />
              <div className="cover-downloads">
                {originalUrl && (
                  <a className="cover-dl" href={originalUrl} download>
                    Original (processed)
                  </a>
                )}
                {take1Url && (
                  <a className="cover-dl" href={take1Url} download>
                    Take A WAV
                  </a>
                )}
                {take2Url && (
                  <a className="cover-dl" href={take2Url} download>
                    Take B WAV
                  </a>
                )}
                {mixUrl && (
                  <a className="cover-dl" href={mixUrl} download>
                    Blend WAV
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
