import { createContext, useContext, useReducer, useCallback } from 'react';

const StudioContext = createContext(null);

const initialState = {
  projects: [],
  activeProject: null,
  tracks: [],
  selectedTrack: null,
  bpm: 120,
  key: 'C',
  scale: 'minor',
  isGenerating: false,
  generationQueue: [],
  voices: [
    { id: 'aria', name: 'Aria', style: 'Pop', gender: 'F' },
    { id: 'storm', name: 'Storm', style: 'Rap', gender: 'M' },
    { id: 'luna', name: 'Luna', style: 'R&B', gender: 'F' },
    { id: 'blaze', name: 'Blaze', style: 'Rock', gender: 'M' },
    { id: 'echo', name: 'Echo', style: 'Electronic', gender: 'N' },
    { id: 'nova', name: 'Nova', style: 'Jazz', gender: 'F' },
  ],
  selectedVoice: 'aria',
  genres: ['Pop', 'Hip Hop', 'R&B', 'Rock', 'Electronic', 'Jazz', 'Classical', 'Afrobeat', 'Latin', 'Country', 'Metal', 'Lo-Fi'],
  selectedGenre: 'Pop',
  moods: ['Energetic', 'Chill', 'Dark', 'Happy', 'Melancholic', 'Aggressive', 'Dreamy', 'Uplifting'],
  selectedMood: 'Energetic',
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_BPM': return { ...state, bpm: action.payload };
    case 'SET_KEY': return { ...state, key: action.payload };
    case 'SET_SCALE': return { ...state, scale: action.payload };
    case 'SET_VOICE': return { ...state, selectedVoice: action.payload };
    case 'SET_GENRE': return { ...state, selectedGenre: action.payload };
    case 'SET_MOOD': return { ...state, selectedMood: action.payload };
    case 'SET_GENERATING': return { ...state, isGenerating: action.payload };
    case 'ADD_TRACK': return { ...state, tracks: [...state.tracks, action.payload] };
    case 'REMOVE_TRACK': return { ...state, tracks: state.tracks.filter((t) => t.id !== action.payload) };
    case 'SELECT_TRACK': return { ...state, selectedTrack: action.payload };
    case 'SET_PROJECT': return { ...state, activeProject: action.payload };
    case 'ADD_PROJECT': return { ...state, projects: [...state.projects, action.payload] };
    default: return state;
  }
}

export function StudioProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const setBpm = useCallback((v) => dispatch({ type: 'SET_BPM', payload: v }), []);
  const setKey = useCallback((v) => dispatch({ type: 'SET_KEY', payload: v }), []);
  const setScale = useCallback((v) => dispatch({ type: 'SET_SCALE', payload: v }), []);
  const setVoice = useCallback((v) => dispatch({ type: 'SET_VOICE', payload: v }), []);
  const setGenre = useCallback((v) => dispatch({ type: 'SET_GENRE', payload: v }), []);
  const setMood = useCallback((v) => dispatch({ type: 'SET_MOOD', payload: v }), []);
  const setGenerating = useCallback((v) => dispatch({ type: 'SET_GENERATING', payload: v }), []);
  const addTrack = useCallback((t) => dispatch({ type: 'ADD_TRACK', payload: t }), []);
  const removeTrack = useCallback((id) => dispatch({ type: 'REMOVE_TRACK', payload: id }), []);
  const selectTrack = useCallback((id) => dispatch({ type: 'SELECT_TRACK', payload: id }), []);

  return (
    <StudioContext.Provider
      value={{ ...state, setBpm, setKey, setScale, setVoice, setGenre, setMood, setGenerating, addTrack, removeTrack, selectTrack, dispatch }}
    >
      {children}
    </StudioContext.Provider>
  );
}

export function useStudio() {
  const ctx = useContext(StudioContext);
  if (!ctx) throw new Error('useStudio must be inside StudioProvider');
  return ctx;
}
