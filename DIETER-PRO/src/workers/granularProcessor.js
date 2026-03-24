/**
 * Granular Synthesis AudioWorklet Processor
 * Schedules overlapping grains from a source buffer with pitch shifting,
 * position randomization, windowing, and panning.
 */
class GranularProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = null;
    this.bufferLength = 0;
    this.sampleRate = 44100;
    this.grainSize = 0.1;
    this.density = 10;
    this.pitch = 1;
    this.position = 0.5;
    this.spread = 0.3;
    this.attack = 0.1;
    this.release = 0.2;
    this.pan = 0;
    this.playing = false;
    this.grains = [];
    this.nextGrainTime = 0;
    this.sampleIndex = 0;

    this.port.onmessage = (e) => {
      const { type, data } = e.data;
      switch (type) {
        case 'setBuffer':
          this.buffer = data.buffer;
          this.bufferLength = data.length;
          this.sampleRate = data.sampleRate;
          break;
        case 'setParams':
          if (data.grainSize !== undefined) this.grainSize = data.grainSize / 1000;
          if (data.density !== undefined) this.density = data.density;
          if (data.pitch !== undefined) this.pitch = Math.pow(2, data.pitch / 12);
          if (data.position !== undefined) this.position = data.position;
          if (data.spread !== undefined) this.spread = data.spread;
          if (data.attack !== undefined) this.attack = data.attack;
          if (data.release !== undefined) this.release = data.release;
          if (data.pan !== undefined) this.pan = data.pan;
          break;
        case 'start':
          this.playing = true;
          this.nextGrainTime = 0;
          break;
        case 'stop':
          this.playing = false;
          this.grains = [];
          break;
      }
    };
  }

  hannWindow(phase) {
    return 0.5 * (1 - Math.cos(2 * Math.PI * phase));
  }

  envelope(phase) {
    const att = Math.max(0.001, this.attack);
    const rel = Math.max(0.001, this.release);
    if (phase < att) return phase / att;
    if (phase > 1 - rel) return (1 - phase) / rel;
    return 1;
  }

  scheduleGrain() {
    const grainSamples = Math.floor(this.grainSize * this.sampleRate);
    if (grainSamples < 4 || !this.buffer) return;
    const spread = (Math.random() - 0.5) * this.spread;
    const pos = Math.max(0, Math.min(1, this.position + spread));
    const startSample = Math.floor(pos * (this.bufferLength - grainSamples));

    this.grains.push({
      startSample: Math.max(0, startSample),
      length: grainSamples,
      phase: 0,
      pitch: this.pitch,
      pan: Math.max(-1, Math.min(1, this.pan + (Math.random() - 0.5) * 0.2)),
    });
  }

  process(inputs, outputs) {
    if (!this.playing || !this.buffer) {
      return true;
    }

    const outL = outputs[0][0];
    const outR = outputs[0][1] || outL;
    const blockSize = outL.length;
    const interval = this.sampleRate / Math.max(1, this.density);

    for (let i = 0; i < blockSize; i++) {
      if (this.sampleIndex >= this.nextGrainTime) {
        this.scheduleGrain();
        this.nextGrainTime = this.sampleIndex + interval + (Math.random() - 0.5) * interval * 0.3;
      }

      let sumL = 0, sumR = 0;

      for (let g = this.grains.length - 1; g >= 0; g--) {
        const grain = this.grains[g];
        const norm = grain.phase / grain.length;
        if (norm >= 1) {
          this.grains.splice(g, 1);
          continue;
        }

        const samplePos = grain.startSample + grain.phase * grain.pitch;
        const idx = Math.floor(samplePos);
        if (idx < 0 || idx >= this.bufferLength - 1) {
          this.grains.splice(g, 1);
          continue;
        }

        const frac = samplePos - idx;
        const sample = this.buffer[idx] * (1 - frac) + this.buffer[idx + 1] * frac;
        const env = this.envelope(norm) * this.hannWindow(norm);
        const val = sample * env;

        const panR = (grain.pan + 1) * 0.5;
        const panL = 1 - panR;
        sumL += val * panL;
        sumR += val * panR;

        grain.phase++;
      }

      outL[i] = sumL;
      outR[i] = sumR;
      this.sampleIndex++;
    }

    return true;
  }
}

registerProcessor('granular-processor', GranularProcessor);
