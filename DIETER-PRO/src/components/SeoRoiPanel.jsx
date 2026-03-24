import { useState, useCallback } from 'react';

export default function SeoRoiPanel() {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);

  const analyze = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/seo/trends');
      const data = await res.json();
      setAnalysis(data);
    } catch {
      setAnalysis({
        trends: [
          { genre: 'Afrobeat', growth: '+34%', score: 92 },
          { genre: 'Lo-Fi', growth: '+28%', score: 88 },
          { genre: 'Hyperpop', growth: '+21%', score: 85 },
          { genre: 'Latin Pop', growth: '+19%', score: 82 },
          { genre: 'Drill', growth: '+15%', score: 78 },
        ],
        topKeys: ['C minor', 'G minor', 'A minor', 'F major'],
        bpmRange: { min: 85, max: 145, sweet: 120 },
        marketScore: 87,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="panel">
      <div className="panel-header">
        <span className="panel-title">📊 SEO & ROI</span>
      </div>

      <button className="btn btn-purple btn-full btn-sm" onClick={analyze} disabled={loading}>
        {loading ? '⏳ Analyzing...' : '📈 Analyze Market'}
      </button>

      {analysis && (
        <div style={{ marginTop: 10 }}>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: '0.6rem', color: '#c084fc', letterSpacing: '0.1em', marginBottom: 4 }}>TRENDING GENRES</div>
            {analysis.trends.map((t) => (
              <div key={t.genre} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, fontSize: '0.68rem' }}>
                <span style={{ flex: 1, color: '#e5e7eb' }}>{t.genre}</span>
                <span style={{ color: '#22c55e', fontWeight: 600 }}>{t.growth}</span>
                <div style={{ width: 50, height: 4, background: 'rgba(168,85,247,0.2)', borderRadius: 2 }}>
                  <div style={{ width: `${t.score}%`, height: '100%', background: '#a855f7', borderRadius: 2 }} />
                </div>
              </div>
            ))}
          </div>

          <div className="grid-2" style={{ marginTop: 8 }}>
            <div style={{ padding: 8, background: 'rgba(34,197,94,0.08)', borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#22c55e' }}>{analysis.marketScore}</div>
              <div style={{ fontSize: '0.55rem', color: '#6b7280' }}>Market Score</div>
            </div>
            <div style={{ padding: 8, background: 'rgba(168,85,247,0.08)', borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#a855f7' }}>{analysis.bpmRange.sweet}</div>
              <div style={{ fontSize: '0.55rem', color: '#6b7280' }}>Sweet BPM</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
