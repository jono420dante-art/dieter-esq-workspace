import { createContext, useContext, useReducer, useCallback, useRef } from 'react';

const VideoContext = createContext(null);

const initialState = {
  videoFile: null,
  videoUrl: '',
  duration: 0,
  currentTime: 0,
  isPlaying: false,
  effects: [],
  beats: [],
  bpm: 0,
  aiStyle: 'particles',
  aiIntensity: 70,
  aiColorHue: 270,
  aiBeatReact: 80,
  isGenerating: false,
  isRecording: false,
  exportProgress: 0,
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_VIDEO': return { ...state, videoFile: action.file, videoUrl: action.url, duration: action.duration || 0 };
    case 'SET_TIME': return { ...state, currentTime: action.time };
    case 'SET_PLAYING': return { ...state, isPlaying: action.value };
    case 'SET_BEATS': return { ...state, beats: action.beats, bpm: action.bpm };
    case 'SET_EFFECTS': return { ...state, effects: action.effects };
    case 'ADD_EFFECT': return { ...state, effects: [...state.effects, action.effect] };
    case 'REMOVE_EFFECT': return { ...state, effects: state.effects.filter((_, i) => i !== action.index) };
    case 'SET_AI_STYLE': return { ...state, aiStyle: action.value };
    case 'SET_AI_PARAM': return { ...state, [action.key]: action.value };
    case 'SET_GENERATING': return { ...state, isGenerating: action.value };
    case 'SET_RECORDING': return { ...state, isRecording: action.value };
    case 'SET_EXPORT_PROGRESS': return { ...state, exportProgress: action.value };
    default: return state;
  }
}

export function VideoProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const canvasRef = useRef(null);
  const recorderRef = useRef(null);
  const animRef = useRef(null);

  const setVideo = useCallback((file, url, duration) => dispatch({ type: 'SET_VIDEO', file, url, duration }), []);
  const setBeats = useCallback((beats, bpm) => dispatch({ type: 'SET_BEATS', beats, bpm }), []);
  const setAiStyle = useCallback((v) => dispatch({ type: 'SET_AI_STYLE', value: v }), []);
  const setAiParam = useCallback((key, value) => dispatch({ type: 'SET_AI_PARAM', key, value }), []);

  return (
    <VideoContext.Provider
      value={{ ...state, dispatch, setVideo, setBeats, setAiStyle, setAiParam, canvasRef, recorderRef, animRef }}
    >
      {children}
    </VideoContext.Provider>
  );
}

export function useVideo() {
  const ctx = useContext(VideoContext);
  if (!ctx) throw new Error('useVideo must be inside VideoProvider');
  return ctx;
}
