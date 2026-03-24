/**
 * DIETER PRO - Server-side Granular Synthesis Engine
 * Mock service for offline granular synthesis, presets, and audio analysis
 */

const PRESET_CATEGORIES = [
  'Pads', 'Textures', 'Atmospheres', 'Drones', 'Leads', 'Bass',
  'Percussion', 'Vocals', 'Nature', 'Cinematic', 'Glitch'
];

const PAD_NAMES = [
  'Ethereal Shimmer', 'Warm Analog Pad', 'Crystalline Layers', 'Dark Matter',
  'Lush Strings', 'Floating Harmonies', 'Midnight Bloom', 'Aurora Borealis',
  'Soft Silk', 'Cosmic Breath', 'Ambient Dreams', 'Velvet Fog', 'Heavenly Choir',
  'Gentle Rain', 'Mystic Dawn', 'Ocean Depths', 'Golden Hour', 'Silver Mist',
  'Pillar of Light', 'Infinite Space', 'Holographic Dust', 'Quantum Foam'
];

const TEXTURE_NAMES = [
  'Gritty Noise', 'Smooth Sand', 'Glass Shards', 'Rusty Metal', 'Organic Grain',
  'Digital Static', 'Warm Wool', 'Cold Ice', 'Fractal Dust', 'Liquid Metal',
  'Crackling Vinyl', 'Paper Rustle', 'Wood Grain', 'Fabric Weave', 'Crystal Lattice',
  'Smoke Particles', 'Dust Motes', 'Asphalt Texture', 'Concrete Surface',
  'Water Droplets', 'Fire Embers', 'Snow Flakes', 'Leather Surface'
];

const ATMOSPHERE_NAMES = [
  'Fog Bank', 'Thunder Distance', 'Wind Cave', 'Underwater Pressure',
  'Mountain Echo', 'City Hum', 'Forest Whisper', 'Desert Wind',
  'Rain on Roof', 'Crowd Murmur', 'Ocean Waves', 'Cave Drip',
  'Temple Bells', 'Distant Storm', 'Abandoned Factory', 'Night Insects',
  'Morning Birds', 'Traffic Flow', 'Market Chatter', 'Wind Chimes',
  'Crackling Fire', 'Rainforest Canopy', 'Arctic Silence', 'Tropical Breeze'
];

const DRONE_NAMES = [
  'Subharmonic Rumble', 'Sacred Tone', 'Industrial Hum', 'Deep Space',
  'Earth Resonance', 'Power Transformer', 'Church Organ', 'Didgeridoo',
  'Singing Bowl', 'Tibetan Bowl', 'Wind Tunnel', 'Machine Room',
  'Electrical Grid', 'Heartbeat', 'Breathing Room', 'Meditation Tone',
  'Distant Engine', 'Low Frequency', 'Bass Foundation', 'Dark Ambient',
  'Reverb Tail', 'Sustain Heaven', 'Endless Tone'
];

const LEAD_NAMES = [
  'Brilliant Shine', 'Warm Pluck', 'Crystalline Bell', 'Liquid Lead',
  'Sharp Edge', 'Soft Focus', 'Neon Glow', 'Vintage Synth',
  'Digital Brightness', 'Analog Warmth', 'Cutting Through', 'Mellow Round',
  'Glass Harmonica', 'Electric Violin', 'Theremin Style', 'Sine Wave Soul',
  'Saw Tooth', 'Square Pulse', 'Triangle Dream', 'FM Sparkle',
  'Wavetable Shift', 'Granular Shimmer'
];

const BASS_NAMES = [
  'Sub Boom', 'Warm Punch', 'Gritty Growl', 'Smooth Sub', 'Round Bottom',
  'Attack Forward', '909 Style', '808 Variation', 'Acoustic Bass', 'Fingered',
  'Picked', 'Synth Bass', 'Reese Bass', 'Wobble', 'Pillar', 'Rumble',
  'Tight Punch', 'Loose Sub', 'Distorted', 'Clean Sub'
];

const PERCUSSION_NAMES = [
  'Grain Snare', 'Micro Hat', 'Tiny Kick', 'Rice Shaker', 'Pebble Hit',
  'Dust Clap', 'Wood Block', 'Metal Scrape', 'Finger Snap', 'Body Percussion',
  'Glitch Kick', 'Stutter Snare', 'Granular Hat', 'Texture Rim', 'Grain Tom',
  'Micro Percussion', 'Particle Snare', 'Dust Hit', 'Scatter', 'Splash',
  'Tiny Bell', 'Grain Clap', 'Particle Crash'
];

const VOCAL_NAMES = [
  'Choir Grain', 'Whispered Word', 'Breath Texture', 'Syllable Scatter',
  'Phoneme Stretch', 'Vowel Pad', 'Consonant Crackle', 'Formant Shift',
  'Harmonic Stack', 'Vocal Choir', 'Angel Voice', 'Ghost Whisper',
  'Robot Speak', 'Pitch Shifter', 'Granular Vocoder', 'Word Fragment',
  'Breath Cloud', 'Vowel Pad', 'Phoneme Rain', 'Micro Singing'
];

const NATURE_NAMES = [
  'Rain Drops', 'Wind Through Trees', 'Stream Babbling', 'Ocean Waves',
  'Bird Chirp', 'Thunder Roll', 'Fire Crackle', 'Leaves Rustling',
  'Waterfall', 'Cricket Chorus', 'Frog Pond', 'Wolf Howl', 'Eagle Cry',
  'Rainforest', 'Desert Wind', 'Mountain Stream', 'Snow Crunch',
  'Ice Cracking', 'Branch Snap', 'Stone Throw', 'Water Splash',
  'Wind Whistle', 'Storm Approaching', 'Morning Dew'
];

const CINEMATIC_NAMES = [
  'Epic Rise', 'Tension Build', 'Reveal Moment', 'Emotional Sweep',
  'Suspense Texture', 'Action Rush', 'Quiet Intro', 'Climax Peak',
  'Resolution Pad', 'Flashback Grain', 'Dream Sequence', 'Horror Creep',
  'Romantic Swell', 'War Drum', 'Victory Fanfare', 'Defeat Sink',
  'Mystery Unfold', 'Chase Scene', 'Discovery Moment', 'Farewell',
  'Opening Credits', 'End Credits', 'Transition Sweep', 'Time Lapse'
];

const GLITCH_NAMES = [
  'Digital Crunch', 'Buffer Stutter', 'Bit Crush', 'Sample Flip',
  'Time Slice', 'Granular Scatter', 'Pitch Chaos', 'Fragment Storm',
  'Data Corruption', 'Buffer Overflow', 'Memory Leak', 'Glitch Hop',
  'Stutter Edit', 'Granular Break', 'Micro Cut', 'Pixel Dust',
  'Error Code', 'System Crash', 'Corrupt Wave', 'Digital Rain',
  'Matrix Glitch', 'VHS Warp', 'CD Skip', 'DAT Dropout'
];

const NAME_MAP = {
  Pads: PAD_NAMES,
  Textures: TEXTURE_NAMES,
  Atmospheres: ATMOSPHERE_NAMES,
  Drones: DRONE_NAMES,
  Leads: LEAD_NAMES,
  Bass: BASS_NAMES,
  Percussion: PERCUSSION_NAMES,
  Vocals: VOCAL_NAMES,
  Nature: NATURE_NAMES,
  Cinematic: CINEMATIC_NAMES,
  Glitch: GLITCH_NAMES,
};

function randomInRange(min, max, decimals = 2) {
  return Number((Math.random() * (max - min) + min).toFixed(decimals));
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function createPreset(category, name, index) {
  const seed = category.charCodeAt(0) + name.charCodeAt(0) + index;
  const seededRandom = (min, max) => {
    const x = Math.sin(seed * 9999) * 10000;
    return Number((min + (x - Math.floor(x)) * (max - min)).toFixed(2));
  };
  return {
    id: `granular-${category.toLowerCase()}-${index}`,
    name,
    category,
    grainSize: seededRandom(1, 500),
    density: seededRandom(0.1, 100),
    pitch: seededRandom(0.5, 2),
    position: seededRandom(0, 1),
    spread: seededRandom(0, 1),
    attack: seededRandom(0.001, 0.5),
    release: seededRandom(0.01, 2),
    pan: seededRandom(-1, 1),
    reverb: seededRandom(0, 1),
    delay: seededRandom(0, 1),
    filter: seededRandom(20, 20000),
    filterQ: seededRandom(0.1, 10),
  };
}

let presetCache = null;

function buildPresets() {
  if (presetCache) return presetCache;
  const presets = [];
  let id = 0;
  for (const category of PRESET_CATEGORIES) {
    const names = NAME_MAP[category];
    const countPerName = Math.ceil(25 / names.length);
    for (let i = 0; i < names.length; i++) {
      for (let j = 0; j < countPerName; j++) {
        presets.push(createPreset(category, names[i], id++));
      }
    }
  }
  // Ensure we have 250+
  while (presets.length < 250) {
    const category = pickRandom(PRESET_CATEGORIES);
    const name = pickRandom(NAME_MAP[category]);
    presets.push(createPreset(category, name, id++));
  }
  presetCache = presets;
  return presets;
}

/**
 * Generate N granular presets with full parameters
 * @param {number} count - Number of presets to generate
 * @returns {Object[]} Array of preset objects
 */
export function generatePresets(count = 260) {
  const all = buildPresets();
  const shuffled = [...all].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

/**
 * Mock audio analysis returning optimal grain parameters
 * @param {Object} audioData - Audio buffer or analysis data
 * @returns {Object} Optimal grain parameters
 */
export function analyzeAudio(audioData) {
  const mockTransientDensity = Math.random() * 50 + 10;
  const mockSpectralCentroid = Math.random() * 8000 + 500;
  return {
    optimalGrainSize: Math.round(1000 / mockTransientDensity),
    optimalDensity: Math.min(100, mockTransientDensity * 2),
    suggestedPitch: 0.8 + (mockSpectralCentroid / 20000) * 0.4,
    recommendedSpread: 0.3 + Math.random() * 0.5,
    attackRecommendation: Math.max(0.001, 0.01 - mockTransientDensity / 10000),
    releaseRecommendation: 0.1 + mockTransientDensity / 100,
    filterSuggestion: Math.min(20000, mockSpectralCentroid * 1.5),
    filterQ: 2 + Math.random() * 4,
    transientPeaks: Math.floor(Math.random() * 15) + 3,
    rmsLevel: randomInRange(-24, -6),
    spectralFlux: randomInRange(0.1, 0.9),
    confidence: randomInRange(0.7, 0.99),
    analysisDuration: randomInRange(0.5, 3.2),
  };
}

/**
 * Mock offline render returning job status
 * @param {Object} params - Render parameters
 * @returns {Object} Job status and metadata
 */
export function renderOffline(params) {
  const { bufferLength = 30, sampleRate = 44100 } = params || {};
  const jobId = `render-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const estimatedSeconds = (bufferLength * sampleRate) / sampleRate * 1.2;
  return {
    jobId,
    status: 'queued',
    progress: 0,
    estimatedTimeSeconds: Math.ceil(estimatedSeconds),
    outputFormat: params?.format || 'wav',
    sampleRate: params?.sampleRate || 44100,
    channels: params?.channels || 2,
    bitDepth: params?.bitDepth || 24,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Mock grain optimization for a buffer towards a target
 * @param {Object} buffer - Audio buffer reference
 * @param {Object} target - Target characteristics
 * @returns {Object} Optimization result
 */
export function optimizeGrains(buffer, target) {
  return {
    optimized: true,
    grainCount: Math.floor(Math.random() * 500) + 100,
    averageGrainSize: randomInRange(30, 200),
    densityAchieved: randomInRange(10, 80),
    spectralMatch: randomInRange(0.75, 0.98),
    transientPreservation: randomInRange(0.6, 0.95),
    iterations: Math.floor(Math.random() * 20) + 5,
    processingTimeMs: Math.floor(Math.random() * 500) + 50,
    suggestions: [
      'Consider increasing density for smoother transitions',
      'Grain size adjusted for transient clarity',
      'Pitch consistency optimized for harmonic content',
    ],
  };
}
