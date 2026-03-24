import { useGranular } from '../context/GranularContext';

const FX_DEFS = [
  { key: 'reverb', label: 'Reverb', min: 0, max: 1, step: 0.01, icon: '🏛️' },
  { key: 'delay', label: 'Delay', min: 0, max: 1, step: 0.01, icon: '🔄' },
  { key: 'delayTime', label: 'Delay Time', min: 0.01, max: 2, step: 0.01, icon: '⏱️', unit: 's' },
  { key: 'delayFeedback', label: 'Feedback', min: 0, max: 0.95, step: 0.01, icon: '♻️' },
  { key: 'chorus', label: 'Chorus', min: 0, max: 1, step: 0.01, icon: '🌊' },
  { key: 'distortion', label: 'Distortion', min: 0, max: 1, step: 0.01, icon: '🔥' },
  { key: 'filter', label: 'Filter Freq', min: 20, max: 20000, step: 1, icon: '🎚️', unit: 'Hz' },
  { key: 'filterQ', label: 'Filter Q', min: 0.1, max: 20, step: 0.1, icon: '📐' },
];

const FILTER_TYPES = ['lowpass', 'highpass', 'bandpass', 'notch'];

export default function GranularFX() {
  const { fx, setFx } = useGranular();

  return (
    <div className="panel">
      <div className="panel-header">
        <span className="panel-title">✨ Effects Chain</span>
        <span className="panel-badge">7 FX + Master</span>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
        {FILTER_TYPES.map((t) => (
          <button
            key={t}
            className={`tag${fx.filterType === t ? ' active' : ''}`}
            onClick={() => setFx('filterType', t)}
            style={{ textTransform: 'capitalize' }}
          >
            {t}
          </button>
        ))}
      </div>

      {FX_DEFS.map((def) => (
        <div key={def.key} className="slider-row">
          <label>{def.icon} {def.label}</label>
          <input
            type="range"
            min={def.min}
            max={def.max}
            step={def.step}
            value={fx[def.key]}
            onChange={(e) => setFx(def.key, parseFloat(e.target.value))}
          />
          <span className="val">
            {def.key === 'filter'
              ? fx[def.key] >= 1000
                ? `${(fx[def.key] / 1000).toFixed(1)}k`
                : Math.round(fx[def.key])
              : fx[def.key].toFixed(2)}
            {def.unit ? ` ${def.unit}` : ''}
          </span>
        </div>
      ))}

      <div style={{ marginTop: 8, padding: '6px 8px', background: 'rgba(168,85,247,0.06)', borderRadius: 8, fontSize: '0.6rem', color: '#6b7280' }}>
        Signal: Source → Filter → Chorus → Distortion → Delay → Reverb → Master
      </div>
    </div>
  );
}
