export default function Spinner({ label }) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginTop: 16,
        color: 'var(--muted)',
        fontSize: '0.95rem',
      }}
    >
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          border: '3px solid rgba(255,255,255,0.15)',
          borderTopColor: 'var(--accent)',
          animation: 'spin 0.7s linear infinite',
        }}
      />
      <span>{label}</span>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) {
          span:first-of-type { animation: none; opacity: 0.7; }
        }
      `}</style>
    </div>
  )
}
