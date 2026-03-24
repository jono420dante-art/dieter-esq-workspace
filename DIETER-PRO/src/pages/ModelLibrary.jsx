import { useState } from 'react';
import PortalsPanel from '../components/PortalsPanel';

const MODELS = [
  {
    id: 'eleven',
    name: 'ElevenLabs Music',
    provider: 'ElevenLabs',
    icon: '🎙️',
    color: '#a855f7',
    capabilities: ['Voice synthesis', 'Vocal cloning', 'Text-to-singing', 'Multi-language'],
    status: 'active',
    latency: '~3s',
    quality: '96/100',
  },
  {
    id: 'suno',
    name: 'Suno AI',
    provider: 'Suno',
    icon: '🎵',
    color: '#f97316',
    capabilities: ['Full song generation', 'Lyrics-to-music', 'Style transfer', '30+ genres'],
    status: 'active',
    latency: '~8s',
    quality: '94/100',
  },
  {
    id: 'kling',
    name: 'Kling Video',
    provider: 'Kuaishou',
    icon: '🎬',
    color: '#38bdf8',
    capabilities: ['Text-to-video', 'Music video generation', '20+ templates', 'HD output'],
    status: 'active',
    latency: '~15s',
    quality: '91/100',
  },
  {
    id: 'veo3',
    name: 'Google Veo 3',
    provider: 'Google DeepMind',
    icon: '🌐',
    color: '#22c55e',
    capabilities: ['Audio-reactive video', 'Cinematic generation', '4K upscaling', '18 styles'],
    status: 'active',
    latency: '~12s',
    quality: '95/100',
  },
  {
    id: 'granular',
    name: 'Granular Engine',
    provider: 'DIETER PRO',
    icon: '🔬',
    color: '#ec4899',
    capabilities: ['AudioWorklet synthesis', '250+ presets', 'Real-time XY control', '7-FX chain'],
    status: 'active',
    latency: '<1ms',
    quality: '99/100',
  },
  {
    id: 'stems',
    name: 'Stem Splitter',
    provider: 'DIETER PRO',
    icon: '🧬',
    color: '#eab308',
    capabilities: ['Vocals extraction', 'Drums isolation', 'Bass separation', 'Web Worker processing'],
    status: 'active',
    latency: '~5s',
    quality: '85/100',
  },
];

export default function ModelLibrary() {
  const [selected, setSelected] = useState(null);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 12, height: '100%' }}>
      <div style={{ overflowY: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 10 }}>
          {MODELS.map((m) => (
            <div
              key={m.id}
              className="panel"
              onClick={() => setSelected(m)}
              style={{
                cursor: 'pointer',
                border: `1px solid ${selected?.id === m.id ? m.color : m.color + '22'}`,
                transition: 'all 0.2s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: '1.5rem' }}>{m.icon}</span>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#e5e7eb' }}>{m.name}</div>
                  <div style={{ fontSize: '0.6rem', color: '#6b7280' }}>{m.provider}</div>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px rgba(34,197,94,0.5)' }} />
                  <span style={{ fontSize: '0.58rem', color: '#22c55e' }}>{m.status}</span>
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 8 }}>
                {m.capabilities.map((c) => (
                  <span key={c} style={{ fontSize: '0.55rem', padding: '2px 7px', borderRadius: 999, background: `${m.color}12`, border: `1px solid ${m.color}33`, color: m.color }}>{c}</span>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 12, fontSize: '0.6rem' }}>
                <div><span style={{ color: '#6b7280' }}>Latency:</span> <span style={{ color: '#e5e7eb', fontWeight: 600 }}>{m.latency}</span></div>
                <div><span style={{ color: '#6b7280' }}>Quality:</span> <span style={{ color: m.color, fontWeight: 600 }}>{m.quality}</span></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {selected ? (
          <div className="panel">
            <div className="panel-header"><span className="panel-title">{selected.icon} {selected.name}</span></div>
            <div style={{ fontSize: '0.7rem', color: '#e5e7eb', marginBottom: 8 }}>
              {selected.provider} — {selected.capabilities.length} capabilities
            </div>
            <div style={{ marginBottom: 8 }}>
              {selected.capabilities.map((c) => (
                <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, fontSize: '0.68rem' }}>
                  <span style={{ color: '#22c55e' }}>✓</span>
                  <span style={{ color: '#e5e7eb' }}>{c}</span>
                </div>
              ))}
            </div>
            <button className="btn btn-purple btn-full btn-sm">Launch {selected.name}</button>
          </div>
        ) : (
          <div className="panel" style={{ textAlign: 'center', padding: 24 }}>
            <span style={{ fontSize: '1.5rem' }}>🤖</span>
            <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: 8 }}>Select a model to view details</div>
          </div>
        )}

        <PortalsPanel />
      </div>
    </div>
  );
}
