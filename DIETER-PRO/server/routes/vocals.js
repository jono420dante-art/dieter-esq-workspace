import { Router } from 'express';
import { randomUUID } from 'crypto';

const router = Router();

const VOICES = [
  { id: 'aria', name: 'Aria', styles: ['pop', 'ballad', 'smooth'], gender: 'female', lang: ['en', 'es'] },
  { id: 'storm', name: 'Storm', styles: ['rock', 'power', 'gritty'], gender: 'male', lang: ['en'] },
  { id: 'luna', name: 'Luna', styles: ['ethereal', 'whisper', 'dreamy'], gender: 'female', lang: ['en', 'ja'] },
  { id: 'blaze', name: 'Blaze', styles: ['rap', 'aggressive', 'urban'], gender: 'male', lang: ['en'] },
  { id: 'echo', name: 'Echo', styles: ['jazz', 'crooner', 'warm'], gender: 'male', lang: ['en', 'fr'] },
  { id: 'nova', name: 'Nova', styles: ['dance', 'bright', 'energetic'], gender: 'female', lang: ['en', 'de'] },
];

const STYLES = [
  'pop', 'ballad', 'smooth', 'rock', 'power', 'gritty', 'ethereal', 'whisper', 'dreamy',
  'rap', 'aggressive', 'urban', 'jazz', 'crooner', 'warm', 'dance', 'bright', 'energetic',
  'r&b', 'soul', 'classical', 'opera', 'folk', 'country',
];

router.get('/', (_req, res) => {
  res.json({
    voices: VOICES,
    total: VOICES.length,
  });
});

router.post('/synthesize', (req, res) => {
  const { text, voiceId, style = 'pop' } = req.body ?? {};
  const voice = VOICES.find((v) => v.id === voiceId);

  if (!text) {
    return res.status(400).json({ error: 'Text is required' });
  }
  if (voiceId && !voice) {
    return res.status(404).json({ error: 'Voice not found' });
  }

  const jobId = randomUUID();
  res.status(202).json({
    jobId,
    status: 'queued',
    message: 'Text-to-singing synthesis started',
    voice: voice?.name ?? 'Aria',
    style,
    estimatedDuration: Math.ceil(text.length * 0.15),
  });
});

router.post('/clone', (req, res) => {
  const { name, samples } = req.body ?? {};
  if (!name) {
    return res.status(400).json({ error: 'Voice name is required' });
  }

  const voiceId = randomUUID();
  res.status(201).json({
    voiceId,
    name,
    status: 'training',
    message: 'Voice clone training started. Use GET /api/vocals/ to list when ready.',
    sampleCount: samples?.length ?? 5,
  });
});

router.get('/styles', (_req, res) => {
  res.json({
    styles: STYLES,
    total: STYLES.length,
  });
});

export default router;
