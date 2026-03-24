import { useState, useCallback } from 'react';
import { useStudio } from '../context/StudioContext';

const CHANNEL_COLORS = ['#a855f7', '#22c55e', '#f97316', '#38bdf8', '#ec4899', '#eab308', '#ef4444', '#06b6d4'];

export default function MixerConsole() {
  const { tracks } = useStudio();
  const [channels, setChannels] = useState(() =>
    Array.from({ length: 8 }, (_, i) => ({
      id: i,
      name: i < tracks.length ? tracks[i].name : `Ch ${i + 1}`,
      volume: 0.75,
      pan: 0,
      mute: false,
      solo: false,
      eq: { low: 0, mid: 0, high: 0 },
      send: { reverb: 0, delay: 0 },
    }))
  );
  const [masterVol, setMasterVol] = useState(0.85);

  const updateChannel = useCallback((idx, key, value) => {
    setChannels((prev) => prev.map((ch, i) => (i === idx ? { ...ch, [key]: value } : ch)));
  }, []);

  const updateEq = useCallback((idx, band, value) => {
    setChannels((prev) =>
      prev.map((ch, i) => (i === idx ? { ...ch, eq: { ...ch.eq, [band]: value } } : ch))
    );
  }, []);

  return (
    <div className="panel">
      <div className="panel-header">
        <span className="panel-title">🎛️ Mixer Console</span>
        <span className="panel-badge">8 CH + Master</span>
      </div>

      <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 8 }}>
        {channels.map((ch, i) => (
          <div
            key={ch.id}
            style={{
              minWidth: 60,
              padding: '8px 4px',
              background: 'rgba(18,22,42,0.5)',
              borderRadius: 8,
              border: `1px solid ${CHANNEL_COLORS[i]}22`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <div style={{ fontSize: '0.55rem', fontWeight: 600, color: CHANNEL_COLORS[i], letterSpacing: '0.08em' }}>
              {ch.name}
            </div>

            {['high', 'mid', 'low'].map((band) => (
              <div key={band} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <span style={{ fontSize: '0.5rem', color: '#6b7280', width: 14 }}>{band[0].toUpperCase()}</span>
                <input
                  type="range" min={-12} max={12} step={0.5} value={ch.eq[band]}
                  onChange={(e) => updateEq(i, band, parseFloat(e.target.value))}
                  style={{ width: 36, accentColor: CHANNEL_COLORS[i] }}
                />
              </div>
            ))}

            <input
              type="range" min={0} max={1} step={0.01} value={ch.volume}
              onChange={(e) => updateChannel(i, 'volume', parseFloat(e.target.value))}
              orient="vertical"
              style={{ writingMode: 'vertical-lr', direction: 'rtl', height: 60, accentColor: CHANNEL_COLORS[i] }}
            />
            <div style={{ fontSize: '0.5rem', color: '#e5e7eb' }}>{Math.round(ch.volume * 100)}</div>

            <input
              type="range" min={-1} max={1} step={0.01} value={ch.pan}
              onChange={(e) => updateChannel(i, 'pan', parseFloat(e.target.value))}
              style={{ width: 44, accentColor: CHANNEL_COLORS[i] }}
            />
            <div style={{ fontSize: '0.45rem', color: '#6b7280' }}>
              {ch.pan < -0.1 ? `L${Math.round(Math.abs(ch.pan) * 100)}` : ch.pan > 0.1 ? `R${Math.round(ch.pan * 100)}` : 'C'}
            </div>

            <div style={{ display: 'flex', gap: 2 }}>
              <button
                onClick={() => updateChannel(i, 'mute', !ch.mute)}
                style={{
                  width: 18, height: 16, fontSize: '0.45rem', fontWeight: 700, borderRadius: 3,
                  border: 'none', cursor: 'pointer',
                  background: ch.mute ? '#ef4444' : 'rgba(239,68,68,0.2)',
                  color: ch.mute ? '#fff' : '#ef4444',
                }}
              >
                M
              </button>
              <button
                onClick={() => updateChannel(i, 'solo', !ch.solo)}
                style={{
                  width: 18, height: 16, fontSize: '0.45rem', fontWeight: 700, borderRadius: 3,
                  border: 'none', cursor: 'pointer',
                  background: ch.solo ? '#eab308' : 'rgba(234,179,8,0.2)',
                  color: ch.solo ? '#000' : '#eab308',
                }}
              >
                S
              </button>
            </div>
          </div>
        ))}

        <div
          style={{
            minWidth: 60, padding: '8px 4px', background: 'rgba(168,85,247,0.08)',
            borderRadius: 8, border: '1px solid rgba(168,85,247,0.2)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          }}
        >
          <div style={{ fontSize: '0.55rem', fontWeight: 700, color: '#a855f7', letterSpacing: '0.08em' }}>MASTER</div>
          <input
            type="range" min={0} max={1} step={0.01} value={masterVol}
            onChange={(e) => setMasterVol(parseFloat(e.target.value))}
            orient="vertical"
            style={{ writingMode: 'vertical-lr', direction: 'rtl', height: 120, accentColor: '#a855f7' }}
          />
          <div style={{ fontSize: '0.55rem', color: '#e5e7eb', fontWeight: 700 }}>
            {Math.round(masterVol * 100)}
          </div>
        </div>
      </div>
    </div>
  );
}
