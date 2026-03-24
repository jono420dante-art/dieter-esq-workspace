/* Audio Engine — Web Audio API: real/sample playback & analysis (no built-in tone synthesis) */

let ctx = null;
let masterGain = null;
let analyser = null;
let compressor = null;
let currentSource = null;
let currentNodes = [];
let playing = false;
let decodedBuffer = null;
let granularTimer = null;
let granularSources = [];
let granularPlaying = false;
/** Set when play() / playGranular() cannot start (e.g. no file loaded). */
let lastPlayError = null;

function ensure() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (ctx.state === 'suspended') ctx.resume();
  if (!masterGain) {
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.8;
    compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 12;
    compressor.ratio.value = 4;
    analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.82;
    masterGain.connect(compressor);
    compressor.connect(analyser);
    analyser.connect(ctx.destination);
  }
}

export function getContext() { ensure(); return ctx; }
export function getAnalyser() { ensure(); return analyser; }
export function getMasterGain() { ensure(); return masterGain; }
export function isPlaying() { return playing; }
export function getBuffer() { return decodedBuffer; }
export function getLastPlayError() { return lastPlayError; }

let activeGenre = 'synthwave';

/** Metadata only (genre tags for UI / export); playback uses loaded audio buffer. */
export function setGenre(genre) { activeGenre = genre || 'synthwave'; }

/**
 * Play decoded audio buffer only. No internal oscillator “instruments”.
 * @returns {boolean} true if playback started
 */
export function play(_genre) {
  lastPlayError = null;
  try {
    ensure();
    stop();
    if (!decodedBuffer) {
      lastPlayError = 'No audio loaded. Import WAV/MP3, analyze a file in Beats, or generate via the DIETER Backend API.';
      return false;
    }
    const source = ctx.createBufferSource();
    source.buffer = decodedBuffer;
    source.connect(masterGain);
    source.onended = () => { playing = false; };
    source.start();
    currentSource = source;
    playing = true;
    return true;
  } catch (e) {
    console.error('[Engine] play error:', e);
    lastPlayError = e?.message || String(e);
    playing = false;
    return false;
  }
}

export function stop() {
  try {
    if (currentSource) {
      currentSource.stop();
      currentSource.disconnect();
    }
  } catch { /* already stopped */ }
  // Stop granular scheduler + sources.
  try {
    if (granularTimer) { clearInterval(granularTimer); granularTimer = null; }
    for (const n of granularSources) {
      try { n.source.stop?.(); } catch {}
      try { n.source.disconnect?.(); } catch {}
      try { n.gain?.disconnect?.(); } catch {}
    }
  } catch {}
  granularSources = [];
  granularPlaying = false;
  for (const n of currentNodes) {
    try { n.stop?.(); n.disconnect?.(); } catch {}
  }
  currentSource = null;
  currentNodes = [];
  playing = false;
}

export function pause() { stop(); }

export async function decodeFile(file) {
  ensure();
  const buf = await file.arrayBuffer();
  decodedBuffer = await ctx.decodeAudioData(buf);
  return decodedBuffer;
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

// Granular playback (uses decodedBuffer). Creates many short "grains" that overlap.
export function playGranular(opts = {}) {
  lastPlayError = null;
  ensure();
  if (!decodedBuffer) {
    lastPlayError = 'Granular mode needs real audio: import a file or load a track from the API first.';
    return false;
  }

  stop();

  const grainSizeMs = clamp(+opts.grainSizeMs || 120, 20, 500);
  const density = clamp(+opts.density || 20, 1, 80); // grains per second
  const positionPct = clamp(+opts.positionPct || 20, 0, 100);
  const spreadPct = clamp(+opts.spreadPct || 50, 0, 100);
  const playbackRate = clamp(+opts.playbackRate || 1, 0.5, 2.5);

  const grainDur = grainSizeMs / 1000;
  const dur = decodedBuffer.duration || 1;
  const scheduleEveryMs = Math.max(15, Math.floor(1000 / density));
  const lookAhead = 0.04; // schedule slightly in the future

  const center = (positionPct / 100) * dur;
  const spread = (spreadPct / 100) * dur;

  granularPlaying = true;
  playing = true;

  const scheduleGrain = () => {
    if (!granularPlaying) return;
    const now = ctx.currentTime;
    const startAt = now + lookAhead;

    // Pick a random offset around the center.
    const offset = center + (Math.random() - 0.5) * spread;
    const safeOffset = clamp(offset - grainDur / 2, 0, Math.max(0, dur - grainDur));

    const source = ctx.createBufferSource();
    source.buffer = decodedBuffer;
    source.playbackRate.value = playbackRate;

    const gain = ctx.createGain();
    // Small per-grain amplitude; master bus controls overall level.
    const peak = 0.12;
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.linearRampToValueAtTime(peak, startAt + grainDur * 0.25);
    gain.gain.linearRampToValueAtTime(0.0001, startAt + grainDur);

    source.connect(gain);
    gain.connect(masterGain);

    try {
      source.start(startAt, safeOffset, grainDur);
      source.stop(startAt + grainDur + 0.03);
    } catch {
      try { source.disconnect?.(); } catch {}
      try { gain.disconnect?.(); } catch {}
      return;
    }

    granularSources.push({ source, gain });
    // Prevent unlimited growth if grains overlap for a long time.
    if (granularSources.length > 300) {
      const oldest = granularSources.shift();
      try { oldest?.source.stop?.(); } catch {}
    }
  };

  // Schedule continuously.
  granularTimer = setInterval(scheduleGrain, scheduleEveryMs);
  // Kick immediately.
  for (let i = 0; i < 3; i++) scheduleGrain();
  return true;
}

export function setBuffer(buffer) {
  decodedBuffer = buffer;
}

export function detectBeats(buffer) {
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

  const lookback = Math.floor(sr * 0.5 / hopSize);
  const beats = [];
  let lastBeatSample = -sr;

  for (let i = lookback; i < energies.length - lookback; i++) {
    let avg = 0;
    for (let j = i - lookback; j <= i + lookback; j++) avg += energies[j];
    avg /= lookback * 2 + 1;
    const samplePos = i * hopSize;
    if (energies[i] > avg * 1.8 && (samplePos - lastBeatSample) > sr * 0.15) {
      beats.push(samplePos / sr);
      lastBeatSample = samplePos;
    }
  }
  return beats;
}

export function calculateBPM(beats) {
  if (beats.length < 2) return 0;
  const intervals = [];
  for (let i = 1; i < Math.min(beats.length, 50); i++) {
    intervals.push(beats[i] - beats[i - 1]);
  }
  intervals.sort((a, b) => a - b);
  let bpm = Math.round(60 / intervals[Math.floor(intervals.length / 2)]);
  if (bpm > 200) bpm = Math.round(bpm / 2);
  if (bpm < 50) bpm = Math.round(bpm * 2);
  return bpm;
}

export async function detectKey(buffer) {
  const keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  try {
    const sr = buffer.sampleRate;
    const offCtx = new OfflineAudioContext(1, 2048, sr);
    const source = offCtx.createBufferSource();
    source.buffer = buffer;
    const an = offCtx.createAnalyser();
    an.fftSize = 2048;
    source.connect(an);
    an.connect(offCtx.destination);
    source.start();
    await offCtx.startRendering();
    const fft = new Float32Array(1024);
    an.getFloatFrequencyData(fft);
    const chroma = new Float32Array(12);
    for (let i = 1; i < 1024; i++) {
      const f = (i * sr) / 2048;
      if (f < 60 || f > 2000) continue;
      const midi = Math.round(12 * Math.log2(f / 440) + 69);
      chroma[((midi % 12) + 12) % 12] += Math.pow(10, fft[i] / 20);
    }
    let maxIdx = 0;
    for (let i = 1; i < 12; i++) if (chroma[i] > chroma[maxIdx]) maxIdx = i;
    return keys[maxIdx] + 'm';
  } catch {
    return 'Am';
  }
}

export function getFrequencyData() {
  if (!analyser) return new Uint8Array(0);
  const data = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(data);
  return data;
}

export function getTimeDomainData() {
  if (!analyser) return new Uint8Array(0);
  const data = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteTimeDomainData(data);
  return data;
}

export function getStatus() {
  return {
    state: ctx?.state || 'uninitialized',
    sampleRate: ctx?.sampleRate || 0,
    playing,
    hasBuffer: !!decodedBuffer,
    bufferDuration: decodedBuffer?.duration || 0,
    genre: activeGenre,
  };
}
