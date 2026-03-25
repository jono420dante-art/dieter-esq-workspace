import { useCallback, useEffect, useState } from 'react'
import { fetchApiHealth, fetchLocalCapsSummary } from './apiResolve.js'
import {
  openMurekaCreate,
  openMurekaLibrary,
  openMurekaPlatformDocs,
  syncMurekaPortalDraft,
} from './murekaPortalSync.js'
import { getSiteUrl } from './siteUrl.js'
import { STUDIO_NAME } from './studioBrand.js'

/**
 * Portal & guide: wiring docs, API health, and Mureka handoff for ED-GEERDES + mureka-clone.
 */
export default function StudioPortal({ apiBase, onOpenKeys, onNavigateMode }) {
  const [health, setHealth] = useState(() => ({ phase: 'idle' }))
  const [caps, setCaps] = useState(() => ({ phase: 'idle' }))
  const [handoffTitle, setHandoffTitle] = useState('')
  const [handoffStyle, setHandoffStyle] = useState('Melodic Trap')
  const [handoffLyrics, setHandoffLyrics] = useState('')
  const [handoffVocal, setHandoffVocal] = useState('female')
  const [handoffInstrumental, setHandoffInstrumental] = useState(false)
  const [handoffMsg, setHandoffMsg] = useState('')

  const runChecks = useCallback(async () => {
    setHealth({ phase: 'loading' })
    setCaps({ phase: 'loading' })
    const h = await fetchApiHealth(apiBase)
    setHealth({ phase: 'done', ...h })
    const c = await fetchLocalCapsSummary(apiBase)
    setCaps({ phase: 'done', ...c })
  }, [apiBase])

  useEffect(() => {
    void runChecks()
  }, [runChecks])

  const staticShowroomHref = '/ed-geerdes-platform.html'
  const site = getSiteUrl()

  const pushHandoffAndOpen = () => {
    setHandoffMsg('')
    try {
      syncMurekaPortalDraft({
        title: handoffTitle,
        style: handoffStyle,
        lyrics: handoffLyrics,
        vocal: handoffVocal,
        instrumental: handoffInstrumental,
      })
      setHandoffMsg('Draft saved in this browser (session). Opening mureka.ai…')
      openMurekaCreate()
    } catch (e) {
      setHandoffMsg(String(e?.message || e))
    }
  }

  return (
    <main className="main main-portal">
      <div className="portal-hero">
        <h1 className="portal-title">Portal &amp; guide</h1>
        <p className="portal-lead">
          <strong>{STUDIO_NAME}</strong> ties together this React studio (mureka-clone), your{' '}
          <strong>FastAPI</strong> at <code>{apiBase}</code>, and <strong>Mureka</strong> cloud when you use Create /
          Cloud / Voice. Use the <strong>left sidebar</strong> to switch modes. Everything talks to the same API base
          once you hit <button type="button" className="portal-inline-btn" onClick={onOpenKeys}>API keys</button>.
        </p>
      </div>

      <section className="portal-card">
        <h2>API &amp; pipeline health</h2>
        <p className="hint">
          Pings <code>GET {apiBase}/health</code> and <code>GET {apiBase}/local/capabilities</code>. If you only deployed
          static HTML, these fail until the Docker / Railway API is reachable and <code>VITE_API_BASE</code> points to it.
        </p>
        <div className="portal-health-row">
          {health.phase === 'loading' && <span className="portal-badge portal-badge-warn">Checking…</span>}
          {health.phase === 'done' && health.ok && (
            <span className="portal-badge portal-badge-ok">
              API OK · {health.ms != null ? `${health.ms} ms` : '—'}
            </span>
          )}
          {health.phase === 'done' && !health.ok && (
            <span className="portal-badge portal-badge-bad" title={health.error || ''}>
              API unreachable · {health.error || 'network / CORS'}
            </span>
          )}
          {caps.phase === 'done' && caps.ok && (
            <span className="portal-badge portal-badge-ok">Local DSP: available</span>
          )}
          {caps.phase === 'done' && !caps.ok && (
            <span className="portal-badge portal-badge-warn" title={caps.error || ''}>
              Local caps: skip or fix API
            </span>
          )}
        </div>
        <div className="row" style={{ marginTop: '0.75rem' }}>
          <button type="button" className="primary" onClick={() => void runChecks()}>
            Refresh checks
          </button>
        </div>
      </section>

      <section className="portal-card">
        <h2>Mureka handoff (same browser)</h2>
        <p className="hint">
          Saves a small draft to <code>sessionStorage</code> (<code>dp-mureka-draft</code>) then opens{' '}
          <strong>mureka.ai</strong> create. Use your Mureka session there; keys can also live on the server as{' '}
          <code>MUREKA_API_KEY</code>.
        </p>
        <label htmlFor="ph-title">Title</label>
        <input
          id="ph-title"
          type="text"
          value={handoffTitle}
          onChange={(e) => setHandoffTitle(e.target.value)}
          placeholder="Working title"
        />
        <label htmlFor="ph-style">Style</label>
        <input
          id="ph-style"
          type="text"
          value={handoffStyle}
          onChange={(e) => setHandoffStyle(e.target.value)}
        />
        <label htmlFor="ph-lyrics">Lyrics (optional)</label>
        <textarea
          id="ph-lyrics"
          rows={4}
          value={handoffLyrics}
          onChange={(e) => setHandoffLyrics(e.target.value)}
          disabled={handoffInstrumental}
        />
        <div className="instrumental-row" style={{ marginTop: '0.5rem' }}>
          <input
            id="ph-inst"
            type="checkbox"
            checked={handoffInstrumental}
            onChange={(e) => setHandoffInstrumental(e.target.checked)}
          />
          <label htmlFor="ph-inst" className="instrumental-label">
            Instrumental — ignore lyrics for handoff
          </label>
        </div>
        <label>Vocal</label>
        <div className="vocal">
          <label>
            <input
              type="radio"
              name="ph-v"
              checked={handoffVocal === 'female'}
              onChange={() => setHandoffVocal('female')}
              disabled={handoffInstrumental}
            />{' '}
            Female
          </label>
          <label>
            <input
              type="radio"
              name="ph-v"
              checked={handoffVocal === 'male'}
              onChange={() => setHandoffVocal('male')}
              disabled={handoffInstrumental}
            />{' '}
            Male
          </label>
        </div>
        <div className="row">
          <button type="button" className="primary" onClick={pushHandoffAndOpen}>
            Save draft &amp; open Mureka Create
          </button>
          <button type="button" className="btn-secondary" onClick={() => openMurekaLibrary()}>
            Mureka library (new tab)
          </button>
          <button type="button" className="btn-secondary" onClick={() => openMurekaPlatformDocs()}>
            Platform docs
          </button>
        </div>
        {handoffMsg && <p className="ok" style={{ marginTop: '0.65rem' }}>{handoffMsg}</p>}
      </section>

      <section className="portal-card">
        <h2>Where everything lives</h2>
        <ul className="portal-links">
          <li>
            <a href={staticShowroomHref}>Static ED-GEERDES showroom</a> — marketplace demo, Web Audio toys, Discovery copy (
            <code>ed-geerdes-platform.html</code>).
          </li>
          <li>
            <strong>This app</strong> — full studio: Create (Mureka gateway), Local, Beat lab, Voice, etc.
          </li>
          {site ? (
            <li>
              Public site:{' '}
              <a href={site} target="_blank" rel="noreferrer">
                {site}
              </a>
            </li>
          ) : null}
          <li>
            Bookmark this guide: same-origin URL with <code>#portal</code>.
          </li>
        </ul>
        <div className="row">
          <button type="button" className="btn-secondary" onClick={() => onNavigateMode('create')}>
            Go to Create
          </button>
          <button type="button" className="btn-secondary" onClick={() => onNavigateMode('local')}>
            Go to Local lab
          </button>
        </div>
      </section>
    </main>
  )
}
