import { useState, useCallback, useRef, useEffect } from 'react';
import { useVideo } from '../context/VideoContext';
import { useAudioEngine } from '../context/AudioEngineContext';
import VideoPanel from '../components/VideoPanel';
import WaveformAnalyzer from '../components/WaveformAnalyzer';

const EFFECT_LANES = ['Cut', 'Flash', 'Zoom', 'Color', 'Shake'];
const EFFECT_COLORS = ['#a855f7', '#f97316', '#38bdf8', '#ec4899', '#22c55e'];

export default function VideoSuite() {
  const video = useVideo();
  const { init, decodeAudio } = useAudioEngine();
  const [audioBuffer, setAudioBuffer] = useState(null);
  const [effects, setEffects] = useState(EFFECT_LANES.map(() => []));
  const [status, setStatus] = useState('Drop audio/video to begin');
  const fileRef = useRef(null);

  const [dieterAudio, setDieterAudio] = useState(null);
  const [dieterCover, setDieterCover] = useState(null);
  const [dieterBusy, setDieterBusy] = useState(false);
  const [dieterErr, setDieterErr] = useState('');
  const [dieterVideoUrl, setDieterVideoUrl] = useState('');
  const [dieterCaps, setDieterCaps] = useState(null);

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/dieter/capabilities')
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ j }) => {
        if (!cancelled) setDieterCaps(j);
      })
      .catch(() => {
        if (!cancelled) setDieterCaps({ ffmpeg: false, error: 'unreachable' });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const runDieterMux = useCallback(async () => {
    setDieterErr('');
    setDieterVideoUrl('');
    if (!dieterAudio) {
      setDieterErr('Choose an audio file.');
      return;
    }
    if (!dieterCover) {
      setDieterErr('Choose cover artwork (JPG / PNG / WebP).');
      return;
    }
    setDieterBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', dieterAudio, dieterAudio.name || 'track.mp3');
      fd.append('cover_image', dieterCover, dieterCover.name || 'cover.jpg');
      fd.append('beat_times_json', '[]');
      fd.append('detect_beats', 'true');
      const r = await fetch('/api/dieter/music-video', { method: 'POST', body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        const msg = typeof j.error === 'string' ? j.error : typeof j.detail === 'string' ? j.detail : JSON.stringify(j);
        throw new Error(msg || r.statusText);
      }
      if (!j.url) throw new Error('No video URL in response');
      setDieterVideoUrl(j.url);
    } catch (e) {
      setDieterErr(String(e?.message || e));
    } finally {
      setDieterBusy(false);
    }
  }, [dieterAudio, dieterCover]);

  const loadFile = useCallback(async (file) => {
    try {
      const ac = init();
      const buf = await file.arrayBuffer();
      const decoded = await ac.decodeAudioData(buf);
      setAudioBuffer(decoded);

      const beats = detectBeats(decoded);
      const bpm = beats.length >= 2
        ? Math.round(60 / ((beats[beats.length - 1] - beats[0]) / (beats.length - 1)))
        : 0;
      video.setBeats(beats, bpm);
      setStatus(`Loaded: ${file.name} — ${beats.length} beats at ~${bpm} BPM`);
    } catch {
      setStatus('Error loading file');
    }
  }, [init, video]);

  const autoSync = useCallback(() => {
    if (video.beats.length === 0) return;
    const synced = EFFECT_LANES.map((_, lane) =>
      video.beats
        .filter((_, i) => i % (lane + 2) === 0)
        .map((b) => b / (audioBuffer?.duration || 1))
    );
    setEffects(synced);
    setStatus('Auto-synced effects to beats');
  }, [video.beats, audioBuffer]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 12, height: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
        <div
          className="panel"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer?.files[0]; if (f) loadFile(f); }}
          onClick={() => fileRef.current?.click()}
          style={{ cursor: 'pointer', textAlign: 'center' }}
        >
          <input ref={fileRef} type="file" accept="audio/*,video/*" hidden onChange={(e) => { if (e.target.files[0]) loadFile(e.target.files[0]); }} />
          <span style={{ fontSize: '1.5rem' }}>🎬</span>
          <div style={{ fontSize: '0.72rem', color: '#e5e7eb', marginTop: 4 }}>Drop audio or video file</div>
          <div style={{ fontSize: '0.6rem', color: '#6b7280' }}>MP3, WAV, MP4, WebM</div>
        </div>

        <WaveformAnalyzer buffer={audioBuffer} height={80} />

        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">🎞️ Beat-Sync Timeline</span>
            <span className="panel-badge">{video.beats.length} beats</span>
          </div>

          {EFFECT_LANES.map((name, i) => (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <div style={{ fontSize: '0.6rem', fontWeight: 600, color: EFFECT_COLORS[i], width: 40 }}>{name}</div>
              <div
                style={{
                  flex: 1, height: 24, background: 'rgba(18,22,42,0.5)',
                  borderRadius: 4, border: '1px solid rgba(168,85,247,0.1)',
                  position: 'relative', overflow: 'hidden',
                }}
              >
                {effects[i]?.map((pos, j) => (
                  <div
                    key={j}
                    style={{
                      position: 'absolute', left: `${pos * 100}%`, top: 0,
                      width: 4, height: '100%', background: EFFECT_COLORS[i],
                      borderRadius: 1,
                    }}
                  />
                ))}
              </div>
            </div>
          ))}

          <button className="btn btn-orange btn-full btn-sm" onClick={autoSync} style={{ marginTop: 6 }}>
            ⚡ Auto-Sync Effects to Beats
          </button>
        </div>

        <div style={{ fontSize: '0.62rem', color: '#6b7280', textAlign: 'center' }}>{status}</div>

        <div className="panel" style={{ marginTop: 8 }}>
          <div className="panel-header">
            <span className="panel-title">📀 Dieter · cover + song → MP4</span>
            <span className="panel-badge">
              {dieterCaps?.musicVideoFromImage ? 'ffmpeg OK' : dieterCaps?.error ? 'proxy' : '…'}
            </span>
          </div>
          <p style={{ fontSize: '0.62rem', color: '#9ca3af', margin: '0 0 8px' }}>
            Proxies to ED-GEERDES FastAPI <code style={{ fontSize: '0.6rem' }}>POST /api/local/music-video</code>.
            Set <code style={{ fontSize: '0.6rem' }}>DIETER_FASTAPI_URL</code> on the Node server (e.g. Render).
          </p>
          <label style={{ fontSize: '0.65rem', display: 'block', marginBottom: 6 }}>
            Audio
            <input
              type="file"
              accept="audio/*,.mp3,.wav,.flac,.m4a"
              style={{ display: 'block', marginTop: 4, fontSize: '0.65rem' }}
              onChange={(e) => setDieterAudio(e.target.files?.[0] ?? null)}
            />
          </label>
          <label style={{ fontSize: '0.65rem', display: 'block', marginBottom: 6 }}>
            Cover image
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style={{ display: 'block', marginTop: 4, fontSize: '0.65rem' }}
              onChange={(e) => setDieterCover(e.target.files?.[0] ?? null)}
            />
          </label>
          <button
            type="button"
            className="btn btn-purple btn-full btn-sm"
            disabled={dieterBusy}
            onClick={() => void runDieterMux()}
          >
            {dieterBusy ? 'Rendering…' : 'Merge cover + audio (Dieter API)'}
          </button>
          {dieterErr && (
            <p style={{ fontSize: '0.65rem', color: '#f87171', marginTop: 8 }} role="alert">
              {dieterErr}
            </p>
          )}
          {dieterVideoUrl && (
            <video src={dieterVideoUrl} controls style={{ width: '100%', marginTop: 8, borderRadius: 8 }} />
          )}
        </div>
      </div>

      <div style={{ overflowY: 'auto' }}>
        <VideoPanel />
      </div>
    </div>
  );
}

function detectBeats(buffer) {
  const data = buffer.getChannelData(0);
  const sr = buffer.sampleRate;
  const winSize = Math.floor(sr * 0.03);
  const hopSize = Math.floor(sr * 0.01);
  const energies = [];

  for (let i = 0; i < data.length - winSize; i += hopSize) {
    let e = 0;
    for (let j = 0; j < winSize; j++) e += data[i + j] * data[i + j];
    energies.push(e / winSize);
  }

  const localWindow = Math.floor(sr * 0.5 / hopSize);
  const threshold = 1.8;
  const beats = [];
  let lastBeat = -sr;

  for (let i = localWindow; i < energies.length - localWindow; i++) {
    let avg = 0;
    for (let j = i - localWindow; j <= i + localWindow; j++) avg += energies[j];
    avg /= localWindow * 2 + 1;
    if (energies[i] > avg * threshold && (i * hopSize - lastBeat) > sr * 0.15) {
      beats.push((i * hopSize) / sr);
      lastBeat = i * hopSize;
    }
  }
  return beats;
}
