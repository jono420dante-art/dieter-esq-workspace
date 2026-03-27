import { getPrediction, extractAudioUrl } from '../../../lib/replicateMusicgen.js';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const id = req.query?.id;
  if (!id || typeof id !== 'string') {
    res.status(400).json({ error: 'Missing prediction id' });
    return;
  }
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    res.status(503).json({ error: 'REPLICATE_API_TOKEN not configured' });
    return;
  }
  try {
    const data = await getPrediction(id, token);
    const audioUrl = extractAudioUrl(data);
    res.status(200).json({
      jobId: data.id,
      status: data.status,
      audioUrl: audioUrl || null,
      error: data.error?.detail || data.error || null,
    });
  } catch (e) {
    console.error('[api/music/prediction]', e);
    res.status(500).json({ error: e.message || 'Poll failed' });
  }
}
