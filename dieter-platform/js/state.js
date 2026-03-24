/* State Management — Reactive store with localStorage persistence */

const STORAGE_KEY = 'dieter-platform-state';

const defaultState = {
  currentPage: 'home',
  selectedVoice: 'nova',
  library: [
    { id: 't1', title: 'Neon Drive Anthem', genre: 'Synthwave', bpm: 128, key: 'Em', duration: '3:24', fav: true, ts: Date.now() - 86400000, source: 'generated' },
    { id: 't2', title: 'Midnight Afrobeat', genre: 'Afrobeat', bpm: 105, key: 'Gm', duration: '2:58', fav: false, ts: Date.now() - 172800000, source: 'generated' },
    { id: 't3', title: 'Cloud Drift Lo-fi', genre: 'Lo-fi', bpm: 85, key: 'Cm', duration: '4:12', fav: true, ts: Date.now() - 43200000, source: 'lyrics' },
    { id: 't4', title: 'Trap House Bounce', genre: 'Trap', bpm: 140, key: 'Am', duration: '3:01', fav: false, ts: Date.now() - 259200000, source: 'generated' },
    { id: 't5', title: 'Deep House Journey', genre: 'House', bpm: 124, key: 'Fm', duration: '5:40', fav: true, ts: Date.now() - 3600000, source: 'import' },
  ],
  songs: [],
  selectedPortals: ['spotify', 'apple', 'youtube', 'napster'],
  distHistory: [],
  soldiers: {},
  systemLog: [],
};

let state;
const listeners = new Map();

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...defaultState, ...parsed, soldiers: {}, systemLog: [] };
    }
  } catch { /* corrupt storage */ }
  return { ...defaultState };
}

function saveState() {
  try {
    const toSave = { ...state, soldiers: undefined, systemLog: undefined };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch { /* quota exceeded */ }
}

export function getState() { return state; }

export function get(key) { return state[key]; }

export function set(key, value) {
  const old = state[key];
  state[key] = value;
  saveState();
  const subs = listeners.get(key) || [];
  subs.forEach(fn => { try { fn(value, old); } catch (e) { console.error('[State]', key, e); } });
  const allSubs = listeners.get('*') || [];
  allSubs.forEach(fn => { try { fn(key, value, old); } catch (e) { console.error('[State] *', e); } });
}

export function update(key, fn) {
  set(key, fn(state[key]));
}

export function subscribe(key, fn) {
  if (!listeners.has(key)) listeners.set(key, []);
  listeners.get(key).push(fn);
  return () => {
    const arr = listeners.get(key);
    const idx = arr.indexOf(fn);
    if (idx > -1) arr.splice(idx, 1);
  };
}

state = loadState();

export function addToLibrary(track) {
  update('library', lib => [track, ...lib]);
}

export function toggleFav(id) {
  update('library', lib => lib.map(t => t.id === id ? { ...t, fav: !t.fav } : t));
}

export function addSong(song) {
  update('songs', songs => [song, ...songs]);
}

export function addDistribution(entry) {
  update('distHistory', h => [entry, ...h]);
}

export function log(system, msg, level = 'ok') {
  update('systemLog', logs => [
    { ts: Date.now(), system, msg, level },
    ...logs.slice(0, 200)
  ]);
}
