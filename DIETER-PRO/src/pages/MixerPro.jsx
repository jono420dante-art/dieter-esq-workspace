import MixerConsole from '../components/MixerConsole';
import WaveformAnalyzer from '../components/WaveformAnalyzer';
import SeoRoiPanel from '../components/SeoRoiPanel';

export default function MixerPro() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 12, height: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
        <MixerConsole />
        <WaveformAnalyzer height={80} />

        <div className="panel">
          <div className="panel-header"><span className="panel-title">🔊 Master Bus</span></div>
          <div className="grid-3">
            <MasterControl label="Compressor" params={[
              { name: 'Threshold', value: -18, unit: 'dB' },
              { name: 'Ratio', value: 4, unit: ':1' },
              { name: 'Attack', value: 3, unit: 'ms' },
            ]} color="#a855f7" />
            <MasterControl label="EQ" params={[
              { name: 'Low', value: 0, unit: 'dB' },
              { name: 'Mid', value: 0, unit: 'dB' },
              { name: 'High', value: 0, unit: 'dB' },
            ]} color="#22c55e" />
            <MasterControl label="Limiter" params={[
              { name: 'Ceiling', value: -0.3, unit: 'dB' },
              { name: 'Release', value: 50, unit: 'ms' },
              { name: 'Gain', value: 0, unit: 'dB' },
            ]} color="#f97316" />
          </div>
        </div>

        <div className="panel">
          <div className="panel-header"><span className="panel-title">📤 Export</span></div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button className="btn btn-purple btn-sm">WAV 24-bit</button>
            <button className="btn btn-blue btn-sm">MP3 320k</button>
            <button className="btn btn-green btn-sm">FLAC</button>
            <button className="btn btn-orange btn-sm">Stems</button>
            <button className="btn btn-ghost btn-sm">OGG</button>
          </div>
        </div>
      </div>

      <div style={{ overflowY: 'auto' }}>
        <SeoRoiPanel />
      </div>
    </div>
  );
}

function MasterControl({ label, params, color }) {
  return (
    <div style={{ padding: 10, borderRadius: 8, border: `1px solid ${color}22`, background: `${color}06` }}>
      <div style={{ fontSize: '0.6rem', fontWeight: 700, color, letterSpacing: '0.08em', marginBottom: 6 }}>{label}</div>
      {params.map((p) => (
        <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: '0.6rem' }}>
          <span style={{ color: '#6b7280' }}>{p.name}</span>
          <span style={{ color: '#e5e7eb', fontWeight: 600 }}>{p.value} {p.unit}</span>
        </div>
      ))}
    </div>
  );
}
