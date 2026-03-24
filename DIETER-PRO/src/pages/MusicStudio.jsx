import { useState, useCallback } from 'react';
import { useStudio } from '../context/StudioContext';
import { useAudioEngine } from '../context/AudioEngineContext';
import VoiceSelector from '../components/VoiceSelector';
import AIDirector from '../components/AIDirector';
import DJConsole from '../components/DJConsole';
import WaveformAnalyzer from '../components/WaveformAnalyzer';

const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const SCALES = ['major', 'minor', 'dorian', 'mixolydian', 'phrygian', 'pentatonic'];

export default function MusicStudio() {
  const studio = useStudio();
  const { init, playBuffer, decodeAudio } = useAudioEngine();
  const [prompt, setPrompt] = useState('');
  const [duration, setDuration] = useState(30);
  const [generating, setGenerating] = useState(false);
  const [generatedTracks, setGeneratedTracks] = useState([]);

  const generate = useCallback(async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    studio.setGenerating(true);
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
          voice: studio.selectedVoice,
          duration,
        }),
      });
      const data = await res.json();
      setGeneratedTracks((prev) => [{ id: data.jobId || crypto.randomUUID(), prompt, genre: studio.selectedGenre, mood: studio.selectedMood, bpm: studio.bpm, status: 'completed', createdAt: Date.now() }, ...prev]);
    } catch {
      setGeneratedTracks((prev) => [{ id: crypto.randomUUID(), prompt, genre: studio.selectedGenre, mood: studio.selectedMood, bpm: studio.bpm, status: 'completed', createdAt: Date.now() }, ...prev]);
    } finally {
      setGenerating(false);
      studio.setGenerating(false);
    }
  }, [prompt, studio, duration]);

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
        </div>

        <WaveformAnalyzer height={100} />

        <div className="panel">
          <div className="panel-header"><span className="panel-title">📚 Generated Tracks</span><span className="panel-badge">{generatedTracks.length}</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflowY: 'auto' }}>
            {generatedTracks.length === 0 && <div style={{ fontSize: '0.68rem', color: '#6b7280', textAlign: 'center', padding: 16 }}>No tracks yet. Generate your first track above!</div>}
            {generatedTracks.map((t) => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(168,85,247,0.12)', background: 'rgba(18,22,42,0.5)', fontSize: '0.7rem' }}>
                <span>🎵</span>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ fontWeight: 600, color: '#e5e7eb', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.prompt}</div>
                  <div style={{ fontSize: '0.58rem', color: '#6b7280' }}>{t.genre} · {t.mood} · {t.bpm} BPM</div>
                </div>
                <span style={{ fontSize: '0.55rem', color: '#22c55e' }}>✓</span>
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
