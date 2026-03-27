import { getEngineBase } from '../lib/engineUrl'

export default function Footer() {
  const engine = getEngineBase()
  return (
    <footer
      style={{
        marginTop: 'auto',
        padding: '2rem 1.25rem',
        borderTop: '1px solid var(--border)',
        color: 'var(--muted)',
        fontSize: '0.85rem',
        textAlign: 'center',
      }}
    >
      <p style={{ margin: '0 0 0.5rem' }}>
        Powered by Mureka · configure{' '}
        <code style={{ color: 'var(--text)' }}>MUREKA_API_KEY</code> on your engine host.
      </p>
      <p style={{ margin: 0, opacity: 0.85 }}>
        API base: <code>{engine}</code>
      </p>
    </footer>
  )
}
