import { createMusicgenPrediction } from '../../lib/replicateMusicgen.js';
import { VOICE_HINTS } from '../../lib/voiceHints.js';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    res.status(503).json({
      error:
        'Set REPLICATE_API_TOKEN in Vercel → Project → Settings → Environment Variables, then redeploy.',
    });
    return;
  }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const hintFromVoice = VOICE_HINTS[body.voice] || '';
    const prediction = await createMusicgenPrediction({ ...body, voiceHint: hintFromVoice }, token);
    res.status(200).json({
      jobId: prediction.id,
      status: prediction.status || 'starting',
    });
  } catch (e) {
    console.error('[api/music/generate]', e);
    res.status(500).json({ error: e.message || 'Music generation failed' });
  }
}
