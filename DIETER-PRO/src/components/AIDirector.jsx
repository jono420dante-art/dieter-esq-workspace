import { useState, useCallback } from 'react';
import { useStudio } from '../context/StudioContext';

const SUGGESTION_TYPES = [
  { id: 'arrangement', icon: '🎼', label: 'Arrangement' },
  { id: 'production', icon: '🎛️', label: 'Production' },
  { id: 'mixing', icon: '🎚️', label: 'Mixing' },
  { id: 'mastering', icon: '💎', label: 'Mastering' },
];

export default function AIDirector() {
  const { selectedGenre, selectedMood, bpm, key: musicalKey } = useStudio();
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeType, setActiveType] = useState('production');

  const getSuggestions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/director/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ genre: selectedGenre, mood: selectedMood, bpm, key: musicalKey, type: activeType }),
      });
      const data = await res.json();
      setSuggestions(data.suggestions || []);
    } catch {
      setSuggestions([
        { text: `Try adding a ${selectedMood.toLowerCase()} pad layer in ${musicalKey} ${bpm > 120 ? 'with syncopated rhythms' : 'with sustained chords'}`, confidence: 0.92 },
        { text: `The ${selectedGenre} genre typically benefits from ${bpm > 130 ? 'sidechained bass' : 'warm analog textures'}`, confidence: 0.87 },
        { text: `Consider a ${selectedMood.toLowerCase()} breakdown at bar 16 with filtered sweeps`, confidence: 0.84 },
        { text: `Layer in some ${selectedGenre.toLowerCase()} vocal chops for extra energy`, confidence: 0.79 },
      ]);
    } finally {
      setLoading(false);
    }
  }, [selectedGenre, selectedMood, bpm, musicalKey, activeType]);

  return (
    <div className="panel">
      <div className="panel-header">
        <span className="panel-title">🤖 AI Director</span>
        <span className="panel-badge">{selectedGenre} · {selectedMood}</span>
      </div>

      <div style={{ display: 'flex', gap: 3, marginBottom: 10 }}>
        {SUGGESTION_TYPES.map((t) => (
          <button
            key={t.id}
            className={`tag${activeType === t.id ? ' active' : ''}`}
            onClick={() => setActiveType(t.id)}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <button className="btn btn-purple btn-full btn-sm" onClick={getSuggestions} disabled={loading}>
        {loading ? '⏳ Analyzing...' : '⚡ Get AI Suggestions'}
      </button>

      {suggestions.length > 0 && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {suggestions.map((s, i) => (
            <div
              key={i}
              style={{
                padding: '8px 10px',
                background: 'rgba(168, 85, 247, 0.06)',
                borderRadius: 8,
                border: '1px solid rgba(168, 85, 247, 0.12)',
                fontSize: '0.7rem',
                lineHeight: 1.5,
              }}
            >
              <div style={{ color: '#e5e7eb' }}>{s.text}</div>
              <div style={{ marginTop: 4, fontSize: '0.58rem', color: '#6b7280' }}>
                Confidence: {(s.confidence * 100).toFixed(0)}%
                <span
                  style={{
                    display: 'inline-block',
                    width: 40,
                    height: 3,
                    background: 'rgba(168,85,247,0.2)',
                    borderRadius: 2,
                    marginLeft: 6,
                    verticalAlign: 'middle',
                  }}
                >
                  <span
                    style={{
                      display: 'block',
                      width: `${s.confidence * 100}%`,
                      height: '100%',
                      background: '#a855f7',
                      borderRadius: 2,
                    }}
                  />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
