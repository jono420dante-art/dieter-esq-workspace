/**
 * Stem Splitter Web Worker
 * Splits audio into frequency-based stems: vocals, drums, bass, other.
 * Uses band-pass filtering approach for client-side separation.
 */

self.onmessage = async function (e) {
  const { type, data } = e.data;

  if (type === 'split') {
    try {
      const { audioData, sampleRate, channels } = data;
      self.postMessage({ type: 'progress', value: 0 });

      const stems = {
        vocals: extractBand(audioData, sampleRate, 300, 4000, channels),
        drums: extractPercussion(audioData, sampleRate, channels),
        bass: extractBand(audioData, sampleRate, 20, 300, channels),
        other: null,
      };
      self.postMessage({ type: 'progress', value: 60 });

      stems.other = computeResidual(audioData, [stems.vocals, stems.drums, stems.bass], channels);
      self.postMessage({ type: 'progress', value: 90 });

      self.postMessage({
        type: 'result',
        stems: {
          vocals: stems.vocals,
          drums: stems.drums,
          bass: stems.bass,
          other: stems.other,
        },
      });
    } catch (err) {
      self.postMessage({ type: 'error', message: err.message });
    }
  }
};

function extractBand(audioData, sampleRate, lowHz, highHz, channels) {
  const len = audioData.length / channels;
  const result = new Float32Array(audioData.length);
  const lowAlpha = computeAlpha(lowHz, sampleRate);
  const highAlpha = computeAlpha(highHz, sampleRate);

  for (let ch = 0; ch < channels; ch++) {
    let hpPrev = 0, lpPrev = 0;
    for (let i = 0; i < len; i++) {
      const idx = ch * len + i;
      const sample = audioData[idx];
      hpPrev = hpPrev + lowAlpha * (sample - hpPrev);
      const hpOut = sample - hpPrev;
      lpPrev = lpPrev + highAlpha * (hpOut - lpPrev);
      result[idx] = lpPrev;
    }
  }
  return result;
}

function extractPercussion(audioData, sampleRate, channels) {
  const len = audioData.length / channels;
  const result = new Float32Array(audioData.length);
  const windowSize = Math.floor(sampleRate * 0.01);

  for (let ch = 0; ch < channels; ch++) {
    let prevEnergy = 0;
    for (let i = 0; i < len; i++) {
      const idx = ch * len + i;
      const sample = audioData[idx];
      let energy = 0;
      const start = Math.max(0, i - windowSize);
      for (let j = start; j <= i; j++) {
        const s = audioData[ch * len + j];
        energy += s * s;
      }
      energy /= (i - start + 1);
      const transient = energy > prevEnergy * 3 ? 1 : Math.max(0, (energy / (prevEnergy + 0.0001) - 1) * 0.5);
      result[idx] = sample * Math.min(1, transient);
      prevEnergy = prevEnergy * 0.99 + energy * 0.01;
    }
  }
  return result;
}

function computeResidual(original, stems, channels) {
  const result = new Float32Array(original.length);
  for (let i = 0; i < original.length; i++) {
    let sum = 0;
    for (const stem of stems) {
      if (stem) sum += stem[i];
    }
    result[i] = original[i] - sum;
  }
  return result;
}

function computeAlpha(freqHz, sampleRate) {
  const dt = 1 / sampleRate;
  const rc = 1 / (2 * Math.PI * freqHz);
  return dt / (rc + dt);
}
