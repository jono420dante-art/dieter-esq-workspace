import { useState, useCallback, useRef } from 'react';
import { useAudioEngine } from '../context/AudioEngineContext';

const SAMPLE_CATEGORIES = ['All', 'Drums', 'Bass', 'Synths', 'Vocals', 'FX', 'Loops', 'One Shots', 'Pads', 'Strings'];

const MOCK_SAMPLES = Array.from({ length: 60 }, (_, i) => ({
  id: `sample-${i}`,
  name: ['Punchy Kick', '808 Sub', 'Vinyl Crackle', 'Vocal Chop', 'Snare Roll', 'Hi-Hat Loop', 'Pad Swell', 'Guitar Riff', 'Piano Chord', 'Brass Stab'][i % 10] + ` ${Math.floor(i / 10) + 1}`,
  category: SAMPLE_CATEGORIES[1 + (i % 9)],
  duration: (0.2 + Math.random() * 4).toFixed(1),
  bpm: [80, 90, 100, 110, 120, 130, 140][i % 7],
  key: ['C', 'D', 'E', 'F', 'G', 'A', 'B'][i % 7],
  tags: [['punchy'], ['sub', 'deep'], ['lofi'], ['vocal'], ['energetic'], ['rhythmic'], ['ambient'], ['acoustic'], ['classic'], ['bright']][i % 10],
}));

export default function SampleUniverse() {
  const { init, playBuffer, decodeAudio, stopAll } = useAudioEngine();
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [playing, setPlaying] = useState(null);
  const [bpmFilter, setBpmFilter] = useState(0);
  const [keyFilter, setKeyFilter] = useState('');

  const filtered = MOCK_SAMPLES.filter((s) => {
    if (category !== 'All' && s.category !== category) return false;
    if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (bpmFilter && Math.abs(s.bpm - bpmFilter) > 10) return false;
    if (keyFilter && s.key !== keyFilter) return false;
    return true;
  });

  const preview = useCallback((sample) => {
    setPlaying(sample.id);
    setTimeout(() => setPlaying(null), parseFloat(sample.duration) * 1000);
  }, []);

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <input type="text" placeholder="Search samples..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 200 }} />
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {SAMPLE_CATEGORIES.map((c) => (
            <button key={c} className={`tag${category === c ? ' active' : ''}`} onClick={() => setCategory(c)}>{c}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <div className="slider-row" style={{ flex: 1 }}>
          <label>BPM Filter</label>
          <input type="range" min={0} max={200} value={bpmFilter} onChange={(e) => setBpmFilter(+e.target.value)} />
          <span className="val">{bpmFilter || 'Any'}</span>
        </div>
        <select value={keyFilter} onChange={(e) => setKeyFilter(e.target.value)} style={{ maxWidth: 80 }}>
          <option value="">Any Key</option>
          {['C', 'D', 'E', 'F', 'G', 'A', 'B'].map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
      </div>

      <div style={{ fontSize: '0.65rem', color: '#6b7280', marginBottom: 8 }}>{filtered.length} samples found</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {filtered.map((s) => (
          <div
            key={s.id}
            onClick={() => preview(s)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 12px',
              borderRadius: 8,
              border: `1px solid ${playing === s.id ? '#a855f7' : 'rgba(168,85,247,0.1)'}`,
              background: playing === s.id ? 'rgba(168,85,247,0.08)' : 'rgba(18,22,42,0.3)',
              cursor: 'pointer',
              transition: 'all 0.15s',
              fontSize: '0.72rem',
            }}
          >
            <span style={{ fontSize: '0.9rem', width: 20, textAlign: 'center' }}>
              {playing === s.id ? '🔊' : '▶'}
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, color: '#e5e7eb' }}>{s.name}</div>
              <div style={{ fontSize: '0.58rem', color: '#6b7280', display: 'flex', gap: 8 }}>
                <span>{s.category}</span>
                <span>{s.duration}s</span>
                <span>{s.bpm} BPM</span>
                <span>Key: {s.key}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 3 }}>
              {s.tags.map((t) => (
                <span key={t} className="tag" style={{ fontSize: '0.5rem', padding: '1px 5px' }}>{t}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
