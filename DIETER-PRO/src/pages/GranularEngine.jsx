import { useCallback, useRef, useEffect, useState } from 'react';
import { useGranular } from '../context/GranularContext';
import { useAudioEngine } from '../context/AudioEngineContext';
import GranularXYPad from '../components/GranularXYPad';
import GranularPresets from '../components/GranularPresets';
import GranularFX from '../components/GranularFX';
import WaveformAnalyzer from '../components/WaveformAnalyzer';

const PARAM_SLIDERS = [
  { key: 'grainSize', label: 'Grain Size', min: 5, max: 500, step: 1, unit: 'ms' },
  { key: 'density', label: 'Density', min: 1, max: 50, step: 0.5, unit: '/s' },
  { key: 'pitch', label: 'Pitch', min: -24, max: 24, step: 0.1, unit: 'st' },
  { key: 'position', label: 'Position', min: 0, max: 1, step: 0.001, unit: '' },
  { key: 'spread', label: 'Spread', min: 0, max: 1, step: 0.01, unit: '' },
  { key: 'attack', label: 'Attack', min: 0, max: 0.5, step: 0.001, unit: 's' },
  { key: 'release', label: 'Release', min: 0, max: 0.5, step: 0.001, unit: 's' },
  { key: 'pan', label: 'Pan', min: -1, max: 1, step: 0.01, unit: '' },
];

export default function GranularEngine() {
  const granular = useGranular();
  const { init, masterGainRef } = useAudioEngine();
  const [status, setStatus] = useState('Load a sample to begin');
  const workletRef = useRef(null);
  const fileInputRef = useRef(null);

  const loadSample = useCallback(async (file) => {
    try {
      const ac = init();
      const arrayBuf = await file.arrayBuffer();
      const audioBuffer = await ac.decodeAudioData(arrayBuf);
      granular.setSource(audioBuffer, file.name);
      setStatus(`Loaded: ${file.name} (${audioBuffer.duration.toFixed(1)}s)`);

      if (!workletRef.current) {
        try {
          await ac.audioWorklet.addModule('/src/workers/granularProcessor.js');
          workletRef.current = new AudioWorkletNode(ac, 'granular-processor', { outputChannelCount: [2] });
          workletRef.current.connect(masterGainRef.current);
        } catch {
          setStatus('AudioWorklet unavailable — using ScriptProcessor fallback');
        }
      }

      if (workletRef.current) {
        const channelData = audioBuffer.getChannelData(0);
        workletRef.current.port.postMessage({
          type: 'setBuffer',
          data: { buffer: channelData, length: channelData.length, sampleRate: audioBuffer.sampleRate },
        });
      }
    } catch (err) {
      setStatus('Error loading sample: ' + err.message);
    }
  }, [init, granular, masterGainRef]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files[0];
    if (file && file.type.startsWith('audio/')) loadSample(file);
  }, [loadSample]);

  const togglePlay = useCallback(() => {
    if (!granular.sourceBuffer) { setStatus('Load a sample first'); return; }
    init();
    const playing = !granular.isPlaying;
    granular.setParam('isPlaying', playing);
    if (workletRef.current) {
      workletRef.current.port.postMessage({ type: playing ? 'start' : 'stop' });
    }
    setStatus(playing ? 'Playing granular synthesis' : 'Stopped');
  }, [granular, init]);

  useEffect(() => {
    if (!workletRef.current) return;
    workletRef.current.port.postMessage({
      type: 'setParams',
      data: {
        grainSize: granular.grainSize,
        density: granular.density,
        pitch: granular.pitch,
        position: granular.position,
        spread: granular.spread,
        attack: granular.attack,
        release: granular.release,
        pan: granular.pan,
      },
    });
  }, [granular.grainSize, granular.density, granular.pitch, granular.position, granular.spread, granular.attack, granular.release, granular.pan]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr 280px', gap: 12, height: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
        <GranularPresets />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
        <div
          className="panel"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          style={{ textAlign: 'center', cursor: 'pointer' }}
          onClick={() => fileInputRef.current?.click()}
        >
          <input ref={fileInputRef} type="file" accept="audio/*" hidden onChange={(e) => { if (e.target.files[0]) loadSample(e.target.files[0]); e.target.value = ''; }} />
          <div style={{ fontSize: '1.5rem', marginBottom: 4 }}>📂</div>
          <div style={{ fontSize: '0.72rem', color: '#e5e7eb', fontWeight: 600 }}>
            {granular.sourceName || 'Drop or click to load sample'}
          </div>
          <div style={{ fontSize: '0.6rem', color: '#6b7280', marginTop: 2 }}>WAV, MP3, OGG, FLAC</div>
        </div>

        <WaveformAnalyzer buffer={granular.sourceBuffer} height={80} />

        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, alignItems: 'flex-start' }}>
          <GranularXYPad size={220} />
          <div className="panel" style={{ flex: 1 }}>
            <div className="panel-header"><span className="panel-title">🎛️ Parameters</span></div>
            {PARAM_SLIDERS.map((s) => (
              <div key={s.key} className="slider-row">
                <label>{s.label}</label>
                <input
                  type="range"
                  min={s.min}
                  max={s.max}
                  step={s.step}
                  value={granular[s.key]}
                  onChange={(e) => granular.setParam(s.key, parseFloat(e.target.value))}
                />
                <span className="val">
                  {typeof granular[s.key] === 'number' ? (Number.isInteger(s.step) ? granular[s.key] : granular[s.key].toFixed(s.step < 0.01 ? 3 : s.step < 0.1 ? 2 : 1)) : granular[s.key]}
                  {s.unit ? ` ${s.unit}` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button className={`btn ${granular.isPlaying ? 'btn-red' : 'btn-green'}`} onClick={togglePlay}>
            {granular.isPlaying ? '■ Stop' : '▶ Play'}
          </button>
          <button className="btn btn-ghost" onClick={() => { granular.setParam('position', 0.5); granular.setParam('density', 10); granular.setParam('pitch', 0); }}>
            ↺ Reset
          </button>
        </div>

        <div style={{ fontSize: '0.62rem', color: '#6b7280', textAlign: 'center' }}>{status}</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
        <GranularFX />
      </div>
    </div>
  );
}
