import { useCallback, useState } from 'react'
import { getEngineBase } from '../lib/engineUrl'

function dieterApiRoot() {
  const raw = import.meta.env.VITE_DIETER_API_BASE?.trim()
  if (!raw) return ''
  const r = raw.replace(/\/$/, '')
  return r.endsWith('/api') ? r : `${r}/api`
}

export default function Release() {
  const engine = getEngineBase()
  const api = dieterApiRoot()
  const [title, setTitle] = useState('My release')
  const [genre, setGenre] = useState('Pop')
  const [lyrics, setLyrics] = useState('')
  const [pack, setPack] = useState(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const runSeo = useCallback(async () => {
    if (!api) {
      setErr('Set VITE_DIETER_API_BASE in Vercel to your FastAPI origin (e.g. https://api.example.com).')
      return
    }
    setErr('')
    setBusy(true)
    try {
      const r = await fetch(`${api}/seo/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          genre: genre.trim(),
          lyrics: lyrics.trim() || undefined,
        }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(JSON.stringify(j?.detail || j))
      setPack(j)
    } catch (e) {
      setErr(String(e?.message || e))
    } finally {
      setBusy(false)
    }
  }, [api, title, genre, lyrics])

  return (
    <main className="fade-in" style={{ padding: '2rem 1.25rem', maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ marginTop: 0 }}>Sell &amp; share</h1>
      <p style={{ color: 'var(--muted)', lineHeight: 1.55 }}>
        Lyrics engine: <code>{engine}</code>. For SEO packs, point <code>VITE_DIETER_API_BASE</code> at the same
        Dieter API you use with the full studio.
      </p>

      {!api ? (
        <p style={{ color: 'var(--err)', marginTop: 16 }} role="note">
          Optional: add <code>VITE_DIETER_API_BASE</code> to enable “Build SEO pack” below.
        </p>
      ) : null}

      <section style={{ marginTop: 24, padding: 16, border: '1px solid var(--border)', borderRadius: 12 }}>
        <h2 style={{ marginTop: 0, fontSize: '1.1rem' }}>SEO / social pack</h2>
        <label style={{ display: 'block', marginBottom: 12 }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ display: 'block', width: '100%', marginTop: 6, padding: 10, borderRadius: 8 }}
          />
        </label>
        <label style={{ display: 'block', marginBottom: 12 }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Genre</span>
          <input
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            style={{ display: 'block', width: '100%', marginTop: 6, padding: 10, borderRadius: 8 }}
          />
        </label>
        <label style={{ display: 'block', marginBottom: 12 }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Lyrics excerpt</span>
          <textarea
            value={lyrics}
            onChange={(e) => setLyrics(e.target.value)}
            rows={4}
            style={{ display: 'block', width: '100%', marginTop: 6, padding: 10, borderRadius: 8 }}
          />
        </label>
        <button type="button" disabled={busy || !api} onClick={() => void runSeo()} style={{ padding: '10px 16px' }}>
          {busy ? '…' : 'Build SEO pack'}
        </button>
        {err ? (
          <p style={{ color: 'coral' }} role="alert">
            {err}
          </p>
        ) : null}
        {pack ? (
          <pre
            style={{
              marginTop: 16,
              fontSize: 12,
              overflow: 'auto',
              padding: 12,
              background: 'rgba(0,0,0,0.2)',
              borderRadius: 8,
            }}
          >
            {JSON.stringify(pack, null, 2)}
          </pre>
        ) : null}
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: '1.1rem' }}>Portals</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          {[
            ['Spotify for Artists', 'https://artists.spotify.com/'],
            ['Apple Music', 'https://artists.apple.com/'],
            ['DistroKid', 'https://distrokid.com/'],
            ['YouTube Studio', 'https://studio.youtube.com/'],
            ['TikTok', 'https://www.tiktok.com/tiktokstudio/upload'],
          ].map(([n, u]) => (
            <a
              key={n}
              href={u}
              target="_blank"
              rel="noreferrer"
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                fontSize: '0.9rem',
              }}
            >
              {n} ↗
            </a>
          ))}
        </div>
      </section>
    </main>
  )
}
