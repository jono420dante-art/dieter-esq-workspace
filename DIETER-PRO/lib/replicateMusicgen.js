/**
 * Meta MusicGen on Replicate — text → audio (MP3).
 * @see https://replicate.com/meta/musicgen
 */
const DEFAULT_OWNER = 'meta';
const DEFAULT_MODEL = 'musicgen';

export async function fetchLatestVersion(owner, model, token) {
  const r = await fetch(`https://api.replicate.com/v1/models/${owner}/${model}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Replicate model ${owner}/${model}: ${r.status} ${text.slice(0, 400)}`);
  const data = JSON.parse(text);
  const vid = data.latest_version?.id;
  if (!vid) throw new Error(`No latest_version for ${owner}/${model}`);
  return vid;
}

export async function createMusicgenPrediction(body, token) {
  const {
    prompt = '',
    genre = 'electronic',
    mood = 'uplifting',
    bpm = 120,
    duration = 15,
    voice = '',
    voiceHint = '',
    key = '',
    scale = '',
  } = body ?? {};

  const keyScale =
    key && scale ? `key of ${key} ${scale}` : key ? `key of ${key}` : '';

  const fullPrompt = [
    `${genre} music`,
    mood,
    `${bpm} BPM`,
    keyScale,
    voiceHint || voice || '',
    prompt,
  ]
    .filter(Boolean)
    .join('. ')
    .slice(0, 2500);

  const seconds = Math.min(30, Math.max(5, Math.floor(Number(duration) || 15)));

  const version = await fetchLatestVersion(DEFAULT_OWNER, DEFAULT_MODEL, token);
  const resp = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      version,
      input: {
        prompt: fullPrompt,
        duration: seconds,
        model_version: 'small',
        output_format: 'mp3',
        normalization_strategy: 'peak',
      },
    }),
  });
  const text = await resp.text();
  if (!resp.ok) throw new Error(`Replicate ${resp.status}: ${text.slice(0, 600)}`);
  return JSON.parse(text);
}

export async function getPrediction(predictionId, token) {
  const r = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Replicate poll ${r.status}: ${text.slice(0, 400)}`);
  return JSON.parse(text);
}

export function extractAudioUrl(data) {
  const out = data?.output;
  if (typeof out === 'string' && /^https?:\/\//i.test(out)) return out;
  if (Array.isArray(out) && typeof out[0] === 'string') return out[0];
  return null;
}
