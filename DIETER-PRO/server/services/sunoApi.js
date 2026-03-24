/**
 * Suno API Service
 * Mock backend for DIETER PRO song creation and remixing
 * In production, integrates with Suno API
 */

const STYLES = [
  'Pop', 'Rock', 'Hip-Hop', 'R&B', 'Country', 'Electronic', 'House', 'Techno',
  'Drum & Bass', 'Dubstep', 'Indie', 'Alternative', 'Folk', 'Jazz', 'Blues',
  'Classical', 'Ambient', 'Lo-Fi', 'Chillhop', 'Synthwave', 'Vaporwave',
  'Soul', 'Funk', 'Reggae', 'Metal', 'Punk', 'K-Pop', 'Latin', 'Tropical',
  'Trap', 'Future Bass', 'Progressive', 'Trance', 'Phonk', 'Drill',
];

function generateId(prefix = 'sun') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Create a new song
 * @param {Object} params - {lyrics, style, instrumental}
 * @returns {Object} - Mock job
 */
export function createSong(params = {}) {
  const { lyrics = '', style = 'Pop', instrumental = false } = params;
  const songId = generateId('song');

  return {
    id: songId,
    status: 'queued',
    estimatedTime: 120000, // ~2 min
    params: { lyrics, style, instrumental },
    createdAt: new Date().toISOString(),
  };
}

/**
 * Extend an existing song
 * @param {string} songId
 * @param {Object} params
 * @returns {Object} - Mock extend job
 */
export function extendSong(songId, params = {}) {
  if (!songId) return { error: 'Missing songId' };

  const extendId = generateId('ext');
  const { direction = 'outro', length = 30 } = params;

  return {
    id: extendId,
    parentSongId: songId,
    status: 'queued',
    estimatedTime: 90000,
    params: { direction, length },
    createdAt: new Date().toISOString(),
  };
}

/**
 * Get available music styles
 * @returns {Array} - List of 30+ styles
 */
export function getStyles() {
  return STYLES;
}

/**
 * Remix an existing song with new style
 * @param {string} songId
 * @param {string} style
 * @returns {Object} - Mock remix job
 */
export function remixSong(songId, style) {
  if (!songId) return { error: 'Missing songId' };

  const remixId = generateId('remix');

  return {
    id: remixId,
    sourceSongId: songId,
    status: 'queued',
    style: style || 'Lo-Fi',
    estimatedTime: 150000,
    createdAt: new Date().toISOString(),
  };
}
