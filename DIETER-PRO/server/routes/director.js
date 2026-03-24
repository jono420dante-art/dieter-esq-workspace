import { Router } from 'express';
import { randomUUID } from 'crypto';

const router = Router();

const GENRE_TIPS = {
  electronic: [
    'Layer a sub bass under your main bass for warmth',
    'Use sidechain compression on pads against the kick',
    'Add subtle automation to filter cutoff for movement',
    'Try layering white noise with your hi-hats for air',
  ],
  ambient: [
    'Stretch reverb tails to create infinite spaces',
    'Layer multiple pads at different octaves',
    'Use slow LFO modulation for organic movement',
    'Add field recordings for texture and depth',
  ],
  hiphop: [
    'Quantize drums to 1/16 with slight swing',
    'Layer vinyl crackle for warmth',
    'Use sampled chops for unique vocal textures',
    'Keep bass simple and punchy',
  ],
  pop: [
    'Focus on vocal-forward mix with clear dynamics',
    'Use bus compression for glue',
    'Add subtle saturation on the master',
    'Ensure chorus sections have more energy',
  ],
  default: [
    'Balance frequency spectrum across mix',
    'Use reference tracks in the same genre',
    'Leave headroom for mastering',
    'Check mono compatibility',
  ],
};

router.post('/suggest', (req, res) => {
  const { projectState, stems, genre, currentSection } = req.body ?? {};
  const suggestionId = randomUUID();

  const suggestions = [
    { type: 'structure', text: 'Consider adding a breakdown before the drop to increase impact', priority: 'high' },
    { type: 'mix', text: 'Vocals could use 1–2 dB more presence around 3 kHz', priority: 'medium' },
    { type: 'arrangement', text: 'The bridge might benefit from a stripped-down section', priority: 'low' },
    { type: 'effect', text: 'Add subtle delay on the lead for width', priority: 'medium' },
  ];

  res.json({
    suggestionId,
    suggestions: suggestions.slice(0, 2 + Math.floor(Math.random() * 2)),
    context: {
      stemsCount: stems?.length ?? 8,
      genre: genre ?? 'electronic',
      section: currentSection ?? 'verse',
    },
  });
});

router.post('/arrange', (req, res) => {
  const { stems, genre = 'electronic', style = 'balanced' } = req.body ?? {};
  const jobId = randomUUID();

  res.status(202).json({
    jobId,
    status: 'queued',
    message: 'Auto-arrangement started',
    suggestedStructure: [
      { section: 'intro', bars: 8, stems: ['pad', 'atmosphere'] },
      { section: 'verse', bars: 16, stems: ['kick', 'bass', 'pad', 'melody'] },
      { section: 'build', bars: 8, stems: ['kick', 'bass', 'pad', 'melody', 'riser'] },
      { section: 'drop', bars: 16, stems: ['kick', 'bass', 'pad', 'melody', 'hihat', 'clap'] },
      { section: 'breakdown', bars: 8, stems: ['pad', 'atmosphere'] },
      { section: 'outro', bars: 8, stems: ['pad', 'atmosphere'] },
    ],
  });
});

router.post('/master', (req, res) => {
  const { stems, targetLufs = -14, genre } = req.body ?? {};
  const jobId = randomUUID();

  res.status(202).json({
    jobId,
    status: 'queued',
    message: 'Auto-master started',
    settings: {
      targetLufs,
      ceiling: -0.1,
      dither: true,
      stereoWidth: 1.0,
      eq: { lowShelf: 0, mid: 0, highShelf: 0.5 },
      compression: { ratio: 2, threshold: -18 },
    },
    estimatedTime: 30,
  });
});

router.get('/tips', (req, res) => {
  const genre = req.query.genre ?? 'default';
  const tips = GENRE_TIPS[genre] ?? GENRE_TIPS.default;

  res.json({
    genre,
    tips,
    tipCount: tips.length,
  });
});

export default router;
