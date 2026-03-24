import { Link } from 'react-router-dom';
import WaveformAnalyzer from '../components/WaveformAnalyzer';

const FEATURES = [
  { to: '/studio', icon: '🎵', title: 'Music Studio', desc: 'AI-powered track generation with 6 voices, genre control, and real-time mixing', color: '#a855f7' },
  { to: '/granular', icon: '🔬', title: 'Granular Engine', desc: '250+ presets, circular XY pad, 7-FX chain, AudioWorklet synthesis', color: '#f97316' },
  { to: '/mixer', icon: '🎛️', title: 'Mixer Pro', desc: '8-channel mixer with EQ, pan, sends, and master dynamics', color: '#22c55e' },
  { to: '/video', icon: '🎬', title: 'Video Suite', desc: 'Beat-synced AI video with 5 visual styles and WebM export', color: '#38bdf8' },
  { to: '/samples', icon: '🪐', title: 'Sample Universe', desc: 'Browse, search, and audition thousands of samples and loops', color: '#ec4899' },
  { to: '/marketplace', icon: '🛒', title: 'Marketplace', desc: 'Buy, sell, and trade beats, samples, and presets', color: '#eab308' },
  { to: '/models', icon: '🤖', title: 'Model Library', desc: 'ElevenLabs, Suno, Kling, Veo 3 — all AI engines at your fingertips', color: '#06b6d4' },
];

const STATS = [
  { value: '250+', label: 'Granular Presets' },
  { value: '6', label: 'AI Voices' },
  { value: '7', label: 'Effect Chains' },
  { value: '5', label: 'Video Styles' },
  { value: '8', label: 'Mixer Channels' },
  { value: '∞', label: 'Possibilities' },
];

export default function Home() {
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', padding: '30px 0 20px' }}>
        <div style={{ fontSize: '2.2rem', fontWeight: 900, background: 'linear-gradient(135deg, #a855f7, #ec4899, #f97316)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.02em' }}>
          DIETER PRO
        </div>
        <div style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: 6, letterSpacing: '0.15em' }}>
          AI MUSIC & VIDEO PRODUCTION SUITE
        </div>
        <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: 8, maxWidth: 500, margin: '8px auto 0' }}>
          Generate, mix, master, and distribute — all from one studio. Powered by Web Audio API, AudioWorklet granular synthesis, and AI video generation.
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap', margin: '20px 0' }}>
        {STATS.map((s) => (
          <div key={s.label} style={{ textAlign: 'center', padding: '10px 16px', background: 'rgba(168,85,247,0.06)', borderRadius: 10, border: '1px solid rgba(168,85,247,0.12)' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#a855f7' }}>{s.value}</div>
            <div style={{ fontSize: '0.58rem', color: '#6b7280', letterSpacing: '0.06em' }}>{s.label}</div>
          </div>
        ))}
      </div>

      <WaveformAnalyzer width={1000} height={80} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280, 1fr))', gap: 12, marginTop: 20 }}>
        {FEATURES.map((f) => (
          <Link
            key={f.to}
            to={f.to}
            style={{
              display: 'block',
              padding: 16,
              borderRadius: 12,
              border: `1px solid ${f.color}22`,
              background: `${f.color}08`,
              textDecoration: 'none',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = f.color + '55'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = f.color + '22'; e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>{f.icon}</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#e5e7eb', marginBottom: 4 }}>{f.title}</div>
            <div style={{ fontSize: '0.68rem', color: '#6b7280', lineHeight: 1.5 }}>{f.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
