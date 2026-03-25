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
        <h1 className="portal-title">Showroom</h1>
        <p className="portal-lead">
          <strong>{STUDIO_NAME}</strong> quick-launch room: less reading, more doing. Pick a lane below and start.
          <button type="button" className="portal-inline-btn" onClick={onOpenKeys}>
            API keys
          </button>
          .
        </p>
      </div>

      <section className="portal-card">
        <h2>Do it now</h2>
        <div className="row">
          <button type="button" className="primary" onClick={() => onNavigateMode('create')}>
            Create song
          </button>
          <button type="button" className="btn-secondary" onClick={() => onNavigateMode('v5')}>
            V5 long track
          </button>
          <button type="button" className="btn-secondary" onClick={() => onNavigateMode('cover')}>
            Cover a stem
          </button>
          <button type="button" className="btn-secondary" onClick={() => onNavigateMode('voicestudio')}>
            Voice studio
          </button>
        </div>
      </section>

      <section className="portal-card">
        <h2>Is everything humming?</h2>
        <p className="hint">
          A quick pulse on your backend. Green means you’re good to create; if it’s quiet, point{' '}
          <code>VITE_API_BASE</code> at your live API and try again.
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
              Local lab: API path optional
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
        <h2>Send ideas to Mureka</h2>
        <p className="hint">
          Jot title, style, lyrics — we stash it in this browser and open <strong>mureka.ai</strong> so you can keep
          flowing. Your key can live on the server too (<code>MUREKA_API_KEY</code>).
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
        <h2>Your music out in the world</h2>
        <p className="hint">
          The showroom&apos;s <strong>Distribution</strong> tab is your couch-to-chart pit stop — demo stats, real links
          to Spotify, Apple, YouTube, tips to learn with your crew. Sign in there is just a taste; plug your real data
          when you ship.
        </p>
        <div className="row">
          <a
            className="btn-secondary"
            href={`${staticShowroomHref}#distribution`}
            style={{ display: 'inline-block', textDecoration: 'none' }}
          >
            Open Distribution hub ↗
          </a>
        </div>
      </section>

      <section className="portal-card">
        <h2>Mini tutorial</h2>
        <ul className="portal-links">
          <li>
            <strong>Create:</strong> write prompt → pick mood/tempo → Generate.
          </li>
          <li>
            <strong>V5:</strong> long-form prompts for extended arrangements.
          </li>
          <li>
            <strong>Cover:</strong> upload clip → choose instrument style → A/B takes.
          </li>
          <li>
            <strong>Voice:</strong> lyrics + beat guided cloud flow.
          </li>
          {site ? (
            <li>
              Live site:{' '}
              <a href={site} target="_blank" rel="noreferrer">
                {site}
              </a>
            </li>
          ) : null}
          <li>Save <code>#portal</code> as your home shortcut.</li>
        </ul>
        <div className="row">
          <a className="btn-secondary" href={staticShowroomHref} style={{ display: 'inline-block', textDecoration: 'none' }}>
            Open static showroom ↗
          </a>
          <a className="btn-secondary" href="/ed-geerdes-studio-guide.html" target="_blank" rel="noreferrer" style={{ display: 'inline-block', textDecoration: 'none' }}>
            Open quick guide ↗
          </a>
        </div>
      </section>
    </main>
  )
}
