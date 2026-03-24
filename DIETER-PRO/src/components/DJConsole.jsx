import { useState, useRef, useCallback, useEffect } from 'react';
import { useAudioEngine } from '../context/AudioEngineContext';

export default function DJConsole() {
  const { init, masterGainRef } = useAudioEngine();
  const [deckA, setDeckA] = useState({ loaded: false, name: '', playing: false, volume: 0.8, speed: 1 });
  const [deckB, setDeckB] = useState({ loaded: false, name: '', playing: false, volume: 0.8, speed: 1 });
  const [crossfade, setCrossfade] = useState(0.5);
  const [fx, setFx] = useState({ echo: false, flanger: false, reverb: false });
  const bufferARef = useRef(null);
  const bufferBRef = useRef(null);
  const sourceARef = useRef(null);
  const sourceBRef = useRef(null);
  const gainARef = useRef(null);
  const gainBRef = useRef(null);

  const loadDeck = useCallback(async (deck, file) => {
    const ac = init();
    const buf = await file.arrayBuffer();
    const audioBuffer = await ac.decodeAudioData(buf);
    if (deck === 'A') {
      bufferARef.current = audioBuffer;
      setDeckA((p) => ({ ...p, loaded: true, name: file.name }));
    } else {
      bufferBRef.current = audioBuffer;
      setDeckB((p) => ({ ...p, loaded: true, name: file.name }));
    }
  }, [init]);

  const playDeck = useCallback((deck) => {
    const ac = init();
    const buffer = deck === 'A' ? bufferARef.current : bufferBRef.current;
    if (!buffer) return;

    const src = ac.createBufferSource();
    src.buffer = buffer;
    const gain = ac.createGain();
    src.connect(gain);
    gain.connect(masterGainRef.current);

    if (deck === 'A') {
      if (sourceARef.current) try { sourceARef.current.stop(); } catch {}
      sourceARef.current = src;
      gainARef.current = gain;
      gain.gain.value = deckA.volume * (1 - crossfade);
      src.playbackRate.value = deckA.speed;
      setDeckA((p) => ({ ...p, playing: true }));
    } else {
      if (sourceBRef.current) try { sourceBRef.current.stop(); } catch {}
      sourceBRef.current = src;
      gainBRef.current = gain;
      gain.gain.value = deckB.volume * crossfade;
      src.playbackRate.value = deckB.speed;
      setDeckB((p) => ({ ...p, playing: true }));
    }
    src.loop = true;
    src.start();
  }, [init, masterGainRef, deckA, deckB, crossfade]);

  const stopDeck = useCallback((deck) => {
    const src = deck === 'A' ? sourceARef.current : sourceBRef.current;
    if (src) try { src.stop(); } catch {}
    if (deck === 'A') setDeckA((p) => ({ ...p, playing: false }));
    else setDeckB((p) => ({ ...p, playing: false }));
  }, []);

  useEffect(() => {
    if (gainARef.current) gainARef.current.gain.value = deckA.volume * (1 - crossfade);
    if (gainBRef.current) gainBRef.current.gain.value = deckB.volume * crossfade;
  }, [crossfade, deckA.volume, deckB.volume]);

  const handleDrop = useCallback((deck) => (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files[0];
    if (file && file.type.startsWith('audio/')) loadDeck(deck, file);
  }, [loadDeck]);

  return (
    <div className="panel">
      <div className="panel-header">
        <span className="panel-title">🎧 DJ Console</span>
      </div>

      <div className="grid-2" style={{ gap: 12 }}>
        <DeckUI
          label="DECK A"
          deck={deckA}
          onDrop={handleDrop('A')}
          onPlay={() => playDeck('A')}
          onStop={() => stopDeck('A')}
          onVolume={(v) => setDeckA((p) => ({ ...p, volume: v }))}
          onSpeed={(v) => { setDeckA((p) => ({ ...p, speed: v })); if (sourceARef.current) sourceARef.current.playbackRate.value = v; }}
          color="#22c55e"
        />
        <DeckUI
          label="DECK B"
          deck={deckB}
          onDrop={handleDrop('B')}
          onPlay={() => playDeck('B')}
          onStop={() => stopDeck('B')}
          onVolume={(v) => setDeckB((p) => ({ ...p, volume: v }))}
          onSpeed={(v) => { setDeckB((p) => ({ ...p, speed: v })); if (sourceBRef.current) sourceBRef.current.playbackRate.value = v; }}
          color="#f97316"
        />
      </div>

      <div style={{ marginTop: 12 }}>
        <div className="slider-row">
          <label style={{ color: '#22c55e' }}>A</label>
          <input type="range" min={0} max={1} step={0.01} value={crossfade} onChange={(e) => setCrossfade(parseFloat(e.target.value))} />
          <label style={{ color: '#f97316' }}>B</label>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
        {Object.entries(fx).map(([key, on]) => (
          <button
            key={key}
            className={`tag${on ? ' active' : ''}`}
            onClick={() => setFx((p) => ({ ...p, [key]: !p[key] }))}
            style={{ textTransform: 'capitalize' }}
          >
            {key}
          </button>
        ))}
      </div>
    </div>
  );
}

function DeckUI({ label, deck, onDrop, onPlay, onStop, onVolume, onSpeed, color }) {
  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      style={{
        padding: 10,
        borderRadius: 8,
        border: `1px solid ${color}33`,
        background: `${color}08`,
      }}
    >
      <div style={{ fontSize: '0.6rem', fontWeight: 700, color, letterSpacing: '0.1em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: '0.65rem', color: '#e5e7eb', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {deck.loaded ? deck.name : 'Drop audio here'}
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
        <button className="btn btn-green btn-sm" onClick={onPlay} disabled={!deck.loaded}>▶</button>
        <button className="btn btn-red btn-sm" onClick={onStop}>■</button>
      </div>
      <div className="slider-row"><label>Vol</label><input type="range" min={0} max={1} step={0.01} value={deck.volume} onChange={(e) => onVolume(parseFloat(e.target.value))} /><span className="val">{Math.round(deck.volume * 100)}%</span></div>
      <div className="slider-row"><label>Speed</label><input type="range" min={0.5} max={2} step={0.01} value={deck.speed} onChange={(e) => onSpeed(parseFloat(e.target.value))} /><span className="val">{deck.speed.toFixed(2)}x</span></div>
    </div>
  );
}
