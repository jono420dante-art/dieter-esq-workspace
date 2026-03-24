import { createContext, useContext, useRef, useState, useCallback } from 'react';

const AudioEngineContext = createContext(null);

export function AudioEngineProvider({ children }) {
  const ctxRef = useRef(null);
  const masterGainRef = useRef(null);
  const analyserRef = useRef(null);
  const compressorRef = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const [masterVolume, setMasterVolumeState] = useState(0.8);
  const activeSourcesRef = useRef(new Map());

  const init = useCallback(() => {
    if (ctxRef.current) {
      if (ctxRef.current.state === 'suspended') ctxRef.current.resume();
      return ctxRef.current;
    }
    const ac = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 44100 });
    const master = ac.createGain();
    master.gain.value = 0.8;
    const analyser = ac.createAnalyser();
    analyser.fftSize = 4096;
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 4;
    comp.knee.value = 10;
    comp.attack.value = 0.003;
    comp.release.value = 0.25;
    master.connect(comp);
    comp.connect(analyser);
    analyser.connect(ac.destination);

    ctxRef.current = ac;
    masterGainRef.current = master;
    analyserRef.current = analyser;
    compressorRef.current = comp;
    setIsReady(true);
    return ac;
  }, []);

  const setMasterVolume = useCallback((v) => {
    setMasterVolumeState(v);
    if (masterGainRef.current) masterGainRef.current.gain.value = v;
  }, []);

  const decodeAudio = useCallback(async (arrayBuffer) => {
    const ac = init();
    return ac.decodeAudioData(arrayBuffer);
  }, [init]);

  const playBuffer = useCallback((buffer, id, options = {}) => {
    const ac = init();
    const src = ac.createBufferSource();
    src.buffer = buffer;
    const gain = ac.createGain();
    gain.gain.value = options.volume ?? 1;
    src.connect(gain);
    gain.connect(masterGainRef.current);
    src.loop = options.loop ?? false;
    src.start(options.when ?? 0, options.offset ?? 0);
    src.onended = () => activeSourcesRef.current.delete(id);
    activeSourcesRef.current.set(id, { source: src, gain });
    return src;
  }, [init]);

  const stopSource = useCallback((id) => {
    const entry = activeSourcesRef.current.get(id);
    if (entry) {
      try { entry.source.stop(); } catch {}
      activeSourcesRef.current.delete(id);
    }
  }, []);

  const stopAll = useCallback(() => {
    activeSourcesRef.current.forEach((entry) => {
      try { entry.source.stop(); } catch {}
    });
    activeSourcesRef.current.clear();
  }, []);

  const getAnalyserData = useCallback(() => {
    if (!analyserRef.current) return null;
    const data = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(data);
    return data;
  }, []);

  return (
    <AudioEngineContext.Provider
      value={{
        init,
        ctxRef,
        masterGainRef,
        analyserRef,
        compressorRef,
        isReady,
        masterVolume,
        setMasterVolume,
        decodeAudio,
        playBuffer,
        stopSource,
        stopAll,
        getAnalyserData,
      }}
    >
      {children}
    </AudioEngineContext.Provider>
  );
}

export function useAudioEngine() {
  const ctx = useContext(AudioEngineContext);
  if (!ctx) throw new Error('useAudioEngine must be inside AudioEngineProvider');
  return ctx;
}
