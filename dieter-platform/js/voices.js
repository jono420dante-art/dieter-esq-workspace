/* Voice Engine — Real browser TTS voices + lyrics (no Web Audio oscillator “instruments”). */

import * as state from './state.js';

let allVoices = [];
let voicesLoaded = false;
let currentUtterance = null;
let isSpeaking = false;
let isSinging = false;
let singCancelFlag = false;
let onWordCallback = null;
let onLineCallback = null;
let onDoneCallback = null;

export function setCallbacks({ onWord, onLine, onDone } = {}) {
  onWordCallback = onWord || null;
  onLineCallback = onLine || null;
  onDoneCallback = onDone || null;
}

const NOTES = {
  'C2': 65.41, 'D2': 73.42, 'E2': 82.41, 'F2': 87.31, 'G2': 98.00, 'A2': 110.00, 'B2': 123.47,
  'C3': 130.81, 'D3': 146.83, 'E3': 164.81, 'F3': 174.61, 'G3': 196.00, 'A3': 220.00, 'B3': 246.94,
  'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F4': 349.23, 'G4': 392.00, 'A4': 440.00, 'B4': 493.88,
  'C5': 523.25, 'D5': 587.33, 'E5': 659.25, 'F5': 698.46, 'G5': 783.99,
};

const MELODIES = {
  pop:        ['C4','E4','G4','A4','G4','E4','C4','D4','F4','A4','G4','F4','E4','D4','C4','E4'],
  hiphop:     ['C3','C3','E3','G3','C3','C3','E3','A3','C3','C3','E3','G3','C3','E3','G3','C4'],
  rnb:        ['C4','D4','E4','G4','A4','G4','E4','D4','C4','D4','E4','A4','G4','F4','E4','C4'],
  afrobeat:   ['G3','A3','C4','D4','E4','D4','C4','A3','G3','A3','C4','E4','D4','C4','A3','G3'],
  synthwave:  ['E3','G3','A3','B3','C4','B3','A3','G3','E3','G3','A3','C4','D4','C4','B3','A3'],
  lofi:       ['C4','E4','G4','B4','A4','G4','E4','C4','D4','F4','A4','C5','B4','A4','G4','E4'],
  rock:       ['E3','G3','A3','E3','G3','B3','A3','G3','E3','G3','A3','B3','C4','B3','A3','E3'],
  ballad:     ['C4','E4','G4','C5','B4','A4','G4','E4','F4','A4','C5','E5','D5','C5','A4','G4'],
  house:      ['C3','C3','G3','C3','E3','C3','G3','C4','C3','C3','G3','C3','E3','G3','C4','G3'],
  trap:       ['C2','C2','E2','G2','C2','C2','E2','A2','C3','C2','E2','G2','C2','E2','G2','C3'],
  drill:      ['G2','G2','A2','G2','E2','G2','A2','C3','G2','G2','A2','C3','E3','C3','A2','G2'],
  techno:     ['C3','D3','C3','D3','E3','D3','C3','D3','C3','E3','D3','C3','D3','E3','G3','E3'],
  phonk:      ['C3','E3','G3','C3','E3','G3','A3','G3','E3','C3','G3','E3','C3','E3','G3','C4'],
  amapiano:   ['E3','G3','A3','C4','A3','G3','E3','D3','E3','G3','A3','C4','D4','C4','A3','G3'],
  jazz:       ['C4','E4','G4','B4','A4','F4','D4','B3','C4','E4','A4','G4','F4','D4','B3','C4'],
  reggaeton:  ['E3','E3','G3','A3','E3','E3','G3','C4','E3','E3','G3','A3','C4','A3','G3','E3'],
  classical:  ['C4','D4','E4','F4','G4','A4','B4','C5','B4','A4','G4','F4','E4','D4','C4','G4'],
  edm:        ['C3','E3','G3','C4','E3','G3','C4','E4','C3','E3','G3','C4','G3','E3','C3','G3'],
  dancehall:  ['G3','B3','D4','G3','A3','C4','E4','D4','G3','B3','D4','G4','E4','D4','B3','G3'],
  gospel:     ['C4','E4','G4','C5','E5','C5','G4','E4','F4','A4','C5','F5','E5','C5','A4','F4'],
  country:    ['G3','B3','D4','G4','D4','B3','G3','A3','C4','E4','G4','E4','C4','A3','G3','D4'],
  soul:       ['C4','D4','E4','G4','A4','G4','E4','D4','E4','G4','A4','C5','B4','A4','G4','E4'],
  funk:       ['E3','G3','A3','C4','E3','G3','A3','C4','D3','F3','A3','C4','E3','G3','B3','E3'],
  metal:      ['E2','E2','G2','A2','E2','E2','B2','A2','E2','G2','A2','B2','E3','B2','A2','E2'],
  ambient:    ['C4','G4','E5','G4','C4','D4','A4','F5','A4','D4','E4','B4','G5','B4','E4','C4'],
};

/** Shapes TTS pitch/rate only (no oscillator backing track). */
const MOOD_PARAMS = {
  Energetic:  { pitch: 1.05, rate: 1.08 },
  Chill:      { pitch: 0.98, rate: 0.92 },
  Dark:       { pitch: 0.88, rate: 0.95 },
  Uplifting:  { pitch: 1.12, rate: 1.05 },
  Romantic:   { pitch: 1.02, rate: 0.88 },
  Aggressive: { pitch: 0.95, rate: 1.12 },
  Dreamy:     { pitch: 1.08, rate: 0.82 },
  Melancholic:{ pitch: 0.92, rate: 0.9 },
};

export function loadVoices() {
  if (voicesLoaded && allVoices.length) return Promise.resolve(allVoices);
  return new Promise(resolve => {
    function get() {
      allVoices = speechSynthesis.getVoices();
      if (allVoices.length) {
        voicesLoaded = true;
        state.log('Voice Engine', `Loaded ${allVoices.length} real voices`);
        resolve(allVoices);
      }
    }
    get();
    if (!allVoices.length) {
      speechSynthesis.onvoiceschanged = () => { get(); resolve(allVoices); };
      setTimeout(() => { get(); resolve(allVoices); }, 2000);
    }
  });
}

export function getVoices() { return allVoices; }
export function isLoaded() { return voicesLoaded; }

export function getVoicesByLanguage() {
  const map = {};
  for (const v of allVoices) {
    const lang = v.lang.split('-')[0];
    const langName = LANG_NAMES[lang] || v.lang;
    if (!map[langName]) map[langName] = [];
    map[langName].push(v);
  }
  const sorted = {};
  for (const key of Object.keys(map).sort()) sorted[key] = map[key];
  return sorted;
}

const LANG_NAMES = {
  en: 'English', es: 'Spanish', fr: 'French', de: 'German', it: 'Italian',
  pt: 'Portuguese', ru: 'Russian', ja: 'Japanese', ko: 'Korean', zh: 'Chinese',
  ar: 'Arabic', hi: 'Hindi', nl: 'Dutch', sv: 'Swedish', no: 'Norwegian',
  da: 'Danish', fi: 'Finnish', pl: 'Polish', tr: 'Turkish', th: 'Thai',
  vi: 'Vietnamese', id: 'Indonesian', ms: 'Malay', ro: 'Romanian', cs: 'Czech',
  hu: 'Hungarian', el: 'Greek', he: 'Hebrew', uk: 'Ukrainian', bg: 'Bulgarian',
  hr: 'Croatian', sk: 'Slovak', ca: 'Catalan', af: 'Afrikaans', sw: 'Swahili',
  nb: 'Norwegian', fil: 'Filipino', ta: 'Tamil', te: 'Telugu', bn: 'Bengali',
};

export function speak(text, voice, options = {}) {
  stopSpeaking();
  const utterance = new SpeechSynthesisUtterance(text);
  if (voice) utterance.voice = voice;
  utterance.pitch = options.pitch ?? 1;
  utterance.rate = options.rate ?? 1;
  utterance.volume = options.volume ?? 1;
  utterance.onstart = () => { isSpeaking = true; };
  utterance.onend = () => { isSpeaking = false; currentUtterance = null; };
  utterance.onerror = () => { isSpeaking = false; currentUtterance = null; };
  currentUtterance = utterance;
  speechSynthesis.speak(utterance);
  return utterance;
}

export function stopSpeaking() {
  speechSynthesis.cancel();
  isSpeaking = false;
  currentUtterance = null;
  singCancelFlag = true;
}

export function previewVoice(voice) {
  const samples = {
    en: "Hey! Check out this brand new track, it's fire.",
    es: "¡Oye! Escucha esta nueva canción increíble.",
    fr: "Hé! Écoute ce nouveau morceau, c'est incroyable.",
    de: "Hey! Hör dir diesen neuen Track an, er ist Feuer.",
    it: "Ehi! Ascolta questa nuova traccia, è fuoco.",
    pt: "Ei! Confira essa nova faixa, é demais.",
    ja: "ねぇ！この新しいトラックを聴いて、最高だよ。",
    ko: "야! 이 새 트랙 들어봐, 대박이야.",
    zh: "嘿！听听这首新歌，太火了。",
    ar: "مرحبا! استمع لهذه الأغنية الجديدة، إنها رائعة.",
    ru: "Эй! Послушай этот новый трек, он огонь.",
    hi: "अरे! यह नया ट्रैक सुनो, बहुत अच्छा है।",
    af: "Haai! Luister na hierdie nuwe snit, dis vuur.",
    nl: "Hé! Luister naar dit nieuwe nummer, het is geweldig.",
  };
  const lang = voice.lang.split('-')[0];
  const text = samples[lang] || samples.en;
  speak(text, voice, { rate: 1, pitch: 1 });
}

export function getGenres() { return Object.keys(MELODIES); }
export function getMoods() { return Object.keys(MOOD_PARAMS); }

function speakWordAsync(word, voice, { pitch, rate, volume = 0.95 } = {}) {
  return new Promise(resolve => {
    const u = new SpeechSynthesisUtterance(word);
    if (voice) u.voice = voice;
    u.pitch = Math.max(0, Math.min(2, pitch ?? 1));
    u.rate = Math.max(0.5, Math.min(2, rate ?? 1));
    u.volume = volume;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    speechSynthesis.speak(u);
  });
}

export async function singLyrics(lyricsText, voice, options = {}) {
  stopSpeaking();
  singCancelFlag = false;
  isSinging = true;

  const genre = options.genre || 'pop';
  const mood = options.mood || 'Energetic';
  const bpm = options.bpm || 120;
  const melody = MELODIES[genre] || MELODIES.pop;
  const moodP = MOOD_PARAMS[mood] || MOOD_PARAMS.Energetic;
  const beatDuration = 60 / bpm;

  const allLines = lyricsText.split('\n').filter(l => l.trim());

  let lineIdx = 0;

  for (const line of allLines) {
    if (singCancelFlag) break;

    if (line.trim().startsWith('[')) {
      try { onLineCallback?.(lineIdx, -1, line.trim()); } catch {}
      lineIdx++;
      await sleep(beatDuration * 300);
      continue;
    }

    const words = line.trim().split(/\s+/);
    try { onLineCallback?.(lineIdx, 0, line.trim()); } catch {}

    for (let wi = 0; wi < words.length; wi++) {
      if (singCancelFlag) break;
      const word = words[wi];

      try { onWordCallback?.(lineIdx, wi, word); } catch {}

      const note = melody[wi % melody.length];
      const refHz = NOTES[note] || 261.63;
      const pitchFromMelody = Math.max(0.5, Math.min(1.5, refHz / 220));

      const duration = Math.max(0.15, beatDuration * (0.45 + word.length * 0.06));
      const rateFromBpm = Math.max(0.55, Math.min(1.35, 1.0 / (duration * 0.85)));

      await speakWordAsync(word, voice, {
        pitch: pitchFromMelody * moodP.pitch,
        rate: rateFromBpm * moodP.rate,
      });

      await sleep(beatDuration * 80);
    }

    lineIdx++;
    if (!singCancelFlag) await sleep(beatDuration * 350);
  }

  isSinging = false;
  try { onDoneCallback?.(); } catch {}
  state.log('Voice Engine', `Finished singing (real voice) · ${genre} · ${mood} · ${bpm} BPM`);
}

export async function speakLyrics(lyricsText, voice, options = {}) {
  stopSpeaking();
  singCancelFlag = false;
  isSpeaking = true;

  const lines = lyricsText.split('\n').filter(l => l.trim());

  for (let li = 0; li < lines.length; li++) {
    if (singCancelFlag) break;
    const line = lines[li];

    if (line.trim().startsWith('[')) {
      try { onLineCallback?.(li, -1, line.trim()); } catch {}
      await sleep(600);
      continue;
    }

    try { onLineCallback?.(li, 0, line.trim()); } catch {}

    const words = line.trim().split(/\s+/);
    for (let wi = 0; wi < words.length; wi++) {
      try { onWordCallback?.(li, wi, words[wi]); } catch {}
    }

    const utterance = new SpeechSynthesisUtterance(line);
    if (voice) utterance.voice = voice;
    utterance.pitch = options.pitch ?? 1;
    utterance.rate = options.rate ?? 0.9;
    utterance.volume = options.volume ?? 1;

    await new Promise(resolve => {
      utterance.onend = resolve;
      utterance.onerror = resolve;
      speechSynthesis.speak(utterance);
    });

    if (!singCancelFlag) await sleep(300);
  }

  isSpeaking = false;
  try { onDoneCallback?.(); } catch {}
}

export function getIsSpeaking() { return isSpeaking; }
export function getIsSinging() { return isSinging; }

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
