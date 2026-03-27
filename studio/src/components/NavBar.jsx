import { NavLink } from 'react-router-dom'

const linkStyle = ({ isActive }) => ({
  padding: '0.5rem 0.9rem',
  borderRadius: 10,
  fontWeight: 600,
  fontSize: '0.95rem',
  transition: 'background 0.2s ease, color 0.2s ease, transform 0.15s ease',
  background: isActive ? 'rgba(168, 85, 247, 0.25)' : 'transparent',
  color: isActive ? '#fff' : 'var(--muted)',
  border: isActive ? '1px solid rgba(168, 85, 247, 0.45)' : '1px solid transparent',
})

export default function NavBar() {
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        height: 'var(--nav-h)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1.25rem',
        borderBottom: '1px solid var(--border)',
        background: 'rgba(12, 6, 24, 0.78)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <NavLink
        to="/"
        end
        style={{ display: 'flex', alignItems: 'center', gap: 10 }}
        className="fade-in"
      >
        <span
          aria-hidden
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
            boxShadow: '0 4px 20px rgba(168, 85, 247, 0.35)',
          }}
        />
        <span style={{ fontWeight: 700, letterSpacing: '-0.02em' }}>Lyrics Studio</span>
      </NavLink>
      <nav style={{ display: 'flex', gap: 6 }} aria-label="Main">
        <NavLink to="/" end style={linkStyle}>
          Home
        </NavLink>
        <NavLink to="/generate" style={linkStyle}>
          Generate
        </NavLink>
        <NavLink to="/release" style={linkStyle}>
          Sell &amp; share
        </NavLink>
        <NavLink to="/status" style={linkStyle}>
          Engine
        </NavLink>
      </nav>
    </header>
  )
}
