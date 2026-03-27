import { useState, useCallback } from 'react';
import { useStudio } from '../context/StudioContext';
import { useAudioEngine } from '../context/AudioEngineContext';
import VoiceSelector from '../components/VoiceSelector';
import AIDirector from '../components/AIDirector';
import DJConsole from '../components/DJConsole';
import WaveformAnalyzer from '../components/WaveformAnalyzer';

const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const SCALES = ['major', 'minor', 'dorian', 'mixolydian', 'phrygian', 'pentatonic'];

const POLL_MS = 2000;
const POLL_MAX = 90;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export default function MusicStudio() {
  const studio = useStudio();
  const { playBuffer, decodeAudio } = useAudioEngine();
  const [prompt, setPrompt] = useState('');
  const [duration, setDuration] = useState(30);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');
  const [generatedTracks, setGeneratedTracks] = useState([]);

  const generate = useCallback(async () => {
    if (!prompt.trim()) return;
    setGenError('');
    setGenerating(true);
    studio.setGenerating(true);
    const trackBase = {
      id: crypto.randomUUID(),
      jobId: null,
      prompt,
      genre: studio.selectedGenre,
      mood: studio.selectedMood,
      bpm: studio.bpm,
      status: 'starting',
      audioUrl: null,
      error: null,
      createdAt: Date.now(),
    };
    setGeneratedTracks((prev) => [trackBase, ...prev]);

    try {
      const res = await fetch('/api/music/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          genre: studio.selectedGenre,
          mood: studio.selectedMood,
          bpm: studio.bpm,
          key: studio.key,
          scale: studio.scale,
          voice: studio.selectedVoice,
          duration,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || res.statusText || 'Generate request failed');
      }
      const jobId = data.jobId;
      if (!jobId) throw new Error('No job id returned');

      setGeneratedTracks((prev) =>
        prev.map((t) => (t.id === trackBase.id ? { ...t, jobId, status: 'processing' } : t)),
      );

      let audioUrl = null;
      let failErr = null;
      for (let i = 0; i < POLL_MAX; i += 1) {
        await sleep(POLL_MS);
        const poll = await fetch(`/api/music/prediction/${encodeURIComponent(jobId)}`);
        const st = await poll.json().catch(() => ({}));
        if (!poll.ok) {
          failErr = st.error || poll.statusText;
          break;
        }
        if (st.status === 'succeeded' && st.audioUrl) {
          audioUrl = st.audioUrl;
          break;
        }
        if (st.status === 'failed' || st.status === 'canceled') {
          failErr = typeof st.error === 'string' ? st.error : JSON.stringify(st.error) || 'Generation failed';
          break;
        }
      }

      if (failErr) {
        setGenError(failErr);
        setGeneratedTracks((prev) =>
          prev.map((t) => (t.id === trackBase.id ? { ...t, status: 'failed', error: failErr } : t)),
        );
        return;
      }
      if (!audioUrl) {
        const msg = 'Timed out waiting for audio. Try again or check Replicate dashboard.';
        setGenError(msg);
        setGeneratedTracks((prev) =>
          prev.map((t) => (t.id === trackBase.id ? { ...t, status: 'failed', error: msg } : t)),
        );
        return;
      }

      setGeneratedTracks((prev) =>
        prev.map((t) => (t.id === trackBase.id ? { ...t, status: 'ready', audioUrl } : t)),
      );

      try {
        const acResp = await fetch(audioUrl, { mode: 'cors' });
        const buf = await acResp.arrayBuffer();
        const ab = await decodeAudio(buf.slice(0));
        playBuffer(ab, `gen-${trackBase.id}`, { volume: 0.95 });
      } catch {
        /* `<audio>` still works below */
      }
    } catch (e) {
      const msg = e?.message || 'Generation failed';
      setGenError(msg);
      setGeneratedTracks((prev) =>
        prev.map((t) => (t.id === trackBase.id ? { ...t, status: 'failed', error: msg } : t)),
      );
    } finally {
      setGenerating(false);
      studio.setGenerating(false);
    }
  }, [prompt, studio, duration, decodeAudio, playBuffer]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr 280px', gap: 12, height: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
        <VoiceSelector />
        <div className="panel">
          <div className="panel-header"><span className="panel-title">🎹 Key & Scale</span></div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 6 }}>
            {KEYS.map((k) => (
              <button key={k} className={`tag${studio.key === k ? ' active' : ''}`} onClick={() => studio.setKey(k)}>{k}</button>
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {SCALES.map((s) => (
              <button key={s} className={`tag${studio.scale === s ? ' active' : ''}`} onClick={() => studio.setScale(s)} style={{ textTransform: 'capitalize' }}>{s}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
        <div className="panel">
          <div className="panel-header"><span className="panel-title">✨ Generate</span></div>
          <textarea
            placeholder="Describe your track... e.g. 'Dreamy lo-fi beat with soft piano and vinyl crackle'"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            style={{ resize: 'vertical', marginBottom: 8 }}
          />
          <div className="grid-3" style={{ marginBottom: 8 }}>
            <div>
              <label style={{ fontSize: '0.6rem', color: '#6b7280' }}>Genre</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {studio.genres.map((g) => (
                  <button key={g} className={`tag${studio.selectedGenre === g ? ' active' : ''}`} onClick={() => studio.setGenre(g)}>{g}</button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ fontSize: '0.6rem', color: '#6b7280' }}>Mood</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {studio.moods.map((m) => (
                  <button key={m} className={`tag${studio.selectedMood === m ? ' active' : ''}`} onClick={() => studio.setMood(m)}>{m}</button>
                ))}
              </div>
            </div>
            <div>
              <div className="slider-row"><label>BPM</label><input type="range" min={60} max={200} value={studio.bpm} onChange={(e) => studio.setBpm(+e.target.value)} /><span className="val">{studio.bpm}</span></div>
              <div className="slider-row"><label>Duration</label><input type="range" min={10} max={300} value={duration} onChange={(e) => setDuration(+e.target.value)} /><span className="val">{duration}s</span></div>
            </div>
          </div>
          <button className="btn btn-purple btn-full" onClick={generate} disabled={generating}>
            {generating ? '⏳ Generating...' : '⚡ Generate Track'}
          </button>
          {genError && (
            <div
              style={{
                marginTop: 8,
                padding: '8px 10px',
                borderRadius: 8,
                fontSize: '0.68rem',
                color: '#fecaca',
                background: 'rgba(127,29,29,0.35)',
                border: '1px solid rgba(248,113,113,0.35)',
              }}
            >
              {genError}
            </div>
          )}
        </div>

        <WaveformAnalyzer height={100} />

        <div className="panel">
          <div className="panel-header"><span className="panel-title">📚 Generated Tracks</span><span className="panel-badge">{generatedTracks.length}</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflowY: 'auto' }}>
            {generatedTracks.length === 0 && <div style={{ fontSize: '0.68rem', color: '#6b7280', textAlign: 'center', padding: 16 }}>No tracks yet. Generate your first track above!</div>}
            {generatedTracks.map((t) => (
              <div
                key={t.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: '1px solid rgba(168,85,247,0.12)',
                  background: 'rgba(18,22,42,0.5)',
                  fontSize: '0.7rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>🎵</span>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ fontWeight: 600, color: '#e5e7eb', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.prompt}</div>
                    <div style={{ fontSize: '0.58rem', color: '#6b7280' }}>{t.genre} · {t.mood} · {t.bpm} BPM</div>
                  </div>
                  {t.status === 'ready' && <span style={{ fontSize: '0.55rem', color: '#22c55e' }}>✓</span>}
                  {t.status === 'failed' && <span style={{ fontSize: '0.55rem', color: '#f87171' }}>✗</span>}
                  {(t.status === 'starting' || t.status === 'processing') && (
                    <span style={{ fontSize: '0.55rem', color: '#a78bfa' }}>…</span>
                  )}
                </div>
                {t.audioUrl && (
                  <audio controls src={t.audioUrl} style={{ width: '100%', height: 32 }} preload="metadata" />
                )}
                {t.error && (
                  <div style={{ fontSize: '0.58rem', color: '#f87171' }}>{t.error}</div>
                )}
              </div>
            ))}
          </div>
        </div>

        <DJConsole />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
        <AIDirector />
      </div>
    </div>
  );
}
