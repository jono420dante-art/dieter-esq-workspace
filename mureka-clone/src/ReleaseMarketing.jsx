import { useCallback, useMemo, useState } from 'react'
import { parseFetchJson } from './apiResolve.js'
import { getSiteUrl } from './siteUrl.js'
import { STUDIO_NAME } from './studioBrand.js'

function parseTags(s) {
  return s
    .split(/[,#\s]+/)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 16)
}

const PORTALS = [
  { name: 'Spotify for Artists', url: 'https://artists.spotify.com/', color: '#1DB954' },
  { name: 'Apple Music for Artists', url: 'https://artists.apple.com/', color: '#FA243C' },
  { name: 'DistroKid', url: 'https://distrokid.com/', color: '#00AEEF' },
  { name: 'Bandcamp', url: 'https://bandcamp.com/', color: '#629AA9' },
  { name: 'YouTube Studio', url: 'https://studio.youtube.com/', color: '#FF0000' },
  { name: 'TikTok Creator', url: 'https://www.tiktok.com/tiktokstudio/upload', color: '#25F4EE' },
  { name: 'Instagram', url: 'https://www.instagram.com/', color: '#E4405F' },
  { name: 'Facebook Sharing', url: 'https://www.facebook.com/sharer/sharer.php?u=', color: '#1877F2', needsUrl: true },
  { name: 'X (Twitter)', url: 'https://twitter.com/intent/tweet?text=', color: '#000', needsText: true },
]

function copyText(text) {
  const t = String(text || '').trim()
  if (!t) return
  void navigator.clipboard?.writeText(t)
}

export default function ReleaseMarketing({ apiBase }) {
  const [title, setTitle] = useState('My new single')
  const [genre, setGenre] = useState('Afrobeat')
  const [description, setDescription] = useState('')
  const [lyrics, setLyrics] = useState('')
  const [tagsStr, setTagsStr] = useState('newmusic, indie, viral')
  const [pack, setPack] = useState(null)
  const [source, setSource] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const siteUrl = getSiteUrl()
  const shareLink =
    siteUrl || (typeof window !== 'undefined' ? window.location.origin : '')

  const openAiKey =
    typeof window !== 'undefined' ? (localStorage.getItem('openai_api_key') || '').trim() : ''

  const runSeo = useCallback(async () => {
    setErr('')
    setPack(null)
    setBusy(true)
    try {
      const r = await fetch(`${apiBase.replace(/\/$/, '')}/seo/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          genre: genre.trim() || undefined,
          description: description.trim() || undefined,
          lyrics: lyrics.trim() || undefined,
          tags: parseTags(tagsStr),
          openaiApiKey: openAiKey || undefined,
        }),
      })
      const j = await parseFetchJson(r)
      if (!r.ok) throw new Error(JSON.stringify(j?.detail || j))
      setPack(j)
      setSource(j.packSource || j.source || '')
    } catch (e) {
      setErr(String(e?.message || e))
    } finally {
      setBusy(false)
    }
  }, [apiBase, title, genre, description, lyrics, tagsStr, openAiKey])

  const tweetText = useMemo(() => {
    const yt = pack?.youtubeTitle || title
    const cap = pack?.tiktokCaption || ''
    return `${yt}\n${cap}\n${shareLink}`.trim()
  }, [pack, title, shareLink])

  return (
    <main className="main main-local release-market">
      <section className="release-hero">
        <h1 className="release-h1">Release &amp; reach</h1>
        <p className="release-lead">
          After you generate a track on <strong>Create</strong>, use your Dieter API to build an{' '}
          <strong>SEO / social pack</strong> (titles, descriptions, hashtags). Then open distributors and platforms
          below to sell and promote — wire your own <code>MUREKA_API_KEY</code> and optional OpenAI in Connections for
          richer copy.
        </p>
      </section>

      <section className="release-card">
        <h2>SEO pack from API</h2>
        <p className="hint">
          Calls <code>POST {apiBase}/seo/suggest</code>. Heuristics always work; OpenAI upgrades the pack when a key is
          saved in Connections.
        </p>
        <div className="release-grid-form">
          <label>
            Track title
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Single title" />
          </label>
          <label>
            Genre
            <input value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="Afrobeat" />
          </label>
          <label className="release-span-2">
            Short description (optional)
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="One line for DSPs / landing page"
            />
          </label>
          <label className="release-span-2">
            Lyrics excerpt (optional)
            <textarea
              rows={4}
              value={lyrics}
              onChange={(e) => setLyrics(e.target.value)}
              placeholder="Paste a verse — used for keyword ideas"
            />
          </label>
          <label className="release-span-2">
            Tags (comma-separated)
            <input value={tagsStr} onChange={(e) => setTagsStr(e.target.value)} />
          </label>
        </div>
        <div className="release-actions">
          <button type="button" className="primary" disabled={busy || !title.trim()} onClick={() => void runSeo()}>
            {busy ? 'Building pack…' : 'Build SEO / social pack'}
          </button>
        </div>
        {err ? (
          <p className="bad" role="alert">
            {err}
          </p>
        ) : null}
        {pack ? (
          <div className="release-pack fade-in">
            <p className="ok">
              Pack ready <span className="release-source">({source || 'api'})</span>
            </p>
            <div className="release-pack-grid">
              <div>
                <h3>Meta</h3>
                <p>
                  <strong>H1:</strong> {pack.h1 || title}
                </p>
                <p>
                  <strong>Meta description:</strong> {pack.metaDescription}
                </p>
                <button type="button" className="btn-secondary" onClick={() => copyText(pack.metaDescription)}>
                  Copy description
                </button>
              </div>
              <div>
                <h3>YouTube</h3>
                <p>{pack.youtubeTitle}</p>
                <pre className="release-pre">{pack.youtubeDescription}</pre>
                <button type="button" className="btn-secondary" onClick={() => copyText(pack.youtubeDescription)}>
                  Copy YouTube description
                </button>
              </div>
              <div>
                <h3>TikTok / Shorts</h3>
                <p>{pack.tiktokCaption}</p>
                <p>
                  <strong>Hashtags:</strong> {(pack.hashtags || []).join(' ')}
                </p>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => copyText(`${pack.tiktokCaption}\n\n${(pack.hashtags || []).join(' ')}`)}
                >
                  Copy caption + tags
                </button>
              </div>
              <div>
                <h3>Keywords</h3>
                <p className="release-kw">{(pack.keywords || []).join(', ')}</p>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <section className="release-card">
        <h2>Distributors &amp; creator portals</h2>
        <p className="hint">Upload your mastered file where you sell — {STUDIO_NAME} does not replace DSP contracts.</p>
        <ul className="release-portals">
          {PORTALS.map((p) => {
            let href = p.url
            if (p.needsUrl) href = p.url + encodeURIComponent(shareLink || 'https://')
            if (p.needsText) href = p.url + encodeURIComponent(tweetText.slice(0, 220))
            return (
              <li key={p.name}>
                <a
                  className="release-portal-link"
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ borderColor: p.color + '55' }}
                >
                  <span className="release-dot" style={{ background: p.color }} />
                  {p.name} ↗
                </a>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="release-card">
        <h2>Share this studio</h2>
        <p className="hint">Canonical link for posts (set <code>VITE_SITE_URL</code> on deploy).</p>
        <code className="release-share-url">{shareLink || '(set VITE_SITE_URL in production)'}</code>
        <div className="release-actions">
          <button type="button" className="btn-secondary" onClick={() => copyText(shareLink)}>
            Copy site URL
          </button>
          <a
            className="btn-secondary"
            href={'https://twitter.com/intent/tweet?text=' + encodeURIComponent(tweetText || title + ' ' + shareLink)}
            target="_blank"
            rel="noreferrer"
          >
            Post on X
          </a>
        </div>
      </section>
    </main>
  )
}
