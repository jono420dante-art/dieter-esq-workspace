/**
 * ElevenLabs Music API Service
 * Mock backend for DIETER PRO music/vocal generation
 * In production, integrates with ElevenLabs API
 */

const VOICES = [
  { id: 'bella', name: 'Bella', gender: 'female', style: 'warm, conversational', language: 'en' },
  { id: 'antoni', name: 'Antoni', gender: 'male', style: 'well-rounded, versatile', language: 'en' },
  { id: 'elli', name: 'Elli', gender: 'female', style: 'expressive, emotional', language: 'en' },
  { id: 'josh', name: 'Josh', gender: 'male', style: 'deep, authoritative', language: 'en' },
  { id: 'rachel', name: 'Rachel', gender: 'female', style: 'soft, soothing', language: 'en' },
  { id: 'sam', name: 'Sam', gender: 'male', style: 'crisp, professional', language: 'en' },
];

function generateId(prefix = 'el') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Generate a music track from prompt
 * @param {Object} params - {prompt, genre, mood, bpm, key, duration}
 * @returns {Object} - {id, status, estimatedTime}
 */
export function generateTrack(params = {}) {
  const { prompt = '', genre = 'electronic', mood = 'energetic', bpm = 120, key = 'C major', duration = 60 } = params;
  const jobId = generateId('track');
  const estimatedTime = Math.ceil(duration / 4) * 1000; // rough estimate in ms

  return {
    id: jobId,
    status: 'queued',
    estimatedTime,
    params: { prompt, genre, mood, bpm, key, duration },
    createdAt: new Date().toISOString(),
  };
}

/**
 * Check generation job status
 * @param {string} jobId
 * @returns {Object} - Status with progress
 */
export function checkStatus(jobId) {
  if (!jobId) {
    return { error: 'Missing jobId', status: 'invalid' };
  }

  const rand = Math.random();
  const progress = rand > 0.7 ? 100 : Math.floor(rand * 100);
  const status = progress === 100 ? 'completed' : progress > 50 ? 'processing' : 'queued';

  return {
    id: jobId,
    status,
    progress,
    message: status === 'completed'
      ? 'Track generation complete'
      : status === 'processing'
        ? 'Synthesizing audio...'
        : 'Job queued for processing',
    resultUrl: status === 'completed' ? `https://cdn.elevenlabs.io/tracks/${jobId}.mp3` : null,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Get available AI voices
 * @returns {Array}
 */
export function getVoices() {
  return VOICES;
}

/**
 * Synthesize vocal from text
 * @param {string} text
 * @param {string} voiceId
 * @param {string} style
 * @returns {Object} - Mock vocal job
 */
export function synthesizeVocal(text, voiceId = 'bella', style = 'neutral') {
  const jobId = generateId('vocal');
  const voice = VOICES.find((v) => v.id === voiceId) || VOICES[0];
  const estimatedTime = 3000 + text.length * 20;

  return {
    id: jobId,
    status: 'queued',
    estimatedTime,
    voice: { id: voice.id, name: voice.name },
    style,
    textLength: text.length,
    createdAt: new Date().toISOString(),
  };
}
