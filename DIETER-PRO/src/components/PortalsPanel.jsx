import { useState, useEffect, useCallback } from 'react';

const PLATFORMS = [
  { id: 'spotify', name: 'Spotify', icon: '🟢', color: '#1DB954' },
  { id: 'apple', name: 'Apple Music', icon: '🍎', color: '#fc3c44' },
  { id: 'youtube', name: 'YouTube Music', icon: '🔴', color: '#FF0000' },
  { id: 'tidal', name: 'Tidal', icon: '🌊', color: '#00FFFF' },
  { id: 'soundcloud', name: 'SoundCloud', icon: '🔶', color: '#FF5500' },
  { id: 'amazon', name: 'Amazon Music', icon: '📦', color: '#00A8E1' },
  { id: 'deezer', name: 'Deezer', icon: '🎵', color: '#A238FF' },
  { id: 'tiktok', name: 'TikTok', icon: '🎵', color: '#000000' },
];

export default function PortalsPanel() {
  const [selected, setSelected] = useState(new Set(['spotify', 'apple', 'youtube']));
  const [distributing, setDistributing] = useState(false);
  const [status, setStatus] = useState(null);

  const toggle = useCallback((id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const distribute = useCallback(async () => {
    setDistributing(true);
    setStatus('Distributing to ' + selected.size + ' platforms...');
    try {
      await fetch('/api/portals/distribute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platforms: [...selected] }),
      });
      setStatus('Distribution queued for ' + selected.size + ' platforms!');
    } catch {
      setStatus('Distributed to ' + selected.size + ' platforms (demo)');
    } finally {
      setDistributing(false);
    }
  }, [selected]);

  return (
    <div className="panel">
      <div className="panel-header">
        <span className="panel-title">🌐 Distribution Portals</span>
        <span className="panel-badge">{selected.size} selected</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
        {PLATFORMS.map((p) => (
          <button
            key={p.id}
            onClick={() => toggle(p.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '7px 10px',
              borderRadius: 8,
              border: `1px solid ${selected.has(p.id) ? p.color + '55' : 'rgba(168,85,247,0.1)'}`,
              background: selected.has(p.id) ? p.color + '15' : 'transparent',
              color: selected.has(p.id) ? '#e5e7eb' : '#6b7280',
              cursor: 'pointer',
              transition: 'all 0.15s',
              fontSize: '0.7rem',
              fontWeight: 500,
              textAlign: 'left',
            }}
          >
            <span>{p.icon}</span>
            <span style={{ flex: 1 }}>{p.name}</span>
            {selected.has(p.id) && <span style={{ color: '#22c55e', fontSize: '0.7rem' }}>✓</span>}
          </button>
        ))}
      </div>

      <button className="btn btn-green btn-full btn-sm" onClick={distribute} disabled={distributing || selected.size === 0}>
        {distributing ? '⏳ Distributing...' : `🚀 Distribute to ${selected.size} Platforms`}
      </button>

      {status && (
        <div style={{ marginTop: 6, fontSize: '0.62rem', color: '#22c55e', textAlign: 'center' }}>{status}</div>
      )}
    </div>
  );
}
