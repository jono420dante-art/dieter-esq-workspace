import { createContext, useContext, useReducer, useCallback, useRef } from 'react';
import { useAudioEngine } from './AudioEngineContext';

const GranularContext = createContext(null);

const PRESETS = generatePresets();

function generatePresets() {
  const categories = {
    'Pads': 40,
    'Textures': 35,
    'Atmospheres': 30,
    'Drones': 25,
    'Leads': 25,
    'Bass': 20,
    'Percussion': 20,
    'Vocals': 15,
    'Nature': 15,
    'Cinematic': 15,
    'Glitch': 10,
  };
  const presets = [];
  let id = 0;
  const padNames = ['Silk Clouds', 'Velvet Drift', 'Cosmic Wash', 'Frozen Lake', 'Amber Glow', 'Neon Rain', 'Deep Space', 'Solar Wind', 'Crystal Cave', 'Moonrise', 'Dream State', 'Stardust', 'Aurora', 'Nebula Haze', 'Twilight Zone', 'Phantom Mist', 'Soft Machine', 'Warm Blanket', 'Infinite Hall', 'Ghost Choir', 'Shimmer Glass', 'Slow Motion', 'Cloud Nine', 'Whale Song', 'Midnight Oil', 'Snow Globe', 'Gentle Storm', 'Pastel Sky', 'Fade Away', 'Silk Road', 'Blue Lagoon', 'Sahara Breeze', 'Quantum Field', 'Time Lapse', 'Emerald Forest', 'Gold Dust', 'Ice Palace', 'Spirit Guide', 'Inner Peace', 'Zero Gravity'];
  const textureNames = ['Grain Storm', 'Rust Bucket', 'Broken Glass', 'Sand Dune', 'Static Field', 'Paper Thin', 'Metallic Sheen', 'Wood Grain', 'Fabric Tear', 'Wire Mesh', 'Gravel Path', 'Bubble Wrap', 'Chalk Dust', 'Carbon Fiber', 'Vinyl Crackle', 'Tape Hiss', 'Radio Static', 'Pixel Rain', 'Binary Flow', 'Circuit Bend', 'Quantum Noise', 'Plasma Arc', 'Fractal Dust', 'Data Stream', 'Bit Crush', 'Lo-Fi Dreams', 'Warm Tape', 'Cold Steel', 'Dark Matter', 'White Noise', 'Pink Noise', 'Brown Noise', 'Blue Noise', 'Grey Noise', 'Spectral Dust'];
  const atmosNames = ['Deep Forest', 'Ocean Floor', 'Mountain Peak', 'City Rain', 'Desert Night', 'Arctic Wind', 'Jungle Mist', 'Cave Echo', 'River Flow', 'Thunder Roll', 'Wind Chimes', 'Campfire', 'Waterfall', 'Bird Dawn', 'Cricket Night', 'Storm Front', 'Fog Horn', 'Ship Deck', 'Train Station', 'Airport Hall', 'Cathedral', 'Elevator', 'Parking Lot', 'Subway', 'Cafe Corner', 'Library', 'Museum Hall', 'Factory Floor', 'Construction', 'Market Day'];
  const allNames = { 'Pads': padNames, 'Textures': textureNames, 'Atmospheres': atmosNames };

  for (const [cat, count] of Object.entries(categories)) {
    const names = allNames[cat] || [];
    for (let i = 0; i < count; i++) {
      presets.push({
        id: id++,
        name: names[i] || `${cat} ${i + 1}`,
        category: cat,
        grainSize: 20 + Math.random() * 480,
        density: 1 + Math.random() * 49,
        pitch: -12 + Math.random() * 24,
        position: Math.random(),
        spread: Math.random(),
        attack: Math.random() * 0.5,
        release: Math.random() * 0.5,
        pan: (Math.random() - 0.5) * 2,
        reverb: Math.random() * 0.8,
        delay: Math.random() * 0.5,
        filter: 200 + Math.random() * 18000,
        filterQ: 0.1 + Math.random() * 15,
      });
    }
  }
  return presets;
}

const initialState = {
  grainSize: 100,
  density: 10,
  pitch: 0,
  position: 0.5,
  spread: 0.3,
  attack: 0.1,
  release: 0.2,
  pan: 0,
  sourceBuffer: null,
  sourceName: '',
  isPlaying: false,
  activePreset: null,
  fx: {
    reverb: 0.3,
    delay: 0.2,
    delayTime: 0.25,
    delayFeedback: 0.4,
    chorus: 0,
    distortion: 0,
    filter: 20000,
    filterQ: 1,
    filterType: 'lowpass',
  },
  xyX: 0.5,
  xyY: 0.5,
  presets: PRESETS,
  presetSearch: '',
  presetCategory: 'All',
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_PARAM': return { ...state, [action.key]: action.value };
    case 'SET_FX': return { ...state, fx: { ...state.fx, [action.key]: action.value } };
    case 'SET_SOURCE': return { ...state, sourceBuffer: action.buffer, sourceName: action.name };
    case 'SET_PLAYING': return { ...state, isPlaying: action.value };
    case 'LOAD_PRESET': {
      const p = action.preset;
      return {
        ...state,
        grainSize: p.grainSize,
        density: p.density,
        pitch: p.pitch,
        position: p.position,
        spread: p.spread,
        attack: p.attack,
        release: p.release,
        pan: p.pan,
        activePreset: p.id,
        fx: { ...state.fx, reverb: p.reverb, delay: p.delay, filter: p.filter, filterQ: p.filterQ },
      };
    }
    case 'SET_XY': return { ...state, xyX: action.x, xyY: action.y };
    case 'SET_SEARCH': return { ...state, presetSearch: action.value };
    case 'SET_CATEGORY': return { ...state, presetCategory: action.value };
    default: return state;
  }
}

export function GranularProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const grainNodesRef = useRef([]);
  const schedulerRef = useRef(null);

  const setParam = useCallback((key, value) => dispatch({ type: 'SET_PARAM', key, value }), []);
  const setFx = useCallback((key, value) => dispatch({ type: 'SET_FX', key, value }), []);
  const setSource = useCallback((buffer, name) => dispatch({ type: 'SET_SOURCE', buffer, name }), []);
  const loadPreset = useCallback((preset) => dispatch({ type: 'LOAD_PRESET', preset }), []);
  const setXY = useCallback((x, y) => dispatch({ type: 'SET_XY', x, y }), []);
  const setSearch = useCallback((v) => dispatch({ type: 'SET_SEARCH', value: v }), []);
  const setCategory = useCallback((v) => dispatch({ type: 'SET_CATEGORY', value: v }), []);

  const filteredPresets = state.presets.filter((p) => {
    if (state.presetCategory !== 'All' && p.category !== state.presetCategory) return false;
    if (state.presetSearch && !p.name.toLowerCase().includes(state.presetSearch.toLowerCase())) return false;
    return true;
  });

  return (
    <GranularContext.Provider
      value={{
        ...state,
        dispatch,
        setParam,
        setFx,
        setSource,
        loadPreset,
        setXY,
        setSearch,
        setCategory,
        filteredPresets,
        grainNodesRef,
        schedulerRef,
      }}
    >
      {children}
    </GranularContext.Provider>
  );
}

export function useGranular() {
  const ctx = useContext(GranularContext);
  if (!ctx) throw new Error('useGranular must be inside GranularProvider');
  return ctx;
}
