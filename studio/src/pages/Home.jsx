import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <main className="fade-in" style={{ padding: '2.5rem 1.25rem 3rem', maxWidth: 920, margin: '0 auto' }}>
      <section style={{ marginBottom: '3.5rem' }}>
        <h1
          style={{
            fontSize: 'clamp(2rem, 5vw, 2.75rem)',
            fontWeight: 700,
            lineHeight: 1.15,
            letterSpacing: '-0.03em',
            margin: '0 0 1rem',
            background: 'linear-gradient(120deg, #fff, #e9d5ff 40%, #fbcfe8)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
          }}
        >
          Your lyrics, sung for real.
        </h1>
        <p style={{ fontSize: '1.15rem', color: 'var(--muted)', maxWidth: 52 * 16, lineHeight: 1.55, margin: 0 }}>
          Write verses and choruses — the engine calls Mureka, waits for the render, and saves a playable track you
          can hear and download.
        </p>
        <Link
          to="/generate"
          style={{
            display: 'inline-flex',
            marginTop: '1.75rem',
            padding: '0.95rem 1.5rem',
            borderRadius: 12,
            fontWeight: 700,
            background: 'linear-gradient(115deg, var(--accent), var(--accent2))',
            color: '#fff',
            boxShadow: '0 8px 32px rgba(168, 85, 247, 0.35)',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          }}
          onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.98)')}
          onMouseUp={(e) => (e.currentTarget.style.transform = '')}
          >
          Open generator →
        </Link>
      </section>

      <section id="how" style={{ marginBottom: '3rem' }}>
        <h2 style={{ fontSize: '1.35rem', marginBottom: '1rem' }}>How it works</h2>
        <ol
          style={{
            margin: 0,
            paddingLeft: '1.25rem',
            color: 'var(--muted)',
            lineHeight: 1.7,
            display: 'grid',
            gap: '0.75rem',
          }}
        >
          <li>Set <strong style={{ color: 'var(--text)' }}>VITE_ENGINE_URL</strong> to your deployed lyrics API (same host you set <code>MUREKA_API_KEY</code> on).</li>
          <li>Paste lyrics with clear structure — verse / chorus helps the model.</li>
          <li>Generate: usually one to a few minutes while Mureka finishes the song.</li>
        </ol>
      </section>

      <section id="deploy">
        <h2 style={{ fontSize: '1.35rem', marginBottom: '1rem' }}>Deploy</h2>
        <p style={{ color: 'var(--muted)', lineHeight: 1.65, margin: 0 }}>
          Put this site on <strong style={{ color: 'var(--text)' }}>Vercel</strong> with root <code>studio</code>, and host the <code>engine</code> container on Railway, Fly.io, or any Docker host.
          Point the browser at your production engine URL so CORS allows your Vercel domain (set <code>CORS_ORIGINS</code> on the engine if needed).
        </p>
        <p style={{ color: 'var(--muted)', lineHeight: 1.65, marginTop: '1rem' }}>
          <Link to="/release" style={{ color: 'var(--accent)' }}>
            Sell &amp; share →
          </Link>{' '}
          SEO pack (optional <code>VITE_DIETER_API_BASE</code>) and distributor links.
        </p>
      </section>
    </main>
  )
}
