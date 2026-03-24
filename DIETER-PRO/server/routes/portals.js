import { Router } from 'express';
import { randomUUID } from 'crypto';

const router = Router();

const PLATFORMS = [
  { id: 'spotify', name: 'Spotify', status: 'active', revenueShare: 0.7 },
  { id: 'apple', name: 'Apple Music', status: 'active', revenueShare: 0.73 },
  { id: 'youtube', name: 'YouTube Music', status: 'active', revenueShare: 0.55 },
  { id: 'amazon', name: 'Amazon Music', status: 'active', revenueShare: 0.68 },
  { id: 'deezer', name: 'Deezer', status: 'active', revenueShare: 0.65 },
  { id: 'tidal', name: 'Tidal', status: 'active', revenueShare: 0.75 },
  { id: 'soundcloud', name: 'SoundCloud', status: 'active', revenueShare: 0.6 },
  { id: 'bandcamp', name: 'Bandcamp', status: 'active', revenueShare: 0.85 },
];

const distributionStatuses = new Map();

router.get('/', (req, res) => {
  res.json({
    platforms: PLATFORMS,
    defaultSelection: ['spotify', 'apple', 'youtube'],
  });
});

router.post('/distribute', (req, res) => {
  const { trackId, platforms = ['spotify', 'apple'], metadata } = req.body ?? {};
  const distId = randomUUID();

  distributionStatuses.set(distId, {
    id: distId,
    trackId: trackId ?? randomUUID(),
    platforms,
    status: 'submitted',
    progress: 0,
    createdAt: new Date().toISOString(),
  });

  res.status(202).json({
    distId,
    status: 'submitted',
    message: 'Distribution submitted to platforms',
    platforms,
    estimatedLiveDate: new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0],
  });
});

router.get('/status/:distId', (req, res) => {
  const dist = distributionStatuses.get(req.params.distId);
  if (!dist) {
    return res.status(404).json({ error: 'Distribution not found' });
  }

  const statuses = ['submitted', 'processing', 'live'];
  const idx = statuses.indexOf(dist.status);
  if (idx < 2 && Math.random() > 0.6) {
    dist.status = statuses[idx + 1];
    dist.progress = (idx + 1) * 50;
  }
  if (dist.status === 'live') {
    dist.progress = 100;
    dist.platformStatus = dist.platforms.map((p) => ({ platform: p, status: 'live', liveDate: new Date().toISOString().split('T')[0] }));
  }

  res.json({
    distId: dist.id,
    trackId: dist.trackId,
    status: dist.status,
    progress: dist.progress,
    platformStatus: dist.platformStatus ?? dist.platforms.map((p) => ({ platform: p, status: dist.status })),
  });
});

router.get('/analytics', (req, res) => {
  const period = req.query.period ?? '30d';

  res.json({
    period,
    totalStreams: 124500,
    totalRevenue: 423.75,
    byPlatform: [
      { platform: 'spotify', name: 'Spotify', streams: 78200, revenue: 234.60 },
      { platform: 'apple', name: 'Apple Music', streams: 31200, revenue: 142.40 },
      { platform: 'youtube', name: 'YouTube Music', streams: 15100, revenue: 46.75 },
    ],
    topTracks: [
      { trackId: randomUUID(), title: 'Neon Dreams', streams: 45000 },
      { trackId: randomUUID(), title: 'Midnight Drive', streams: 28900 },
    ],
    updated: new Date().toISOString(),
  });
});

export default router;
