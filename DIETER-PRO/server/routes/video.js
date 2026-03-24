import { Router } from 'express';
import { randomUUID } from 'crypto';

const router = Router();

const mockVideoJobs = new Map();

const TEMPLATES = [
  { id: 'synthwave-grid', name: 'Synthwave Grid', duration: 10, aspectRatio: '16:9', tags: ['retro', 'synth'] },
  { id: 'particle-flow', name: 'Particle Flow', duration: 15, aspectRatio: '16:9', tags: ['abstract', 'fluid'] },
  { id: 'waveform-visual', name: 'Waveform Visual', duration: 5, aspectRatio: '1:1', tags: ['music', 'audio-reactive'] },
  { id: 'cinematic-slow', name: 'Cinematic Slow', duration: 30, aspectRatio: '21:9', tags: ['film', 'dramatic'] },
  { id: 'glitch-matrix', name: 'Glitch Matrix', duration: 8, aspectRatio: '16:9', tags: ['cyber', 'glitch'] },
  { id: 'nature-aurora', name: 'Nature Aurora', duration: 20, aspectRatio: '16:9', tags: ['nature', 'calm'] },
  { id: 'vaporwave', name: 'Vaporwave Sunset', duration: 12, aspectRatio: '4:3', tags: ['vaporwave', 'aesthetic'] },
  { id: 'minimal-gradient', name: 'Minimal Gradient', duration: 10, aspectRatio: '1:1', tags: ['minimal', 'clean'] },
];

router.post('/generate', (req, res) => {
  const { prompt, audioUrl, templateId, duration = 10 } = req.body ?? {};
  const jobId = randomUUID();

  mockVideoJobs.set(jobId, {
    id: jobId,
    status: 'queued',
    prompt: prompt || 'Abstract visual',
    audioUrl: audioUrl ?? null,
    templateId,
    duration,
    createdAt: new Date().toISOString(),
  });

  res.status(202).json({
    jobId,
    status: 'queued',
    message: 'Video generation started',
    estimatedTime: 45,
  });
});

router.get('/status/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = mockVideoJobs.get(jobId);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  if (job.status !== 'completed' && Math.random() > 0.6) {
    job.status = job.status === 'queued' ? 'processing' : 'completed';
  }
  if (job.status === 'completed' && !job.result) {
    job.result = {
      videoId: randomUUID(),
      url: `/assets/videos/${randomUUID()}.mp4`,
      duration: job.duration,
      thumbnailUrl: `/assets/thumbnails/${randomUUID()}.jpg`,
    };
  }

  res.json({
    jobId,
    status: job.status,
    progress: job.status === 'completed' ? 100 : job.status === 'processing' ? 65 : 0,
    result: job.result ?? null,
  });
});

router.post('/effects', (req, res) => {
  const { videoId, effects = [] } = req.body ?? {};
  if (!videoId) {
    return res.status(400).json({ error: 'videoId is required' });
  }

  const jobId = randomUUID();
  res.status(202).json({
    jobId,
    status: 'queued',
    message: 'Effects application started',
    effects: effects.length ? effects : ['color-grade', 'glitch'],
  });
});

router.get('/templates', (_req, res) => {
  res.json({
    templates: TEMPLATES,
    total: TEMPLATES.length,
  });
});

export default router;
