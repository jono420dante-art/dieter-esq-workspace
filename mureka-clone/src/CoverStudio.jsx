import { useCallback, useEffect, useMemo, useState } from 'react'
import './CoverStudio.css'
import { absoluteFromApiPath, normalizeApiRoot, parseFetchJson } from './apiResolve.js'
import { audioCrossOriginForSrc } from './dieterClientConfig.js'

const INSTRUMENT_GROUPS = [
  {
    id: 'drums',
    label: 'Drums',
    items: [
      { id: 'brushed_snare', label: 'Funky 70s soul drums (brushed snare)', style: 'funky 70s soul drums, live feel, brushed snare' },
      { id: 'brushed_snare', label: 'Tight trap hats + 808 kick feel', style: 'tight trap hi-hats, 808 kicks, crisp' },
      { id: 'brushed_snare', label: 'Live jazz brush kit (swing)', style: 'live jazz brush kit, swing feel' },
    ],
  },
  {
    id: 'guitars',
    label: 'Guitars',
    items: [
      { id: 'electric_guitar', label: '12‑string acoustic folk (ringing)', style: '12-string acoustic folk, ringing harmonics' },
      { id: 'electric_guitar', label: 'Stadium rock power chords', style: 'electric guitar power chords, stadium rock' },
      { id: 'synth_pluck', label: 'Fingerstyle nylon/classical', style: 'fingerstyle nylon classical' },
    ],
  },
  {
    id: 'bass',
    label: 'Bass',
    items: [
      { id: 'sine_pad', label: 'Electric bass funk groove (picked)', style: 'electric bass funk groove, picked tone' },
      { id: 'sine_pad', label: 'Upright walking bass (jazz)', style: 'upright acoustic walking bass, jazz' },
      { id: 'sine_pad', label: 'Smooth R&B synth bass', style: 'smooth R&B synth bass' },
    ],
  },
  {
    id: 'leads',
    label: 'Leads',
    items: [
      { id: 'violin', label: 'Violin lead (cinematic swells)', style: 'violin lead melody, cinematic swells' },
      { id: 'sine_pad', label: 'Flute folk melody (breathy)', style: 'flute folk melody, breathy tone' },
      { id: 'electric_guitar', label: 'Distorted lead guitar solo', style: 'distorted lead guitar solo' },
    ],
  },
]

export default function CoverStudio({ apiBase }) {
  const apiRoot = useMemo(() => normalizeApiRoot(apiBase || '/api'), [apiBase])
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

  useEffect(() => {
    if (!file) {
      setPreviewUrl('')
      return
    }
    const u = URL.createObjectURL(file)
    setPreviewUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [file])

  const applyPreset = (item) => {
    setInstrument(item.id)
    setStylePrompt(item.style)
  }

  const generate = useCallback(async () => {
    setErr('')
    setStatus('')
    if (!file) {
      setErr('Upload or drag a stem/clip first.')
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
      setStatus('Covering… generating two takes')
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
      setStatus('Ready — audition Take 1 / Take 2, or the parallel mix.')
    } catch (e) {
      setErr(String(e?.message || e))
      setStatus('')
    } finally {
      setBusy(false)
    }
  }, [
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

  return (
    <div className="cover-page">
      <header className="cover-hero">
        <h2>Cover (timing preserved)</h2>
        <p>
          Drag a stem/clip → choose an instrument style → generate <strong>two takes</strong>. Default gain staging:
          cover at <strong>-6 dB</strong>, blend at <strong>30%</strong>.
        </p>
      </header>

      <section className="cover-grid">
        <div className="cover-card">
          <h3>1) Upload stem</h3>
          <input type="file" accept="audio/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          {previewUrl && (
            <div className="cover-audio">
              <div className="cover-label">Original preview</div>
              <audio controls src={previewUrl} crossOrigin={audioCrossOriginForSrc(previewUrl)} />
            </div>
          )}
        </div>

        <div className="cover-card">
          <h3>2) Choose instrument + style</h3>
          {INSTRUMENT_GROUPS.map((g) => (
            <div key={g.id} className="cover-group">
              <div className="cover-group-title">{g.label}</div>
              <div className="cover-chips">
                {g.items.map((it, idx) => (
                  <button key={`${g.id}_${idx}`} type="button" className="cover-chip" onClick={() => applyPreset(it)}>
                    {it.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="cover-row">
            <label>Instrument engine</label>
            <select value={instrument} onChange={(e) => setInstrument(e.target.value)}>
              <option value="electric_guitar">electric_guitar</option>
              <option value="violin">violin</option>
              <option value="brushed_snare">brushed_snare</option>
              <option value="synth_pluck">synth_pluck</option>
              <option value="sine_pad">sine_pad</option>
            </select>
          </div>
          <div className="cover-row">
            <label>Style prompt</label>
            <textarea value={stylePrompt} onChange={(e) => setStylePrompt(e.target.value)} rows={3} />
          </div>
        </div>

        <div className="cover-card">
          <h3>3) Take lanes + mix</h3>
          <div className="cover-row">
            <label>Cover gain (dB)</label>
            <input type="number" step="1" value={coverGainDb} onChange={(e) => setCoverGainDb(Number(e.target.value))} />
          </div>
          <div className="cover-row">
            <label>Original gain (dB)</label>
            <input
              type="number"
              step="1"
              value={originalGainDb}
              onChange={(e) => setOriginalGainDb(Number(e.target.value))}
            />
          </div>
          <div className="cover-row">
            <label>Parallel blend (cover %)</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={coverBlend}
              onChange={(e) => setCoverBlend(Number(e.target.value))}
            />
            <span className="cover-mono">{Math.round(coverBlend * 100)}%</span>
          </div>

          <div className="cover-row cover-row--toggle">
            <label>
              <input type="checkbox" checked={harmonyOn} onChange={(e) => setHarmonyOn(e.target.checked)} /> Add harmony
              layer
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
                <label>Harmony interval (semitones)</label>
                <input
                  type="number"
                  step="1"
                  value={harmonySemitones}
                  onChange={(e) => setHarmonySemitones(Number(e.target.value))}
                />
              </div>
            </div>
          )}

          <button type="button" className="cover-generate" onClick={generate} disabled={busy}>
            {busy ? 'Covering…' : 'Generate 2 takes'}
          </button>

          {status && <div className="cover-status">{status}</div>}
          {err && <div className="cover-err">{err}</div>}

          {(take1Url || take2Url || mixUrl) && (
            <div className="cover-results">
              <div className="cover-takes">
                <button
                  type="button"
                  className={pickedTake === 'take1' ? 'cover-take active' : 'cover-take'}
                  onClick={() => setPickedTake('take1')}
                  disabled={!take1Url}
                >
                  Take 1
                </button>
                <button
                  type="button"
                  className={pickedTake === 'take2' ? 'cover-take active' : 'cover-take'}
                  onClick={() => setPickedTake('take2')}
                  disabled={!take2Url}
                >
                  Take 2
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
              <audio
                controls
                src={(pickedTake === 'mix' ? mixUrl : pickedUrl) || ''}
                crossOrigin={audioCrossOriginForSrc(pickedTake === 'mix' ? mixUrl : pickedUrl)}
              />
              <div className="cover-downloads">
                {originalUrl && (
                  <a className="cover-dl" href={originalUrl} download>
                    Download original WAV
                  </a>
                )}
                {take1Url && (
                  <a className="cover-dl" href={take1Url} download>
                    Download take 1 WAV
                  </a>
                )}
                {take2Url && (
                  <a className="cover-dl" href={take2Url} download>
                    Download take 2 WAV
                  </a>
                )}
                {mixUrl && (
                  <a className="cover-dl" href={mixUrl} download>
                    Download mix WAV
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

