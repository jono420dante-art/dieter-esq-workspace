import { useEffect, useState } from 'react'
import { getEngineBase } from '../lib/engineUrl'

export default function Status() {
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)
  const base = getEngineBase()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setErr('')
      try {
        const r = await fetch(`${base}/health`, { cache: 'no-store' })
        const j = await r.json().catch(() => ({}))
        if (!cancelled) {
          if (!r.ok) throw new Error(j?.detail || r.statusText)
          setData(j)
        }
      } catch (e) {
        if (!cancelled) setErr(String(e?.message ?? e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [base])

  return (
    <main className="fade-in" style={{ padding: '2rem 1.25rem', maxWidth: 640, margin: '0 auto' }}>
      <h1 style={{ marginTop: 0 }}>Engine status</h1>
      <p style={{ color: 'var(--muted)' }}>
        <code>{base}/health</code>
      </p>
      {loading ? <p style={{ color: 'var(--muted)' }}>Checking…</p> : null}
      {err ? (
        <p style={{ color: 'var(--err)', marginTop: 16 }} role="alert">
          {err}
        </p>
      ) : null}
      {data && !err ? (
        <pre
          style={{
            marginTop: 20,
            padding: 16,
            borderRadius: 12,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            overflow: 'auto',
            color: 'var(--ok)',
            fontSize: 14,
          }}
        >
          {JSON.stringify(data, null, 2)}
        </pre>
      ) : null}
      {data?.mureka === 'missing_key' ? (
        <p style={{ color: 'var(--err)', marginTop: 16 }}>
          Engine is up but <code>MUREKA_API_KEY</code> is not set — singing will not run until you add it.
        </p>
      ) : null}
    </main>
  )
}
