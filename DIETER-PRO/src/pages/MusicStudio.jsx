import { useState, useCallback, useEffect } from 'react';
import { useStudio } from '../context/StudioContext';
import { useAudioEngine } from '../context/AudioEngineContext';
import VoiceSelector from '../components/VoiceSelector';
import AIDirector from '../components/AIDirector';
import DJConsole from '../components/DJConsole';
import WaveformAnalyzer from '../components/WaveformAnalyzer';
import { VOICE_HINTS } from '../../lib/voiceHints.js';
import {
  parseMurekaTaskId,
  extractMurekaAudioUrl,
  murekaStatusLower,
} from '../../lib/murekaClient.js';

const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const SCALES = ['major', 'minor', 'dorian', 'mixolydian', 'phrygian', 'pentatonic'];

const POLL_MS = 2000;
const POLL_MAX = 90;
const MUREKA_POLL_MS = 3500;
const MUREKA_POLL_MAX = 200;

const MUREKA_DONE = new Set(['completed', 'success', 'succeeded', 'done', 'finished']);
const MUREKA_FAIL = new Set(['failed', 'error', 'cancelled', 'canceled']);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function firstLyricLine(text) {
  const line = (text || '').split('\n').map((l) => l.trim()).find(Boolean);
  return line || 'Lyrics';
}

function formatApiError(data, fallback) {
  if (!data || typeof data !== 'object') return fallback;
  const d = data.detail;
  if (typeof d === 'string') return d;
  if (d && typeof d === 'object') return JSON.stringify(d);
  if (typeof data.error === 'string') return data.error;
  return fallback;
}

export default function MusicStudio() {
  const studio = useStudio();
  const { playBuffer, decodeAudio } = useAudioEngine();
  const [prompt, setPrompt] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [genMode, setGenMode] = useState('musicgen');
  const [dieterAvailable, setDieterAvailable] = useState(false);
  const [duration, setDuration] = useState(30);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');
  const [generatedTracks, setGeneratedTracks] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/dieter/capabilities');
        if (!cancelled && r.ok) setDieterAvailable(true);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const buildMurekaPrompt = useCallback(() => {
    const hint = VOICE_HINTS[studio.selectedVoice] || '';
    return [
      `${studio.selectedGenre} song`,
      studio.selectedMood,
      `${studio.bpm} BPM`,
      `${studio.key} ${studio.scale}`,
      hint,
      (prompt || '').trim(),
    ]
      .filter(Boolean)
      .join(', ')
      .slice(0, 500);
  }, [studio, prompt]);

  const generate = useCallback(async () => {
    const lyricTrim = lyrics.trim();
    const promptTrim = prompt.trim();

    if (genMode === 'mureka') {
      if (!lyricTrim) {
        setGenError('Add lyrics for full-song generation (Mureka).');
        return;
      }
      if (!dieterAvailable) {
        setGenError(
          'Dieter API is not configured. Set DIETER_FASTAPI_URL on this server, with MUREKA_API_KEY on the Dieter FastAPI host.',
        );
        return;
      }
    } else if (!promptTrim && !lyricTrim) {
      setGenError('Add a style description and/or lyrics.');
      return;
    }

    setGenError('');
    setGenerating(true);
    studio.setGenerating(true);

    const summary = genMode === 'mureka' ? firstLyricLine(lyricTrim) : promptTrim || firstLyricLine(lyricTrim);
    const trackBase = {
      id: crypto.randomUUID(),
      jobId: null,
      prompt: summary,
      lyricsPreview: lyricTrim ? lyricTrim.slice(0, 120) : null,
      genMode,
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
      if (genMode === 'mureka') {
        const stylePrompt = buildMurekaPrompt() || `${studio.selectedGenre} song`;
        const res = await fetch('/api/dieter/mureka/song/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lyrics: lyricTrim,
            model: 'auto',
            prompt: stylePrompt,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(formatApiError(data, res.statusText || 'Mureka start failed'));
        }
        const taskId = parseMurekaTaskId(data);
        if (!taskId) throw new Error('No task id from Dieter / Mureka. Check server logs.');

        setGeneratedTracks((prev) =>
          prev.map((t) => (t.id === trackBase.id ? { ...t, jobId: taskId, status: 'processing' } : t)),
        );

        let audioUrl = null;
        let failErr = null;
        for (let i = 0; i < MUREKA_POLL_MAX; i += 1) {
          await sleep(MUREKA_POLL_MS);
          const poll = await fetch(`/api/dieter/mureka/song/query/${encodeURIComponent(taskId)}`);
          const st = await poll.json().catch(() => ({}));
          if (!poll.ok) {
            failErr = formatApiError(st, poll.statusText);
            break;
          }
          const lower = murekaStatusLower(st);
          if (MUREKA_FAIL.has(lower)) {
            failErr = formatApiError(st, st.message || 'Mureka task failed');
            break;
          }
          if (MUREKA_DONE.has(lower)) {
            audioUrl = extractMurekaAudioUrl(st);
            if (audioUrl) break;
          }
          const earlyUrl = extractMurekaAudioUrl(st);
          if (earlyUrl && lower && !MUREKA_FAIL.has(lower)) {
            audioUrl = earlyUrl;
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
          const msg = 'Timed out waiting for Mureka. Songs can take several minutes — try again or check Dieter logs.';
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
          /* `<audio>` still works */
        }
      } else {
        const res = await fetch('/api/music/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: promptTrim,
            lyrics: lyricTrim,
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
          throw new Error(formatApiError(data, res.statusText || 'Generate request failed'));
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
            failErr = formatApiError(st, poll.statusText);
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
          /* `<audio>` still works */
        }
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
  }, [
    prompt,
    lyrics,
    genMode,
    dieterAvailable,
    studio,
    duration,
    decodeAudio,
    playBuffer,
    buildMurekaPrompt,
  ]);

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

          <label style={{ fontSize: '0.6rem', color: '#6b7280', display: 'block', marginBottom: 4 }}>How to generate</label>
          <select
            value={genMode}
            onChange={(e) => setGenMode(e.target.value)}
            style={{
              width: '100%',
              marginBottom: 10,
              padding: '8px 10px',
              borderRadius: 8,
              background: 'rgba(18,22,42,0.85)',
              color: '#e5e7eb',
              border: '1px solid rgba(168,85,247,0.2)',
              fontSize: '0.72rem',
            }}
          >
            <option value="mureka">Full song — sing my lyrics (Mureka · needs Dieter + Mureka key)</option>
            <option value="musicgen">Instrumental / AI bed (Replicate MusicGen · needs Replicate token)</option>
          </select>

          {genMode === 'mureka' && !dieterAvailable && (
            <div style={{ fontSize: '0.65rem', color: '#fbbf24', marginBottom: 10, lineHeight: 1.4 }}>
              Dieter proxy is not available (check <code style={{ fontSize: '0.6rem' }}>DIETER_FASTAPI_URL</code> on this Node server or Vercel env). Your Dieter host must have <code style={{ fontSize: '0.6rem' }}>MUREKA_API_KEY</code>.
            </div>
          )}

          <label style={{ fontSize: '0.6rem', color: '#6b7280', display: 'block', marginBottom: 4 }}>Your lyrics</label>
          <textarea
            placeholder={'[Verse]\nYour lines here...\n\n[Chorus]\n...'}
            value={lyrics}
            onChange={(e) => setLyrics(e.target.value)}
            rows={5}
            style={{ resize: 'vertical', marginBottom: 8 }}
          />

          <label style={{ fontSize: '0.6rem', color: '#6b7280', display: 'block', marginBottom: 4 }}>
            {genMode === 'mureka' ? 'Extra style notes (optional)' : 'Describe the track'}
          </label>
          <textarea
            placeholder={
              genMode === 'mureka'
                ? "e.g. 'trap drums', 'acoustic guitar in verse', 'bright synth hook'"
                : "e.g. 'Dreamy lo-fi beat with soft piano and vinyl crackle'"
            }
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
              {genMode === 'musicgen' && (
                <div className="slider-row"><label>Duration</label><input type="range" min={10} max={300} value={duration} onChange={(e) => setDuration(+e.target.value)} /><span className="val">{duration}s</span></div>
              )}
              {genMode === 'mureka' && (
                <div style={{ fontSize: '0.58rem', color: '#6b7280', marginTop: 6 }}>Length follows Mureka output (often full song).</div>
              )}
            </div>
          </div>
          <button className="btn btn-purple btn-full" onClick={generate} disabled={generating}>
            {generating ? '⏳ Generating...' : genMode === 'mureka' ? '🎤 Generate song from lyrics' : '⚡ Generate track'}
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
                    <div style={{ fontSize: '0.58rem', color: '#6b7280' }}>
                      {t.genMode === 'mureka' ? 'Mureka' : 'MusicGen'} · {t.genre} · {t.mood} · {t.bpm} BPM
                    </div>
                    {t.lyricsPreview && (
                      <div style={{ fontSize: '0.55rem', color: '#9ca3af', marginTop: 2, fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.lyricsPreview}
                      </div>
                    )}
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
