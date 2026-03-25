/**
 * In-browser synthesized previews only (Tone.js). No sampled loops — suitable for
 * drafts, demos, and royalty-free scratch use. Not a substitute for Mureka masters.
 */
import * as Tone from 'tone'

const ROOTS = ['C', 'D', 'E', 'F', 'G', 'A', 'B']

function hashPrompt(s) {
  const str = String(s || 'dieter')
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}

function pickRoot(genre, mood, userPrompt) {
  const h = hashPrompt(`${genre}|${mood}|${userPrompt}`)
  const idx = h % ROOTS.length
  return ROOTS[idx]
}

/** Build diatonic triads in major or natural minor starting at root (e.g. C → C major). */
function progressionFromRoot(root, minor) {
  const r = Tone.Frequency(`${root}3`)
  const I = [r.toNote(), r.transpose(4).toNote(), r.transpose(7).toNote()]
  const IV = [r.transpose(5).toNote(), r.transpose(9).toNote(), r.transpose(12).toNote()]
  const V = [r.transpose(7).toNote(), r.transpose(11).toNote(), r.transpose(14).toNote()]
  const vi = [r.transpose(9).toNote(), r.transpose(12).toNote(), r.transpose(16).toNote()]
  if (minor) {
    const i = [r.toNote(), r.transpose(3).toNote(), r.transpose(7).toNote()]
    const iv = [r.transpose(5).toNote(), r.transpose(8).toNote(), r.transpose(12).toNote()]
    const v = [r.transpose(7).toNote(), r.transpose(10).toNote(), r.transpose(14).toNote()]
    const III = [r.transpose(3).toNote(), r.transpose(7).toNote(), r.transpose(10).toNote()]
    return [i, III, iv, v]
  }
  return [I, vi, IV, V]
}

function genreProgression(genre, mood, userPrompt) {
  const minor = mood === 'sad' || mood === 'relaxed'
  const root = pickRoot(genre, mood, userPrompt)
  let prog = progressionFromRoot(root, minor)
  if (genre === 'jazz') {
    const r = Tone.Frequency(`${root}3`)
    const maj7 = (t) => [r.transpose(t).toNote(), r.transpose(t + 4).toNote(), r.transpose(t + 7).toNote(), r.transpose(t + 11).toNote()]
    prog = [maj7(0), maj7(5), maj7(2), maj7(7)]
  }
  if (genre === 'hip-hop') {
    prog = minor
      ? progressionFromRoot(root, true).slice(0, 2)
      : [[Tone.Frequency(`${root}2`).toNote(), Tone.Frequency(`${root}2`).transpose(7).toNote()]]
  }
  return prog
}

function audioBufferToWav(audioBuffer) {
  const numChannels = audioBuffer.numberOfChannels
  const sampleRate = audioBuffer.sampleRate
  const bitDepth = 16
  const samples = audioBuffer.length
  const blockAlign = numChannels * (bitDepth / 8)
  const byteRate = sampleRate * blockAlign
  const dataSize = samples * blockAlign
  const arrayBuffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(arrayBuffer)

  const writeStr = (offset, s) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i))
  }

  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitDepth, true)
  writeStr(36, 'data')
  view.setUint32(40, dataSize, true)

  let offset = 44
  for (let i = 0; i < samples; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      let sample = audioBuffer.getChannelData(channel)[i]
      sample = Math.max(-1, Math.min(1, sample))
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
      offset += 2
    }
  }
  return new Blob([arrayBuffer], { type: 'audio/wav' })
}

/**
 * @param {{ genre: string, mood: string, tempoBpm: string|number, vocal: string, userPrompt?: string, durationSec?: number }} opts
 * @returns {Promise<string>} object URL for a WAV blob (caller should URL.revokeObjectURL when done)
 */
export async function renderRoyaltyFreePreview(opts) {
  const genre = opts.genre || 'all'
  const mood = opts.mood || 'happy'
  const bpm = Math.max(60, Math.min(200, Number(opts.tempoBpm) || 120))
  const vocal = opts.vocal || 'female'
  const userPrompt = (opts.userPrompt || '').trim()
  const durationSec = Math.max(12, Math.min(45, Number(opts.durationSec) || 28))

  const progression = genreProgression(genre, mood, userPrompt)
  const spb = 60 / bpm
  const barDur = spb * 4

  const toneBuffer = await Tone.Offline(async () => {
    const master = new Tone.Volume(-5).toDestination()

    const chords = new Tone.PolySynth(Tone.Synth, {
      maxPolyphony: 8,
      volume: -8,
      options: {
        oscillator: { type: genre === 'rock' ? 'sawtooth' : 'triangle' },
        envelope: { attack: 0.03, decay: 0.35, sustain: 0.45, release: 1.4 },
      },
    })
    chords.connect(master)

    const bass = new Tone.MonoSynth({
      oscillator: { type: 'square' },
      envelope: { attack: 0.01, decay: 0.25, sustain: 0.35, release: 0.5 },
      filterEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.2, release: 0.3, baseFrequency: 120, octaves: 2.2 },
      volume: -6,
    }).connect(master)

    const kick = new Tone.MembraneSynth({
      pitchDecay: 0.018,
      octaves: 8,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.35, sustain: 0.01, release: 0.2 },
      volume: -3,
    }).connect(master)

    const hat = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.02 },
      volume: -22,
    }).connect(master)

    let lead = null
    if (vocal !== 'none') {
      lead = new Tone.MonoSynth({
        oscillator: { type: 'sine' },
        envelope: { attack: 0.12, decay: 0.15, sustain: 0.85, release: 0.35 },
        portamento: 0.06,
        volume: -14,
      }).connect(master)
    }

    let t = 0
    let bar = 0
    while (t + barDur <= durationSec - 0.1) {
      const chord = progression[bar % progression.length]
      const isHipHopSparse = genre === 'hip-hop'
      const chordNotes = chord
      chords.triggerAttackRelease(chordNotes, barDur * 0.92, t)

      for (let beat = 0; beat < 4; beat++) {
        const bt = t + beat * spb
        if (!isHipHopSparse || beat === 0 || beat === 2) {
          kick.triggerAttackRelease('C1', '8n', bt)
        }
        if (!isHipHopSparse && beat % 2 === 1) {
          hat.triggerAttackRelease('16n', bt + spb * 0.5, 0.35)
        }
        const rootMidi = Tone.Frequency(chordNotes[0]).toMidi()
        const bassNote = Tone.Frequency(rootMidi, 'midi').transpose(-12).toNote()
        bass.triggerAttackRelease(bassNote, spb * 0.85, bt)
      }

      if (lead && !isHipHopSparse) {
        const deg = vocal === 'male' ? -7 : 0
        const melody = [0, 2, 4, 2, 0, 4, 7, 4].map((s) => s + deg)
        for (let i = 0; i < 8; i++) {
          const mt = t + (i * spb) / 2
          const n = Tone.Frequency(chordNotes[0]).toMidi() + melody[i]
          lead.triggerAttackRelease(Tone.Frequency(n, 'midi').toNote(), '16n', mt)
        }
      }

      t += barDur
      bar += 1
    }
  }, durationSec, 2, 44100)

  const ab = toneBuffer.get()
  const blob = audioBufferToWav(ab)
  return URL.createObjectURL(blob)
}

