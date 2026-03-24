import { Router } from 'express';
import { randomUUID } from 'crypto';

const router = Router();

const mockJobs = new Map();

router.post('/generate', (req, res) => {
  const { prompt, genre = 'electronic', mood = 'uplifting', bpm = 120, key = 'C', duration = 180 } = req.body ?? {};
  const jobId = randomUUID();

  mockJobs.set(jobId, {
    id: jobId,
    type: 'generate',
    status: 'queued',
    progress: 0,
    prompt: prompt || 'Ambient electronic track',
    params: { genre, mood, bpm, key, duration },
    createdAt: new Date().toISOString(),
  });

  res.status(202).json({
    jobId,
    status: 'queued',
    message: 'Track generation started',
    estimatedTime: Math.ceil(duration / 2),
  });
});

router.get('/status/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = mockJobs.get(jobId);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  const statuses = ['queued', 'processing', 'completed'];
  const idx = statuses.indexOf(job.status);
  if (idx < 2 && Math.random() > 0.7) {
    job.status = statuses[idx + 1];
    job.progress = (idx + 1) * 50;
  }
  if (job.status === 'completed' && !job.result) {
    job.result = {
      trackId: randomUUID(),
      url: `/assets/tracks/${randomUUID()}.mp3`,
      duration: job.params.duration,
      waveform: Array.from({ length: 100 }, () => Math.random()),
    };
  }

  res.json({
    jobId,
    status: job.status,
    progress: job.progress,
    result: job.result ?? null,
  });
});

router.post('/mutate', (req, res) => {
  const { trackId, mutation = 'remix', intensity = 0.5 } = req.body ?? {};
  const jobId = randomUUID();

  mockJobs.set(jobId, {
    id: jobId,
    type: 'mutate',
    status: 'queued',
    sourceTrackId: trackId || randomUUID(),
    mutation,
    intensity,
    createdAt: new Date().toISOString(),
  });

  res.status(202).json({
    jobId,
    status: 'queued',
    message: `Mutation "${mutation}" started`,
  });
});

router.get('/library', (req, res) => {
  const page = Math.max(1, parseInt(req.query.page ?? '1', 10));
  const limit = Math.min(50, Math.max(10, parseInt(req.query.limit ?? '20', 10)));
  const genre = req.query.genre;

  const mockTracks = [
    { id: randomUUID(), title: 'Neon Dreams', genre: 'electronic', duration: 245, bpm: 128, key: 'Am', createdAt: '2025-03-15T10:00:00Z' },
    { id: randomUUID(), title: 'Midnight Drive', genre: 'synthwave', duration: 312, bpm: 95, key: 'Em', createdAt: '2025-03-14T14:30:00Z' },
    { id: randomUUID(), title: 'Pulse', genre: 'electronic', duration: 180, bpm: 140, key: 'Fm', createdAt: '2025-03-13T09:15:00Z' },
    { id: randomUUID(), title: 'Ethereal', genre: 'ambient', duration: 420, bpm: 72, key: 'D', createdAt: '2025-03-12T16:00:00Z' },
    { id: randomUUID(), title: 'Voltage', genre: 'electronic', duration: 198, bpm: 132, key: 'C#m', createdAt: '2025-03-11T11:45:00Z' },
  ];

  let filtered = genre ? mockTracks.filter((t) => t.genre === genre) : mockTracks;
  const total = filtered.length;
  const start = (page - 1) * limit;
  const items = filtered.slice(start, start + limit);

  res.json({
    tracks: items,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

export default router;
