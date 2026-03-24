import { Router } from 'express';
import { randomUUID } from 'crypto';

const router = Router();

const MOCK_LISTINGS = [
  { id: randomUUID(), title: 'Neon Dreams Loop Pack', type: 'loop_pack', price: 24.99, creator: 'StudioPro', downloads: 342 },
  { id: randomUUID(), title: 'Cinematic Pads Collection', type: 'preset_pack', price: 19.99, creator: 'SoundDesign', downloads: 189 },
  { id: randomUUID(), title: '808 Essentials', type: 'sample_pack', price: 14.99, creator: 'BeatLab', downloads: 521 },
  { id: randomUUID(), title: 'Vocal Chops Vol. 2', type: 'sample_pack', price: 29.99, creator: 'VocalWorks', downloads: 203 },
  { id: randomUUID(), title: 'Granular Textures', type: 'preset_pack', price: 22.99, creator: 'TextureLab', downloads: 156 },
];

router.get('/listings', (req, res) => {
  const page = Math.max(1, parseInt(req.query.page ?? '1', 10));
  const limit = Math.min(50, Math.max(10, parseInt(req.query.limit ?? '20', 10)));
  const type = req.query.type;

  let filtered = type ? MOCK_LISTINGS.filter((l) => l.type === type) : MOCK_LISTINGS;
  const total = filtered.length;
  const start = (page - 1) * limit;
  const items = filtered.slice(start, start + limit);

  res.json({
    listings: items,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

router.post('/list', (req, res) => {
  const { title, type, price, description } = req.body ?? {};

  if (!title || !type || !price) {
    return res.status(400).json({ error: 'Missing required fields: title, type, price' });
  }

  const listing = {
    id: randomUUID(),
    title,
    type: type ?? 'sample_pack',
    price: parseFloat(price),
    description: description ?? '',
    creator: 'current_user',
    status: 'pending_review',
    createdAt: new Date().toISOString(),
  };

  res.status(201).json(listing);
});

router.get('/listing/:id', (req, res) => {
  const listing = MOCK_LISTINGS.find((l) => l.id === req.params.id);
  if (!listing) {
    return res.status(404).json({ error: 'Listing not found' });
  }

  res.json({
    ...listing,
    description: 'High-quality collection for professional productions.',
    previewUrl: '/assets/previews/sample.mp3',
    fileCount: 24,
    format: 'WAV 24-bit',
  });
});

router.post('/purchase', (req, res) => {
  const { listingId, quantity = 1 } = req.body ?? {};

  if (!listingId) {
    return res.status(400).json({ error: 'listingId is required' });
  }

  const orderId = randomUUID();
  const listing = MOCK_LISTINGS.find((l) => l.id === listingId) ?? { price: 19.99, title: 'Sample Pack' };

  res.status(201).json({
    orderId,
    listingId,
    amount: listing.price * quantity,
    status: 'completed',
    downloadUrl: `/api/commerce/download/${orderId}`,
    expiresAt: new Date(Date.now() + 86400000 * 7).toISOString(),
  });
});

router.get('/earnings', (req, res) => {
  res.json({
    totalEarnings: 1247.83,
    pending: 89.50,
    payouts: [
      { id: randomUUID(), amount: 312.45, date: '2025-03-15', status: 'paid' },
      { id: randomUUID(), amount: 285.20, date: '2025-03-01', status: 'paid' },
    ],
    topSellers: [
      { title: 'Neon Dreams Loop Pack', revenue: 342.50 },
      { title: '808 Essentials', revenue: 289.30 },
    ],
  });
});

export default router;
