/**
 * Music routes — MusicGen via Replicate (same logic as Vercel api/ handlers).
 */
import express from 'express';
import {
  createMusicgenPrediction,
  getPrediction,
  extractAudioUrl,
} from '../../lib/replicateMusicgen.js';
import { VOICE_HINTS } from '../../lib/voiceHints.js';

const router = express.Router();

function tokenOrError(res) {
  const t = process.env.REPLICATE_API_TOKEN;
  if (!t) {
    res.status(503).json({
      error:
        'Music generation needs REPLICATE_API_TOKEN on the server. Set it on Render (Environment) or Vercel (Environment Variables).',
    });
    return null;
  }
  return t;
}

router.post('/generate', async (req, res) => {
  const token = tokenOrError(res);
  if (!token) return;
  try {
    const hintFromVoice = VOICE_HINTS[req.body.voice] || '';
    const prediction = await createMusicgenPrediction(
      { ...req.body, voiceHint: hintFromVoice },
      token,
    );
    res.json({
      jobId: prediction.id,
      status: prediction.status || 'starting',
    });
  } catch (e) {
    console.error('[music/generate]', e);
    res.status(500).json({ error: e.message || 'Music generation failed' });
  }
});

router.get('/prediction/:id', async (req, res) => {
  const token = tokenOrError(res);
  if (!token) return;
  try {
    const data = await getPrediction(req.params.id, token);
    const audioUrl = extractAudioUrl(data);
    res.json({
      jobId: data.id,
      status: data.status,
      audioUrl: audioUrl || null,
      error: data.error?.detail || data.error || null,
    });
  } catch (e) {
    console.error('[music/prediction]', e);
    res.status(500).json({ error: e.message || 'Poll failed' });
  }
});

export default router;
