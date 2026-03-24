import { useMemo } from 'react';
import { useGranular } from '../context/GranularContext';

const CATEGORIES = ['All', 'Pads', 'Textures', 'Atmospheres', 'Drones', 'Leads', 'Bass', 'Percussion', 'Vocals', 'Nature', 'Cinematic', 'Glitch'];

export default function GranularPresets() {
  const { filteredPresets, activePreset, loadPreset, presetSearch, setSearch, presetCategory, setCategory } = useGranular();

  const grouped = useMemo(() => {
    const map = {};
    for (const p of filteredPresets) {
      if (!map[p.category]) map[p.category] = [];
      map[p.category].push(p);
    }
    return map;
  }, [filteredPresets]);

  return (
    <div className="panel" style={{ maxHeight: 400, display: 'flex', flexDirection: 'column' }}>
      <div className="panel-header">
        <span className="panel-title">🎛️ Presets ({filteredPresets.length})</span>
      </div>

      <input
        type="text"
        placeholder="Search presets..."
        value={presetSearch}
        onChange={(e) => setSearch(e.target.value)}
        style={{ marginBottom: 8 }}
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 8 }}>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            className={`tag${presetCategory === c ? ' active' : ''}`}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {presetCategory === 'All' ? (
          Object.entries(grouped).map(([cat, presets]) => (
            <div key={cat} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: '0.6rem', color: '#c084fc', letterSpacing: '0.1em', marginBottom: 4, textTransform: 'uppercase' }}>
                {cat} ({presets.length})
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {presets.map((p) => (
                  <PresetChip key={p.id} preset={p} active={p.id === activePreset} onClick={() => loadPreset(p)} />
                ))}
              </div>
            </div>
          ))
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {filteredPresets.map((p) => (
              <PresetChip key={p.id} preset={p} active={p.id === activePreset} onClick={() => loadPreset(p)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PresetChip({ preset, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '3px 8px',
        borderRadius: 999,
        border: `1px solid ${active ? '#a855f7' : 'rgba(168,85,247,0.15)'}`,
        background: active ? 'rgba(168,85,247,0.2)' : 'transparent',
        color: active ? '#e5e7eb' : '#6b7280',
        fontSize: '0.6rem',
        fontWeight: active ? 600 : 400,
        cursor: 'pointer',
        transition: 'all 0.15s',
        whiteSpace: 'nowrap',
      }}
    >
      {preset.name}
    </button>
  );
}
