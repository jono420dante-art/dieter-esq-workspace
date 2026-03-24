import { useStudio } from '../context/StudioContext';

const VOICE_ICONS = { F: '👩', M: '👨', N: '🤖' };

export default function VoiceSelector() {
  const { voices, selectedVoice, setVoice } = useStudio();

  return (
    <div className="panel">
      <div className="panel-header">
        <span className="panel-title">🎤 Voices</span>
        <span className="panel-badge">{voices.length} available</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {voices.map((v) => (
          <button
            key={v.id}
            onClick={() => setVoice(v.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 10px',
              borderRadius: 8,
              border: `1px solid ${selectedVoice === v.id ? '#a855f7' : 'rgba(168,85,247,0.12)'}`,
              background: selectedVoice === v.id ? 'rgba(168,85,247,0.12)' : 'transparent',
              color: selectedVoice === v.id ? '#e5e7eb' : '#6b7280',
              cursor: 'pointer',
              transition: 'all 0.15s',
              textAlign: 'left',
              fontSize: '0.72rem',
            }}
          >
            <span style={{ fontSize: '1.1rem' }}>{VOICE_ICONS[v.gender]}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{v.name}</div>
              <div style={{ fontSize: '0.58rem', color: '#6b7280' }}>{v.style}</div>
            </div>
            {selectedVoice === v.id && (
              <span style={{ fontSize: '0.6rem', color: '#22c55e' }}>●</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
