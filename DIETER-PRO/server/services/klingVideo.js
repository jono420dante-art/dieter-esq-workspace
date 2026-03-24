/**
 * Kling Video API Service
 * Mock backend for DIETER PRO video generation
 * In production, integrates with Kling Video API
 */

const TEMPLATES = [
  { id: 't1', name: 'Cinematic Action', category: 'Action', duration: 10, aspectRatio: '16:9' },
  { id: 't2', name: 'Nature Documentary', category: 'Documentary', duration: 15, aspectRatio: '16:9' },
  { id: 't3', name: 'Product Showcase', category: 'Commercial', duration: 8, aspectRatio: '1:1' },
  { id: 't4', name: 'Music Visualizer', category: 'Music', duration: 30, aspectRatio: '9:16' },
  { id: 't5', name: 'Vintage Film Look', category: 'Nostalgic', duration: 10, aspectRatio: '4:3' },
  { id: 't6', name: 'Sci-Fi Cityscape', category: 'Sci-Fi', duration: 12, aspectRatio: '16:9' },
  { id: 't7', name: 'Fashion Runway', category: 'Fashion', duration: 15, aspectRatio: '9:16' },
  { id: 't8', name: 'Abstract Fluid', category: 'Abstract', duration: 20, aspectRatio: '1:1' },
  { id: 't9', name: 'Horror Atmosphere', category: 'Horror', duration: 10, aspectRatio: '16:9' },
  { id: 't10', name: 'Comedy Sketch', category: 'Comedy', duration: 15, aspectRatio: '16:9' },
  { id: 't11', name: 'Minimal Motion', category: 'Minimal', duration: 5, aspectRatio: '1:1' },
  { id: 't12', name: 'Underwater Fantasy', category: 'Fantasy', duration: 12, aspectRatio: '16:9' },
  { id: 't13', name: 'Retro TV Intro', category: 'Retro', duration: 8, aspectRatio: '4:3' },
  { id: 't14', name: 'Architectural Flythrough', category: 'Architecture', duration: 15, aspectRatio: '16:9' },
  { id: 't15', name: 'Pixel Art Animation', category: 'Gaming', duration: 10, aspectRatio: '16:9' },
  { id: 't16', name: 'Dreamy Landscape', category: 'Nature', duration: 20, aspectRatio: '21:9' },
  { id: 't17', name: 'Neon Cyberpunk', category: 'Cyberpunk', duration: 12, aspectRatio: '16:9' },
  { id: 't18', name: 'Moody Portrait', category: 'Portrait', duration: 8, aspectRatio: '1:1' },
  { id: 't19', name: 'Sports Highlight', category: 'Sports', duration: 10, aspectRatio: '16:9' },
  { id: 't20', name: 'Cooking Close-Up', category: 'Food', duration: 15, aspectRatio: '1:1' },
  { id: 't21', name: 'Timelapse Sunrise', category: 'Timelapse', duration: 30, aspectRatio: '16:9' },
  { id: 't22', name: 'Papercraft World', category: 'Creative', duration: 12, aspectRatio: '16:9' },
];

const EFFECTS = [
  'vintage', 'vhs', 'glitch', 'chromatic', 'bloom', 'film-grain', 'letterbox',
  'vignette', 'split-tone', 'neon-glow', 'pixelate', 'motion-blur',
];

function generateId(prefix = 'kl') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Generate video from prompt
 * @param {Object} params - {prompt, duration, style, aspectRatio}
 * @returns {Object} - Mock job
 */
export function generateVideo(params = {}) {
  const { prompt = '', duration = 10, style = 'cinematic', aspectRatio = '16:9' } = params;
  const jobId = generateId('vid');

  return {
    id: jobId,
    status: 'queued',
    estimatedTime: 60000 + duration * 3000,
    params: { prompt, duration, style, aspectRatio },
    createdAt: new Date().toISOString(),
  };
}

/**
 * Check video generation progress
 * @param {string} jobId
 * @returns {Object} - Mock progress
 */
export function checkProgress(jobId) {
  if (!jobId) return { error: 'Missing jobId' };

  const rand = Math.random();
  const progress = rand > 0.75 ? 100 : Math.floor(rand * 100);
  const status = progress === 100 ? 'completed' : progress > 30 ? 'rendering' : 'queued';

  return {
    id: jobId,
    status,
    progress,
    stage: status === 'completed' ? 'done' : status === 'rendering' ? 'generating' : 'queued',
    resultUrl: progress === 100 ? `https://cdn.kling.ai/videos/${jobId}.mp4` : null,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Apply visual effect to video
 * @param {string} videoId
 * @param {string} effect
 * @returns {Object} - Mock effect job
 */
export function applyEffect(videoId, effect) {
  if (!videoId) return { error: 'Missing videoId' };

  const effectId = generateId('fx');
  const validEffect = EFFECTS.includes(effect) ? effect : EFFECTS[0];

  return {
    id: effectId,
    videoId,
    effect: validEffect,
    status: 'queued',
    estimatedTime: 45000,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Get available video templates
 * @returns {Array} - 20+ templates
 */
export function getTemplates() {
  return TEMPLATES;
}
