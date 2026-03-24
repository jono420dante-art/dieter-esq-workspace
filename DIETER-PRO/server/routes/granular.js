import { Router } from 'express';
import { randomUUID } from 'crypto';

const router = Router();

const CATEGORIES = [
  'Pads', 'Textures', 'Atmospheres', 'Drones', 'Leads', 'Bass',
  'Percussion', 'Vocals', 'Nature', 'Cinematic', 'Glitch',
];

const PADS = ['Soft Pad', 'Bright Pad', 'Dark Pad', 'Analog Pad', 'Lush Pad', 'Cold Pad', 'Warm Pad', 'Granular Pad', 'Swirling Pad', 'Crystalline Pad', 'Dream Pad', 'Space Pad', 'Organic Pad', 'Digital Pad', 'Morphing Pad', 'Evolving Pad', 'Shimmer Pad', 'Deep Pad', 'Airy Pad', 'Dense Pad', 'Minimal Pad', 'Layered Pad', 'Glowing Pad', 'Fading Pad', 'Rising Pad'];
const TEXTURES = ['Gritty Texture', 'Smooth Texture', 'Noisy Texture', 'Glass Texture', 'Metal Texture', 'Grainy Texture', 'Dusty Texture', 'Hazy Texture', 'Cracked Texture', 'Liquid Texture', 'Static Texture', 'Rusty Texture', 'Velvet Texture', 'Ice Texture', 'Sand Texture', 'Smoke Texture', 'Fabric Texture', 'Crystal Texture', 'Wood Texture', 'Stone Texture', 'Water Texture', 'Fire Texture', 'Wind Texture', 'Electric Texture', 'Organic Texture'];
const ATMOSPHERES = ['Ambient Dawn', 'Foggy Forest', 'Urban Night', 'Ocean Depths', 'Mountain Air', 'Desert Wind', 'Rainy Street', 'Snowfall', 'Thunderstorm', 'Twilight', 'Underwater', 'Space Void', 'Industrial', 'Tropical', 'Arctic', 'Volcanic', 'Cave Echo', 'City Pulse', 'Rural Silence', 'Storm Front', 'Mist Valley', 'Sunset Horizon', 'Winter Morning', 'Summer Evening', 'Spring Rain'];
const DRONES = ['Deep Drone', 'High Drone', 'Pulsing Drone', 'Static Drone', 'Evolving Drone', 'Low Drone', 'Harmonic Drone', 'Noisy Drone', 'Clean Drone', 'Layered Drone', 'Shifting Drone', 'Resonant Drone', 'Dark Drone', 'Bright Drone', 'Sub Drone', 'Mid Drone', 'Organic Drone', 'Synthetic Drone', 'Breathing Drone', 'Sustained Drone', 'Modulating Drone', 'Textured Drone', 'Minimal Drone', 'Dense Drone', 'Floating Drone'];
const LEADS = ['Pluck Lead', 'Buzzy Lead', 'Soft Lead', 'Aggressive Lead', 'Crystalline Lead', 'Warm Lead', 'Cold Lead', 'Distorted Lead', 'Clean Lead', 'Wobbly Lead', 'Staccato Lead', 'Sustained Lead', 'Analog Lead', 'Digital Lead', 'Smooth Lead', 'Gritty Lead', 'Bright Lead', 'Dark Lead', 'Percussive Lead', 'Liquid Lead', 'Glassy Lead', 'Metallic Lead', 'Wooden Lead', 'Electric Lead', 'Vocal Lead'];
const BASS = ['Sub Bass', 'Warm Bass', 'Growl Bass', 'Pluck Bass', 'Reese Bass', 'Acid Bass', 'Layered Bass', 'Punchy Bass', 'Soft Bass', 'Distorted Bass', 'Clean Bass', 'Gritty Bass', 'Deep Bass', 'Mid Bass', 'Rubber Bass', 'Analog Bass', 'Digital Bass', 'Organic Bass', 'Synthetic Bass', 'Pulsing Bass', 'Sustained Bass', 'Staccato Bass', 'Rumbling Bass', 'Sharp Bass', 'Round Bass'];
const PERCUSSION = ['Glitch Perc', 'Granular Snare', 'Grain Kick', 'Textured HiHat', 'Evolving Perc', 'Organic Perc', 'Metallic Perc', 'Wooden Perc', 'Glassy Perc', 'Shaker Grain', 'Tambourine Grain', 'Conga Grain', 'Djembe Grain', 'Tabla Grain', 'Industrial Perc', 'Natural Perc', 'Digital Perc', 'Analog Perc', 'Rhythmic Grain', 'Random Perc', 'Sparse Perc', 'Dense Perc', 'Minimal Perc', 'Complex Perc', 'Abstract Perc'];
const VOCALS = ['Chopped Vocal', 'Granular Vocal', 'Pitch Vocal', 'Stretched Vocal', 'Glitch Vocal', 'Ethereal Vocal', 'Whisper Grain', 'Harmonic Vocal', 'Droning Vocal', 'Textured Vocal', 'Layered Vocal', 'Minimal Vocal', 'Dense Vocal', 'Sparse Vocal', 'Breathy Vocal', 'Robotic Vocal', 'Organic Vocal', 'Synthetic Vocal', 'Reversed Vocal', 'Pitched Vocal', 'Scattered Vocal', 'Smooth Vocal', 'Gritty Vocal', 'Crystalline Vocal', 'Warm Vocal'];
const NATURE = ['Birds Granular', 'Rain Grain', 'Wind Grain', 'Ocean Grain', 'Forest Grain', 'Fire Crackle', 'Stream Water', 'Thunder Grain', 'Leaves Rustle', 'Insects Grain', 'Wolf Howl', 'Whale Song', 'Night Crickets', 'Morning Birds', 'Storm Grain', 'Waterfall Grain', 'Cave Drip', 'Desert Wind', 'Snow Crunch', 'River Flow', 'Mountain Echo', 'Meadow Breeze', 'Jungle Ambience', 'Coastal Wave', 'Prairie Grass'];
const CINEMATIC = ['Orchestral Grain', 'Tension Builder', 'Epic Swell', 'Horror Texture', 'Action Pulse', 'Drama Layer', 'Suspense Drone', 'Triumphant Grain', 'Melancholic', 'Mysterious', 'Sci-Fi Texture', 'Western Grain', 'Noir Atmosphere', 'Documentary', 'Trailer Impact', 'Emotional Swell', 'Battle Scene', 'Chase Sequence', 'Reveal Moment', 'Climax Build', 'Resolution', 'Transition', 'Flashback', 'Dream Sequence', 'Credits Roll'];
const GLITCH = ['Bit Crush', 'Stutter Glitch', 'Splice Glitch', 'Granular Glitch', 'Buffer Glitch', 'Delay Glitch', 'Pitch Glitch', 'Reverse Glitch', 'Stutter Cut', 'Chaos Grain', 'Digital Artefact', 'Corruption', 'Glitch Pad', 'Broken Loop', 'Fractured', 'Scattered', 'Random Jump', 'Data Moshing', 'Time Stretch Glitch', 'Granular Chaos', 'Sync Glitch', 'Rhythm Glitch', 'Melody Glitch', 'Noise Glitch', 'Clean Glitch'];

const PRESET_SETS = [PADS, TEXTURES, ATMOSPHERES, DRONES, LEADS, BASS, PERCUSSION, VOCALS, NATURE, CINEMATIC, GLITCH];

function buildPresets() {
  const presets = [];
  let id = 1;
  for (let c = 0; c < CATEGORIES.length; c++) {
    const set = PRESET_SETS[c];
    const cat = CATEGORIES[c];
    for (let i = 0; i < set.length; i++) {
      presets.push({
        id: String(id++),
        name: set[i],
        category: cat,
        grainSize: 15 + Math.floor(Math.random() * 180),
        density: 1 + Math.floor(Math.random() * 40),
        spread: Math.random().toFixed(2),
        pitch: (0.5 + Math.random()).toFixed(2),
        reverse: Math.random() > 0.7,
        envelope: ['adsr', 'perc', 'sustained'][Math.floor(Math.random() * 3)],
        modulation: ['lfo', 'env', 'random', 'none'][Math.floor(Math.random() * 4)],
      });
    }
  }
  return presets;
}

const PRESETS = buildPresets();

router.get('/presets', (req, res) => {
  const category = req.query.category;
  const page = Math.max(1, parseInt(req.query.page ?? '1', 10));
  const limit = Math.min(100, Math.max(10, parseInt(req.query.limit ?? '50', 10)));

  let filtered = category ? PRESETS.filter((p) => p.category === category) : PRESETS;
  const total = filtered.length;
  const start = (page - 1) * limit;
  const items = filtered.slice(start, start + limit);

  res.json({
    presets: items,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    categories: CATEGORIES,
  });
});

router.get('/presets/:id', (req, res) => {
  const preset = PRESETS.find((p) => p.id === req.params.id);
  if (!preset) {
    return res.status(404).json({ error: 'Preset not found' });
  }
  res.json(preset);
});

router.post('/render', (req, res) => {
  const { sourceUrl, presetId, duration = 30, format = 'wav' } = req.body ?? {};
  const jobId = randomUUID();

  res.status(202).json({
    jobId,
    status: 'queued',
    message: 'Granular render started',
    params: {
      sourceUrl: sourceUrl ?? '/assets/sample.wav',
      presetId: presetId ?? '1',
      duration,
      format,
    },
    estimatedTime: Math.ceil(duration * 0.5),
  });
});

router.post('/analyze', (req, res) => {
  const { audioUrl, targetGrainSize } = req.body ?? {};

  res.json({
    analysisId: randomUUID(),
    duration: 45.2,
    sampleRate: 44100,
    recommendedGrainSize: 32,
    optimalDensity: 12,
    transients: [0.1, 1.2, 2.4, 3.8, 5.1],
    spectralCentroid: 2100,
    suggestions: [
      'Reduce grain size for more transient clarity',
      'Increase density for smoother texture',
      'Consider envelope sustain for sustained sections',
    ],
  });
});

export default router;
