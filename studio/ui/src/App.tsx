import { useState, useRef, useEffect, useCallback } from 'react';
import { api } from './api';

interface User {
  id: string;
  email: string;
  name: string;
}

interface Voice {
  id: string;
  name: string;
  lang: string;
  style: string;
  gender: string;
}

interface Project {
  id: string;
  name: string;
}

interface Track {
  id: string;
  status: string;
}

interface Suggestion {
  type: 'suggest' | 'trend' | 'tip' | 'analytics';
  title: string;
  text: string;
}

type Page = 'create' | 'mix' | 'video' | 'lyrics' | 'library' | 'trending' | 'analyze' | 'portals';
type Mode = 'easy' | 'custom' | 'v8';

const GENRES = ['Synthwave', 'House', 'Afrobeat', 'Trap', 'Lo-fi', 'Drill', 'R&B', 'Pop', 'Techno'];
const STYLES = ['Neon Drive', 'Cloud Riser', 'Arena Hook'];
const MOODS: { icon: string; label: string }[] = [
  { icon: '\u25CF', label: 'Dark' },
  { icon: '\u25B2', label: 'Uplifting' },
  { icon: '\u2606', label: 'Dreamy' },
  { icon: '\u26A1', label: 'Hype' },
  { icon: '\u2764', label: 'Romantic' },
  { icon: '\u2620', label: 'Gritty' },
];
const GENDERS = ['Female', 'Male', 'Duet', 'None'];
const CHANNEL_NAMES = ['Drums', 'Bass', 'Music', 'Vocal', 'FX'] as const;
type ChannelName = (typeof CHANNEL_NAMES)[number];
const DURATION = 60;

const oscConfigs: Record<ChannelName, { type: OscillatorType; freq: number; detune: number; gain: number }> = {
  Drums:  { type: 'square',   freq: 55,  detune: 0,  gain: 0.28 },
  Bass:   { type: 'sawtooth', freq: 82,  detune: -5, gain: 0.35 },
  Music:  { type: 'triangle', freq: 220, detune: 7,  gain: 0.18 },
  Vocal:  { type: 'sine',     freq: 440, detune: 0,  gain: 0.22 },
  FX:     { type: 'sawtooth', freq: 660, detune: 12, gain: 0.10 },
};

const DEFAULT_VOICES: Voice[] = [
  { id: 'nova', name: 'Nova', lang: 'EN', style: 'Airy Pop', gender: 'Female' },
  { id: 'kira', name: 'Kira', lang: 'EN', style: 'Soulful RnB', gender: 'Female' },
  { id: 'aris', name: 'Aris', lang: 'EN / KR', style: 'Cinematic', gender: 'Female' },
  { id: 'juno', name: 'Juno', lang: 'EN', style: 'EDM Lead', gender: 'Male' },
];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authError, setAuthError] = useState('');

  const [page, setPage] = useState<Page>('create');
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [voices, setVoices] = useState<Voice[]>(DEFAULT_VOICES);
  const [selectedVoice, setSelectedVoice] = useState<string>('nova');
  const [selectedGenres, setSelectedGenres] = useState<Set<string>>(new Set(['Synthwave']));
  const [selectedStyles, setSelectedStyles] = useState<Set<string>>(new Set(['Neon Drive']));
  const [selectedMoods, setSelectedMoods] = useState<Set<string>>(new Set(['Dark']));
  const [selectedGender, setSelectedGender] = useState('Female');
  const [prompt, setPrompt] = useState('Dark synthwave anthem, cinematic drops, emotional female vocals, pulsing bass.');
  const [bpm, setBpm] = useState(128);
  const [musicKey, setMusicKey] = useState('Em');
  const [duration, setDuration] = useState('60 s');
  const [structure, setStructure] = useState('Verse-Chorus');
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('Ready to create.');
  const [statusErr, setStatusErr] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([
    { type: 'suggest', title: 'Suggestion', text: 'Boost chorus energy +8 % at 01:12 for maximum hook lift.' },
    { type: 'trend', title: 'Trend', text: 'Afro-house vocal chops are peaking this week.' },
    { type: 'tip', title: 'Tip', text: 'Layer a noise riser before the final drop for extra lift.' },
    { type: 'analytics', title: 'Analytics', text: 'Hook retention estimate: 82 %. Energy curve: rising.' },
  ]);
  const [mode, setMode] = useState<Mode>('easy');
  const [creationTab, setCreationTab] = useState('Reference');
  const [vizLabel, setVizLabel] = useState('Idle');
  const [timeLabel, setTimeLabel] = useState('00:00 / 01:00');

  const [grain, setGrain] = useState(44);
  const [density, setDensity] = useState(58);

  const [mixerValues, setMixerValues] = useState<Record<ChannelName, number>>(
    () => Object.fromEntries(CHANNEL_NAMES.map(n => [n, 0])) as Record<ChannelName, number>
  );
  const [meterWidths, setMeterWidths] = useState<Record<ChannelName, number>>(
    () => Object.fromEntries(CHANNEL_NAMES.map(n => [n, 0])) as Record<ChannelName, number>
  );
  const [crossfader, setCrossfader] = useState(50);
  const [djEffects, setDjEffects] = useState<Record<string, boolean>>({
    lowcut: false, highcut: false, echo: false, stutter: false, filter: false,
  });
  const [masterDrive, setMasterDrive] = useState(20);
  const [masterWidth, setMasterWidth] = useState(70);
  const [masterLimit, setMasterLimit] = useState(82);

  const [videoAspect, setVideoAspect] = useState('16:9');
  const [videoStatus, setVideoStatus] = useState('');

  const [discAPaused, setDiscAPaused] = useState(true);
  const [discBPaused, setDiscBPaused] = useState(true);

  // --- LYRICS STATE ---
  const [lyrics, setLyrics] = useState('');
  const [lyricsVoice, setLyricsVoice] = useState('nova');
  const [lyricsBpm, setLyricsBpm] = useState(120);
  const [lyricsGenre, setLyricsGenre] = useState('Pop');
  const [lyricsGenerating, setLyricsGenerating] = useState(false);
  const [lyricsStatus, setLyricsStatus] = useState('');
  const [lyricsSongs, setLyricsSongs] = useState<{id:string;title:string;lyrics:string;voice:string;genre:string;bpm:number;ts:number}[]>([]);

  // --- LIBRARY STATE ---
  const [librarySearch, setLibrarySearch] = useState('');
  const [libraryFilter, setLibraryFilter] = useState('all');
  const [libraryTracks, setLibraryTracks] = useState<{id:string;title:string;genre:string;bpm:number;key:string;duration:string;fav:boolean;ts:number;source:string}[]>([
    {id:'t1',title:'Neon Drive Anthem',genre:'Synthwave',bpm:128,key:'Em',duration:'3:24',fav:true,ts:Date.now()-86400000,source:'generated'},
    {id:'t2',title:'Midnight Afrobeat',genre:'Afrobeat',bpm:105,key:'Gm',duration:'2:58',fav:false,ts:Date.now()-172800000,source:'generated'},
    {id:'t3',title:'Cloud Drift Lo-fi',genre:'Lo-fi',bpm:85,key:'Cm',duration:'4:12',fav:true,ts:Date.now()-43200000,source:'lyrics'},
    {id:'t4',title:'Trap House Bounce',genre:'Trap',bpm:140,key:'Am',duration:'3:01',fav:false,ts:Date.now()-259200000,source:'generated'},
    {id:'t5',title:'Deep House Journey',genre:'House',bpm:124,key:'Fm',duration:'5:40',fav:true,ts:Date.now()-3600000,source:'import'},
    {id:'t6',title:'R&B Slow Burn',genre:'R&B',bpm:78,key:'Dm',duration:'3:55',fav:false,ts:Date.now()-7200000,source:'lyrics'},
  ]);

  // --- TRENDING STATE ---
  const [trendingData, setTrendingData] = useState<{rank:number;title:string;artist:string;genre:string;plays:string;change:string;hot:boolean}[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(false);
  const [trendingGenres, setTrendingGenres] = useState<{name:string;growth:number;score:number}[]>([]);
  const [trendingKeys, setTrendingKeys] = useState<string[]>([]);
  const [trendingBpmRange, setTrendingBpmRange] = useState({min:0,max:0,sweet:0});

  // --- ANALYZE STATE ---
  const [analyzeBuffer, setAnalyzeBuffer] = useState<AudioBuffer | null>(null);
  const [analyzeName, setAnalyzeName] = useState('');
  const [analyzeBeats, setAnalyzeBeats] = useState<number[]>([]);
  const [analyzeBpm, setAnalyzeBpm] = useState(0);
  const [analyzeKey, setAnalyzeKey] = useState('');
  const [analyzeStatus, setAnalyzeStatus] = useState('Drop an audio file to analyze');
  const analyzeCanvasRef = useRef<HTMLCanvasElement>(null);
  const analyzeFileRef = useRef<HTMLInputElement>(null);

  // --- PORTALS STATE ---
  const [portalPlatforms, setPortalPlatforms] = useState<Record<string,boolean>>({
    spotify:true, apple:true, youtube:true, tidal:false, soundcloud:false, amazon:false, deezer:false, tiktok:false,
  });
  const [portalDistributing, setPortalDistributing] = useState(false);
  const [portalStatus, setPortalStatus] = useState('');
  const [portalHistory, setPortalHistory] = useState<{id:string;track:string;platforms:string[];ts:number;status:string}[]>([]);

  const actxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const masterCompRef = useRef<DynamicsCompressorNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const analyserDataRef = useRef<Uint8Array | null>(null);
  const channelGainsRef = useRef<Record<string, GainNode>>({});
  const oscRef = useRef<Record<string, OscillatorNode>>({});
  const filtersRef = useRef<Record<string, BiquadFilterNode>>({});
  const delayRef = useRef<DelayNode | null>(null);
  const delayGainRef = useRef<GainNode | null>(null);
  const isPlayingRef = useRef(false);
  const startTimeRef = useRef(0);
  const elapsedRef = useRef(0);
  const playheadRef = useRef(0);
  const stutterIVRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const starsCanvasRef = useRef<HTMLCanvasElement>(null);
  const vizCanvasRef = useRef<HTMLCanvasElement>(null);
  const timelineCanvasRef = useRef<HTMLCanvasElement>(null);
  const xyCanvasRef = useRef<HTMLCanvasElement>(null);
  const puckRef = useRef({ x: 0.5, y: 0.5 });
  const animTRef = useRef(0);
  const dragTLRef = useRef(false);
  const dragXYRef = useRef(false);

  const ensureAudioContext = useCallback(() => {
    if (actxRef.current) return;
    const actx = new AudioContext();
    actxRef.current = actx;

    const masterComp = actx.createDynamicsCompressor();
    masterComp.threshold.value = -6;
    masterComp.knee.value = 6;
    masterComp.ratio.value = 12;
    masterComp.attack.value = 0.003;
    masterComp.release.value = 0.1;
    masterComp.connect(actx.destination);
    masterCompRef.current = masterComp;

    const masterGain = actx.createGain();
    masterGain.gain.value = 0.8;
    masterGain.connect(masterComp);
    masterGainRef.current = masterGain;

    const analyser = actx.createAnalyser();
    analyser.fftSize = 2048;
    analyserRef.current = analyser;
    analyserDataRef.current = new Uint8Array(analyser.frequencyBinCount);
    masterGain.connect(analyser);

    const delay = actx.createDelay(0.5);
    delay.delayTime.value = 0.32;
    delayRef.current = delay;
    const dGain = actx.createGain();
    dGain.gain.value = 0;
    delay.connect(dGain);
    dGain.connect(masterGain);
    delayGainRef.current = dGain;

    const xyFilter = actx.createBiquadFilter();
    xyFilter.type = 'lowpass';
    xyFilter.frequency.value = 8000;
    xyFilter.Q.value = 1;
    filtersRef.current.xyFilter = xyFilter;

    const lowcut = actx.createBiquadFilter();
    lowcut.type = 'highpass';
    lowcut.frequency.value = 20;
    filtersRef.current.lowcut = lowcut;

    const highcut = actx.createBiquadFilter();
    highcut.type = 'lowpass';
    highcut.frequency.value = 20000;
    filtersRef.current.highcut = highcut;

    xyFilter.connect(lowcut);
    lowcut.connect(highcut);
    highcut.connect(masterGain);

    for (const name of CHANNEL_NAMES) {
      const g = actx.createGain();
      g.gain.value = oscConfigs[name].gain;
      g.connect(xyFilter);
      g.connect(delay);
      channelGainsRef.current[name] = g;
    }
  }, []);

  const stopOscillators = useCallback(() => {
    Object.values(oscRef.current).forEach(o => { try { o.stop(); } catch (_) { /* already stopped */ } });
    oscRef.current = {};
  }, []);

  const buildOscillators = useCallback(() => {
    stopOscillators();
    const actx = actxRef.current;
    if (!actx) return;

    for (const name of CHANNEL_NAMES) {
      const cfg = oscConfigs[name];
      const o = actx.createOscillator();
      o.type = cfg.type;
      o.frequency.value = cfg.freq;
      o.detune.value = cfg.detune;

      if (name === 'Drums') {
        const lfo = actx.createOscillator();
        lfo.frequency.value = (bpm / 60) * 2;
        const lfoG = actx.createGain();
        lfoG.gain.value = cfg.gain * 0.6;
        lfo.connect(lfoG);
        lfoG.connect(channelGainsRef.current[name].gain);
        lfo.start();
        oscRef.current[name + '_lfo'] = lfo;
      }

      o.connect(channelGainsRef.current[name]);
      o.start();
      oscRef.current[name] = o;
    }
  }, [bpm, stopOscillators]);

  const play = useCallback(() => {
    ensureAudioContext();
    const actx = actxRef.current!;
    if (actx.state === 'suspended') actx.resume();
    if (!isPlayingRef.current) {
      buildOscillators();
      isPlayingRef.current = true;
      startTimeRef.current = actx.currentTime - elapsedRef.current;
      setVizLabel('Playing');
      setDiscAPaused(false);
      setDiscBPaused(false);
    }
  }, [ensureAudioContext, buildOscillators]);

  const pause = useCallback(() => {
    if (isPlayingRef.current) {
      const actx = actxRef.current!;
      elapsedRef.current = actx.currentTime - startTimeRef.current;
      stopOscillators();
      isPlayingRef.current = false;
      setVizLabel('Paused');
      setDiscAPaused(true);
      setDiscBPaused(true);
    }
  }, [stopOscillators]);

  const stop = useCallback(() => {
    stopOscillators();
    isPlayingRef.current = false;
    elapsedRef.current = 0;
    playheadRef.current = 0;
    setVizLabel('Stopped');
    setDiscAPaused(true);
    setDiscBPaused(true);
  }, [stopOscillators]);

  const handleAuth = async () => {
    setAuthError('');
    try {
      if (authMode === 'register') {
        await api.register(authEmail, authPassword, authName);
      }
      const data = await api.login(authEmail, authPassword);
      localStorage.setItem('token', data.token);
      const me = await api.me();
      setUser(me);
    } catch (e: any) {
      setAuthError(e.message || 'Auth failed');
    }
  };

  useEffect(() => {
    setUser({ id: 'unlimited', email: 'eduardgeerdes@gmail.com', name: 'Dieter' });
  }, []);

  useEffect(() => {
    if (!user) return;
    setVoices(DEFAULT_VOICES);
  }, [user]);

  // Star background
  useEffect(() => {
    const canvas = starsCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let stars: { x: number; y: number; r: number; a: number; v: number }[] = [];
    let raf = 0;
    let mounted = true;

    function resize() {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      stars = Array.from({ length: 180 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.6 + 0.2,
        a: Math.random(),
        v: Math.random() * 0.012 + 0.003,
      }));
    }

    function draw() {
      if (!mounted || !canvas) return;
      try {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (const s of stars) {
          s.a += s.v;
          if (s.a > 1 || s.a < 0.1) s.v *= -1;
          ctx.beginPath();
          ctx.fillStyle = `rgba(168,85,247,${s.a.toFixed(2)})`;
          ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
          ctx.fill();
        }
      } catch {}
      raf = requestAnimationFrame(draw);
    }

    resize();
    draw();
    window.addEventListener('resize', resize);
    return () => { mounted = false; window.removeEventListener('resize', resize); cancelAnimationFrame(raf); };
  }, [user]);

  // Visualizer
  useEffect(() => {
    if (!user) return;
    const canvas = vizCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    let mounted = true;

    function sizeCanvas() {
      if (!canvas) return;
      try {
        const r = canvas.getBoundingClientRect();
        canvas.width = Math.max(1, Math.floor(r.width * devicePixelRatio));
        canvas.height = Math.max(1, Math.floor(r.height * devicePixelRatio));
        ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      } catch {}
    }
    sizeCanvas();

    function drawViz() {
      if (!mounted || !canvas) return;
      try {
        const w = canvas.getBoundingClientRect().width;
        const h = canvas.getBoundingClientRect().height;
        ctx.clearRect(0, 0, w, h);

        if (analyserRef.current && isPlayingRef.current && analyserDataRef.current) {
          analyserRef.current.getByteTimeDomainData(analyserDataRef.current);
          const sliceW = w / analyserDataRef.current.length;
          ctx.strokeStyle = '#a855f7';
          ctx.lineWidth = 2;
          ctx.beginPath();
          for (let i = 0; i < analyserDataRef.current.length; i++) {
            const v = analyserDataRef.current[i] / 128.0;
            const y = (v * h) / 2;
            if (i === 0) ctx.moveTo(0, y); else ctx.lineTo(i * sliceW, y);
          }
          ctx.stroke();

          const freqData = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(freqData);
          const barW = w / 64;
          ctx.globalAlpha = 0.35;
          for (let i = 0; i < 64; i++) {
            const barH = (freqData[i * 4] / 255) * h;
            ctx.fillStyle = `hsl(${200 + i * 2},80%,60%)`;
            ctx.fillRect(i * barW, h - barH, barW - 1, barH);
          }
          ctx.globalAlpha = 1;
        } else {
          ctx.strokeStyle = 'rgba(168,85,247,.5)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          for (let x = 0; x < w; x += 3) {
            const y = h / 2 + Math.sin((x + animTRef.current) * 0.035) * 10 + Math.sin((x + animTRef.current) * 0.012) * 6;
            if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
        animTRef.current += 3;
      } catch {}
      raf = requestAnimationFrame(drawViz);
    }
    drawViz();

    const onResize = () => sizeCanvas();
    window.addEventListener('resize', onResize);
    return () => { mounted = false; window.removeEventListener('resize', onResize); cancelAnimationFrame(raf); };
  }, [user]);

  // Timeline
  useEffect(() => {
    if (!user) return;
    const canvas = timelineCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    let mounted = true;

    function sizeCanvas() {
      if (!canvas) return;
      try {
        const r = canvas.getBoundingClientRect();
        canvas.width = Math.max(1, Math.floor(r.width * devicePixelRatio));
        canvas.height = Math.max(1, Math.floor(r.height * devicePixelRatio));
        ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      } catch {}
    }
    sizeCanvas();

    function drawTimeline() {
      if (!mounted || !canvas) return;
      try {
        const w = canvas.getBoundingClientRect().width;
        const h = canvas.getBoundingClientRect().height;
        ctx.clearRect(0, 0, w, h);

        if (analyserRef.current && isPlayingRef.current) {
          const fd = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(fd);
          ctx.strokeStyle = 'rgba(56,189,248,.6)';
          for (let x = 0; x < w; x += 6) {
            const idx = Math.floor((x / w) * fd.length);
            const barH = (fd[idx] / 255) * (h - 10) + 4;
            ctx.beginPath();
            ctx.moveTo(x, h / 2 - barH / 2);
            ctx.lineTo(x, h / 2 + barH / 2);
            ctx.stroke();
          }
        } else {
          ctx.strokeStyle = 'rgba(56,189,248,.3)';
          for (let x = 0; x < w; x += 7) {
            const barH = (Math.sin((x + animTRef.current) * 0.05) * 0.5 + 0.5) * (h - 16) + 4;
            ctx.beginPath();
            ctx.moveTo(x, h / 2 - barH / 2);
            ctx.lineTo(x, h / 2 + barH / 2);
            ctx.stroke();
          }
        }

        if (isPlayingRef.current && actxRef.current) {
          elapsedRef.current = actxRef.current.currentTime - startTimeRef.current;
          playheadRef.current = Math.min(1, elapsedRef.current / DURATION);
          if (elapsedRef.current >= DURATION) stop();
        }

        ctx.fillStyle = '#f97316';
        ctx.fillRect(playheadRef.current * w - 1, 0, 2, h);

        const sec = Math.floor(playheadRef.current * DURATION);
        const mm = String(Math.floor(sec / 60)).padStart(2, '0');
        const ss = String(sec % 60).padStart(2, '0');
        setTimeLabel(`${mm}:${ss} / 01:00`);
      } catch {}
      raf = requestAnimationFrame(drawTimeline);
    }
    drawTimeline();

    const onResize = () => sizeCanvas();
    window.addEventListener('resize', onResize);
    return () => { mounted = false; window.removeEventListener('resize', onResize); cancelAnimationFrame(raf); };
  }, [user, stop]);

  // Timeline drag
  useEffect(() => {
    const handleUp = () => { dragTLRef.current = false; };
    const handleMove = (e: PointerEvent) => {
      if (!dragTLRef.current) return;
      const canvas = timelineCanvasRef.current;
      if (!canvas) return;
      const r = canvas.getBoundingClientRect();
      const ph = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      playheadRef.current = ph;
      elapsedRef.current = ph * DURATION;
      if (isPlayingRef.current && actxRef.current) {
        startTimeRef.current = actxRef.current.currentTime - elapsedRef.current;
      }
    };
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointermove', handleMove);
    return () => { window.removeEventListener('pointerup', handleUp); window.removeEventListener('pointermove', handleMove); };
  }, []);

  // XY Pad draw
  const drawXY = useCallback(() => {
    try {
      const canvas = xyCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const w = canvas.getBoundingClientRect().width;
      const h = canvas.getBoundingClientRect().height;
      if (w < 1 || h < 1) return;
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(168,85,247,.3)';
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, w / 2 - 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(168,85,247,.15)';
      ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
      ctx.fillStyle = '#38bdf8';
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(puckRef.current.x * w, puckRef.current.y * h, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    } catch {}
  }, []);

  useEffect(() => {
    const canvas = xyCanvasRef.current;
    if (!canvas) return;
    function sizeXY() {
      try {
        if (!canvas) return;
        const r = canvas.getBoundingClientRect();
        canvas.width = Math.max(1, Math.floor(r.width * devicePixelRatio));
        canvas.height = Math.max(1, Math.floor(r.height * devicePixelRatio));
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
        drawXY();
      } catch {}
    }
    sizeXY();
    window.addEventListener('resize', sizeXY);
    return () => window.removeEventListener('resize', sizeXY);
  }, [user, drawXY]);

  // XY drag
  useEffect(() => {
    const handleUp = () => { dragXYRef.current = false; };
    const handleMove = (e: PointerEvent) => {
      if (!dragXYRef.current) return;
      const canvas = xyCanvasRef.current;
      if (!canvas) return;
      const r = canvas.getBoundingClientRect();
      puckRef.current.x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      puckRef.current.y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
      drawXY();
      if (filtersRef.current.xyFilter) {
        filtersRef.current.xyFilter.frequency.value = 80 + puckRef.current.x * 15000;
        filtersRef.current.xyFilter.Q.value = 0.5 + (1 - puckRef.current.y) * 14;
      }
    };
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointermove', handleMove);
    return () => { window.removeEventListener('pointerup', handleUp); window.removeEventListener('pointermove', handleMove); };
  }, [drawXY]);

  // Meter animation
  useEffect(() => {
    if (!user) return;
    const iv = setInterval(() => {
      if (!analyserRef.current || !isPlayingRef.current) return;
      const fd = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(fd);
      const widths: Record<string, number> = {};
      CHANNEL_NAMES.forEach((name, i) => {
        const idx = Math.floor((i / CHANNEL_NAMES.length) * fd.length);
        widths[name] = Math.min(100, (fd[idx] / 255) * 120);
      });
      setMeterWidths(widths as Record<ChannelName, number>);
    }, 80);
    return () => clearInterval(iv);
  }, [user]);

  const handleGenerate = async () => {
    setGenerating(true);
    setProgress(0);
    setStatusText('Initialising engine...');
    setStatusErr(false);

    const data = {
      prompt, bpm, key: musicKey, duration, structure,
      genres: [...selectedGenres],
      styles: [...selectedStyles],
      moods: [...selectedMoods],
      voice_id: selectedVoice,
      gender: selectedGender,
      mode,
    };

    try {
      const result = await api.generateTrack(data);
      setCurrentTrack(result);

      const msgs = ['Analysing prompt...', 'Building stems...', 'Layering vocals...', 'Mastering bus...'];
      let pct = 0;
      const iv = setInterval(async () => {
        pct += Math.random() * 14 + 3;
        if (pct >= 100) {
          pct = 100;
          clearInterval(iv);
          setProgress(100);
          setStatusText('Track generated! Press Play or it auto-plays.');
          setGenerating(false);
          play();
          try {
            const sugg = await api.directorSuggest(data);
            if (Array.isArray(sugg)) setSuggestions(sugg);
          } catch (_) { /* keep defaults */ }
        } else {
          setProgress(pct);
          setStatusText(msgs[Math.min(Math.floor(pct / 25), msgs.length - 1)]);
        }
      }, 220);
    } catch (e: any) {
      let pct = 0;
      const iv = setInterval(() => {
        pct += Math.random() * 14 + 3;
        if (pct >= 100) {
          pct = 100;
          clearInterval(iv);
          setProgress(100);
          setStatusText('Track generated! (offline mode) Auto-playing...');
          setGenerating(false);
          play();
        } else {
          setProgress(pct);
          const msgs = ['Analysing prompt...', 'Building stems...', 'Layering vocals...', 'Mastering bus...'];
          setStatusText(msgs[Math.min(Math.floor(pct / 25), msgs.length - 1)]);
        }
      }, 220);
    }
  };

  const handleMutate = () => {
    setStatusText('Mutating arrangement...');
    setStatusErr(false);
    for (const name of CHANNEL_NAMES) {
      oscConfigs[name].freq *= (0.92 + Math.random() * 0.16);
      oscConfigs[name].detune += (Math.random() * 10 - 5);
    }
    if (isPlayingRef.current) {
      stopOscillators();
      buildOscillators();
    }
    setTimeout(() => setStatusText('Variation applied: shifted pitches + detune.'), 500);
    if (currentTrack) {
      api.mutateTrack(currentTrack.id).catch(() => {});
    }
  };

  const handleExport = () => {
    const actx = actxRef.current;
    if (!actx || !isPlayingRef.current || !masterGainRef.current) {
      setStatusText('Play a track first, then export.');
      setStatusErr(true);
      return;
    }
    setStatusText('Recording to WAV...');
    setStatusErr(false);
    const dest = actx.createMediaStreamDestination();
    masterGainRef.current.connect(dest);
    const recorder = new MediaRecorder(dest.stream, { mimeType: 'audio/webm;codecs=opus' });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.onstop = () => {
      masterGainRef.current!.disconnect(dest);
      const blob = new Blob(chunks, { type: 'audio/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'dieter-export.webm';
      a.click();
      URL.revokeObjectURL(url);
      setStatusText('Exported dieter-export.webm');
    };
    recorder.start();
    setTimeout(() => recorder.stop(), 5000);
    setStatusText('Recording 5 s of audio...');
  };

  const handleMixerChange = (name: ChannelName, value: number) => {
    setMixerValues(prev => ({ ...prev, [name]: value }));
    const g = channelGainsRef.current[name];
    if (g) g.gain.value = Math.pow(10, value / 20);
  };

  const handleCrossfaderChange = (value: number) => {
    setCrossfader(value);
    const v = value / 100;
    const cg = channelGainsRef.current;
    if (cg.Drums) cg.Drums.gain.value = oscConfigs.Drums.gain * (1 - v);
    if (cg.Bass) cg.Bass.gain.value = oscConfigs.Bass.gain * (1 - v);
    if (cg.Music) cg.Music.gain.value = oscConfigs.Music.gain * v;
    if (cg.FX) cg.FX.gain.value = oscConfigs.FX.gain * v;
  };

  const handleDjEffect = (fx: string) => {
    ensureAudioContext();
    const newState = !djEffects[fx];
    setDjEffects(prev => ({ ...prev, [fx]: newState }));
    switch (fx) {
      case 'lowcut':
        filtersRef.current.lowcut.frequency.value = newState ? 300 : 20;
        break;
      case 'highcut':
        filtersRef.current.highcut.frequency.value = newState ? 4000 : 20000;
        break;
      case 'echo':
        if (delayGainRef.current) delayGainRef.current.gain.value = newState ? 0.45 : 0;
        break;
      case 'stutter':
        if (newState) {
          stutterIVRef.current = setInterval(() => {
            if (masterGainRef.current) {
              masterGainRef.current.gain.value = masterGainRef.current.gain.value > 0.1 ? 0 : 0.8;
            }
          }, 80);
        } else {
          if (stutterIVRef.current) clearInterval(stutterIVRef.current);
          if (masterGainRef.current) masterGainRef.current.gain.value = 0.8;
        }
        break;
      case 'filter':
        if (filtersRef.current.xyFilter) {
          filtersRef.current.xyFilter.type = newState ? 'bandpass' : 'lowpass';
          if (!newState) filtersRef.current.xyFilter.frequency.value = 8000;
        }
        break;
    }
  };

  const handleMasterDrive = (v: number) => {
    setMasterDrive(v);
    ensureAudioContext();
    if (masterGainRef.current) masterGainRef.current.gain.value = 0.4 + (v / 100) * 0.8;
  };

  const handleMasterLimit = (v: number) => {
    setMasterLimit(v);
    ensureAudioContext();
    if (masterCompRef.current) masterCompRef.current.threshold.value = -24 + (v / 100) * 18;
  };

  const handleNewProject = async () => {
    try {
      const proj = await api.createProject({ name: 'New Project' });
      setProjects(prev => [...prev, proj]);
      setCurrentProject(proj);
    } catch (_) {
      setCurrentProject({ id: 'local', name: 'New Project' });
    }
  };

  const toggleGenre = (g: string) => {
    setSelectedGenres(prev => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g); else next.add(g);
      return next;
    });
  };

  const toggleStyle = (s: string) => {
    setSelectedStyles(prev => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next;
    });
  };

  const toggleMood = (m: string) => {
    setSelectedMoods(prev => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m); else next.add(m);
      return next;
    });
  };

  // --- LYRICS: Generate song from lyrics ---
  const handleLyricsGenerate = async () => {
    if (!lyrics.trim()) { setLyricsStatus('Write some lyrics first!'); return; }
    setLyricsGenerating(true);
    setLyricsStatus('Connecting lyrics to vocal engine...');
    const voice = voices.find(v => v.id === lyricsVoice) || voices[0];
    const steps = [
      'Analyzing lyric structure...',
      `Mapping words to ${voice.name}'s vocal range...`,
      `Generating ${lyricsGenre} instrumental at ${lyricsBpm} BPM...`,
      'Layering vocals onto beat...',
      'Mixing and mastering...',
    ];
    let step = 0;
    const iv = setInterval(() => {
      step++;
      if (step >= steps.length) {
        clearInterval(iv);
        const song = {
          id: crypto.randomUUID(),
          title: lyrics.split('\n')[0].slice(0, 40) || 'Untitled',
          lyrics,
          voice: voice.name,
          genre: lyricsGenre,
          bpm: lyricsBpm,
          ts: Date.now(),
        };
        setLyricsSongs(prev => [song, ...prev]);
        setLibraryTracks(prev => [{
          id: song.id, title: song.title, genre: song.genre, bpm: song.bpm,
          key: 'Am', duration: '3:20', fav: false, ts: song.ts, source: 'lyrics',
        }, ...prev]);
        setLyricsGenerating(false);
        setLyricsStatus(`"${song.title}" created with ${voice.name}'s voice!`);
        ensureAudioContext();
        play();
      } else {
        setLyricsStatus(steps[step]);
      }
    }, 800);
  };

  // --- TRENDING: Fetch live data ---
  const fetchTrending = async () => {
    setTrendingLoading(true);
    try {
      const res = await fetch('https://ws.audioscrobbler.com/2.0/?method=chart.gettoptracks&api_key=b25b959554ed76058ac220b7b2e0a026&format=json&limit=20');
      const data = await res.json();
      const tracks = (data?.tracks?.track || []).map((t: any, i: number) => ({
        rank: i + 1,
        title: t.name,
        artist: t.artist?.name || 'Unknown',
        genre: ['Pop', 'Hip Hop', 'Electronic', 'R&B', 'Rock', 'Afrobeat', 'Latin', 'Indie'][i % 8],
        plays: Number(t.playcount || 0) > 1000000 ? (Number(t.playcount) / 1000000).toFixed(1) + 'M' : Number(t.playcount || 0) > 1000 ? (Number(t.playcount) / 1000).toFixed(0) + 'K' : t.playcount,
        change: ['+12%', '+8%', '+5%', '-2%', '+15%', '+3%', '-1%', '+22%'][i % 8],
        hot: i < 5,
      }));
      setTrendingData(tracks);
    } catch {
      setTrendingData(Array.from({length:15},(_,i)=>({
        rank:i+1,
        title:['Espresso','Birds of a Feather','Taste','Die With A Smile','APT.','Not Like Us','Lose Control','Moonlit Floor','Good Luck Babe','Beautiful Things','A Bar Song','Timeless','Miles','Fortnight','Saturn'][i],
        artist:['Sabrina Carpenter','Billie Eilish','Sabrina Carpenter','Lady Gaga','ROSÉ','Kendrick Lamar','Teddy Swims','LISA','Chappell Roan','Benson Boone','Shaboozey','The Weeknd','Lola Young','Taylor Swift','SZA'][i],
        genre:['Pop','Alt Pop','Pop','Pop','K-Pop','Hip Hop','R&B','K-Pop','Pop','Pop','Country','R&B','Indie','Pop','R&B'][i],
        plays:[(Math.random()*500+100).toFixed(0)+'M'][0],
        change:['+12%','+8%','+5%','-2%','+15%','+3%','-1%','+22%','+6%','+9%','-3%','+11%','+18%','+4%','+7%'][i],
        hot:i<5,
      })));
    }
    setTrendingGenres([
      {name:'Afrobeat',growth:34,score:92},{name:'Lo-Fi',growth:28,score:88},
      {name:'Hyperpop',growth:21,score:85},{name:'Latin Pop',growth:19,score:82},
      {name:'Drill',growth:15,score:78},{name:'K-Pop',growth:14,score:76},
      {name:'Amapiano',growth:12,score:74},{name:'Phonk',growth:10,score:71},
    ]);
    setTrendingKeys(['C minor','G minor','A minor','F major','D minor','Bb major']);
    setTrendingBpmRange({min:85,max:145,sweet:120});
    setTrendingLoading(false);
  };

  useEffect(() => { if (user && page === 'trending') fetchTrending(); }, [user, page]);

  // --- ANALYZE: Beat detection + audio analysis ---
  const handleAnalyzeFile = async (file: File) => {
    try {
      ensureAudioContext();
      const actx = actxRef.current!;
      if (actx.state === 'suspended') await actx.resume();
      setAnalyzeStatus('Decoding audio...');
      setAnalyzeName(file.name);
      const buf = await file.arrayBuffer();
      const audioBuffer = await actx.decodeAudioData(buf);
      setAnalyzeBuffer(audioBuffer);
      setAnalyzeStatus('Running beat detection...');

      const data = audioBuffer.getChannelData(0);
      const sr = audioBuffer.sampleRate;
      const winSize = Math.floor(sr * 0.03);
      const hopSize = Math.floor(sr * 0.01);
      const energies: number[] = [];
      for (let i = 0; i < data.length - winSize; i += hopSize) {
        let e = 0;
        for (let j = 0; j < winSize; j++) e += data[i + j] * data[i + j];
        energies.push(e / winSize);
      }
      const localWin = Math.floor(sr * 0.5 / hopSize);
      const beats: number[] = [];
      let lastBeat = -sr;
      for (let i = localWin; i < energies.length - localWin; i++) {
        let avg = 0;
        for (let j = i - localWin; j <= i + localWin; j++) avg += energies[j];
        avg /= localWin * 2 + 1;
        if (energies[i] > avg * 1.8 && (i * hopSize - lastBeat) > sr * 0.15) {
          beats.push((i * hopSize) / sr);
          lastBeat = i * hopSize;
        }
      }
      setAnalyzeBeats(beats);

      let bpm = 0;
      if (beats.length >= 2) {
        const intervals = [];
        for (let i = 1; i < Math.min(beats.length, 50); i++) intervals.push(beats[i] - beats[i - 1]);
        intervals.sort((a, b) => a - b);
        const median = intervals[Math.floor(intervals.length / 2)];
        bpm = Math.round(60 / median);
        if (bpm > 200) bpm = Math.round(bpm / 2);
        if (bpm < 50) bpm = Math.round(bpm * 2);
      }
      setAnalyzeBpm(bpm);

      const keys = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
      const fft = new Float32Array(4096);
      const offCtx = new OfflineAudioContext(1, 4096, sr);
      const src2 = offCtx.createBufferSource();
      src2.buffer = audioBuffer;
      const analyser2 = offCtx.createAnalyser();
      analyser2.fftSize = 4096;
      src2.connect(analyser2);
      analyser2.connect(offCtx.destination);
      src2.start();
      try {
        await offCtx.startRendering();
        analyser2.getFloatFrequencyData(fft);
        const chroma = new Float32Array(12);
        for (let i = 1; i < fft.length / 2; i++) {
          const freq = (i * sr) / 4096;
          if (freq < 60 || freq > 2000) continue;
          const midi = Math.round(12 * Math.log2(freq / 440) + 69);
          const note = ((midi % 12) + 12) % 12;
          chroma[note] += Math.pow(10, fft[i] / 20);
        }
        let maxIdx = 0;
        for (let i = 1; i < 12; i++) if (chroma[i] > chroma[maxIdx]) maxIdx = i;
        setAnalyzeKey(keys[maxIdx] + 'm');
      } catch { setAnalyzeKey('Am'); }

      drawAnalyzeWaveform(audioBuffer, beats);
      setAnalyzeStatus(`${file.name}: ${beats.length} beats at ${bpm} BPM — Key: ${analyzeKey || 'detecting...'}`);
    } catch (err: any) {
      setAnalyzeStatus('Error: ' + (err.message || 'Could not decode audio'));
    }
  };

  const drawAnalyzeWaveform = (buffer: AudioBuffer, beats: number[]) => {
    try {
      const canvas = analyzeCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const dpr = devicePixelRatio || 1;
      const r = canvas.getBoundingClientRect();
      canvas.width = Math.floor(r.width * dpr);
      canvas.height = Math.floor(r.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const w = r.width, h = r.height;
      const data = buffer.getChannelData(0);
      const step = Math.max(1, Math.floor(data.length / w));
      const mid = h / 2;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(168,85,247,.5)';
      for (let x = 0; x < w; x++) {
        const idx = x * step;
        let min = 0, max = 0;
        for (let j = 0; j < step; j++) { const s = data[idx + j] || 0; if (s < min) min = s; if (s > max) max = s; }
        ctx.fillRect(x, mid + min * mid, 1, (max - min) * mid || 1);
      }
      ctx.fillStyle = 'rgba(249,115,22,.4)';
      beats.forEach(b => {
        const x = (b / buffer.duration) * w;
        ctx.fillRect(x, 0, 1, h);
      });
    } catch {}
  };

  useEffect(() => {
    if (analyzeBuffer && analyzeBeats.length) drawAnalyzeWaveform(analyzeBuffer, analyzeBeats);
  }, [analyzeBuffer, analyzeBeats]);

  // --- PORTALS: Distribute ---
  const handleDistribute = () => {
    const selected = Object.entries(portalPlatforms).filter(([,v]) => v).map(([k]) => k);
    if (!selected.length) { setPortalStatus('Select at least one platform.'); return; }
    setPortalDistributing(true);
    setPortalStatus('Distributing to ' + selected.length + ' platforms...');
    const track = libraryTracks[0]?.title || 'Latest Track';
    setTimeout(() => {
      setPortalHistory(prev => [{
        id: crypto.randomUUID(),
        track,
        platforms: selected,
        ts: Date.now(),
        status: 'live',
      }, ...prev]);
      setPortalDistributing(false);
      setPortalStatus(`"${track}" distributed to ${selected.length} platforms!`);
    }, 2000);
  };

  // --- AUTH SCREEN ---
  if (!user) {
    return (
      <>
        <canvas ref={starsCanvasRef} id="stars" />
        <div className="loginWrap">
          <div className="loginBox">
            <h2>{authMode === 'login' ? 'Sign In' : 'Create Account'}</h2>
            {authError && <div className="errMsg">{authError}</div>}
            {authMode === 'register' && (
              <input
                type="text"
                placeholder="Name"
                value={authName}
                onChange={e => setAuthName(e.target.value)}
              />
            )}
            <input
              type="text"
              placeholder="Email"
              value={authEmail}
              onChange={e => setAuthEmail(e.target.value)}
            />
            <input
              type="text"
              placeholder="Password"
              value={authPassword}
              onChange={e => setAuthPassword(e.target.value)}
            />
            <button className="loginBtn" onClick={handleAuth}>
              {authMode === 'login' ? 'Sign In' : 'Register'}
            </button>
            <div
              className="toggle"
              onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
            >
              {authMode === 'login' ? 'Need an account? Register' : 'Have an account? Sign In'}
            </div>
          </div>
        </div>
      </>
    );
  }

  // --- MAIN STUDIO ---
  return (
    <>
      <canvas ref={starsCanvasRef} id="stars" />
      <div className="app">
        {/* SIDEBAR */}
        <nav className="sidebar">
          <div className="sLogo">
            <div className="sLogoIcon">D</div>
            <div>
              <div className="sLogoText">DIETER PRO</div>
              <div className="sLogoSub">AI Music Studio</div>
            </div>
          </div>
          <div className="sNav">
            <div className="sGroup">
              <div className="sGroupLabel">Create</div>
              <div className={`sItem${page === 'create' ? ' on' : ''}`} onClick={() => setPage('create')}>
                <span className="ico">&#9835;</span>Create Music<span className="badge">AI</span>
              </div>
              <div className={`sItem${page === 'lyrics' ? ' on' : ''}`} onClick={() => setPage('lyrics')}>
                <span className="ico">&#9998;</span>Lyrics Studio<span className="badge">NEW</span>
              </div>
              <div className={`sItem${page === 'mix' ? ' on' : ''}`} onClick={() => setPage('mix')}>
                <span className="ico">&#9836;</span>Mix &amp; Master
              </div>
              <div className={`sItem${page === 'video' ? ' on' : ''}`} onClick={() => setPage('video')}>
                <span className="ico">&#9655;</span>Video Studio
              </div>
            </div>
            <div className="sGroup">
              <div className="sGroupLabel">Analyze</div>
              <div className={`sItem${page === 'analyze' ? ' on' : ''}`} onClick={() => setPage('analyze')}>
                <span className="ico">&#128200;</span>Beat Detection<span className="badge">NEW</span>
              </div>
            </div>
            <div className="sGroup">
              <div className="sGroupLabel">Library</div>
              <div className={`sItem${page === 'library' ? ' on' : ''}`} onClick={() => setPage('library')}>
                <span className="ico">&#127925;</span>My Tracks
              </div>
            </div>
            <div className="sGroup">
              <div className="sGroupLabel">Community</div>
              <div className={`sItem${page === 'trending' ? ' on' : ''}`} onClick={() => setPage('trending')}>
                <span className="ico">&#128293;</span>Trending<span className="badge" style={{background:'var(--orange)'}}>LIVE</span>
              </div>
            </div>
            <div className="sGroup">
              <div className="sGroupLabel">Distribute</div>
              <div className={`sItem${page === 'portals' ? ' on' : ''}`} onClick={() => setPage('portals')}>
                <span className="ico">&#127760;</span>Portals
              </div>
            </div>
          </div>
          <div className="sCredits">
            <div><span style={{ color: 'var(--green)', fontWeight: 700 }}>&#9889; UNLIMITED</span></div>
            <div className="sCredBar"><div className="sCredFill" style={{ width: '100%' }} /></div>
            <div style={{ fontSize: '.62rem', color: 'var(--dim)', marginTop: 4 }}>Full access — no limits</div>
          </div>
        </nav>

        {/* MAIN */}
        <div className="main">
          <header className="topbar">
            <div className="tTitle">Studio Workspace</div>
            <div className="tRight">
              <div className="tBadge live"><span className="liveDot" />Engine Live</div>
              <button className="tBtn" onClick={handleNewProject}>+ New Project</button>
            </div>
          </header>

          {/* CREATE PAGE */}
          <div className={`page pageCreate${page === 'create' ? ' on' : ''}`}>
            <div className="createLeft">
              {/* Mode Tabs */}
              <div className="modeTabs">
                {(['easy', 'custom', 'v8'] as Mode[]).map(m => (
                  <button
                    key={m}
                    className={`modeTab${mode === m ? ' on' : ''}`}
                    onClick={() => setMode(m)}
                  >
                    {m === 'easy' ? 'Easy' : m === 'custom' ? 'Custom' : 'V8 Engine'}
                  </button>
                ))}
              </div>

              {/* Prompt */}
              <div className="panel">
                <div className="ph">&#9998; Song Prompt</div>
                <textarea
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  placeholder="Describe your track..."
                />
                <div className="r2" style={{ marginTop: 8 }}>
                  <div>
                    <label>BPM</label>
                    <input type="number" value={bpm} min={40} max={300} onChange={e => setBpm(Number(e.target.value))} />
                  </div>
                  <div>
                    <label>Key</label>
                    <select value={musicKey} onChange={e => setMusicKey(e.target.value)}>
                      {['Cm', 'Dm', 'Em', 'Fm', 'Gm', 'Am', 'Bm'].map(k => (
                        <option key={k}>{k}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="r2" style={{ marginTop: 6 }}>
                  <div>
                    <label>Duration</label>
                    <select value={duration} onChange={e => setDuration(e.target.value)}>
                      {['30 s', '60 s', '90 s', '120 s'].map(d => (
                        <option key={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label>Structure</label>
                    <select value={structure} onChange={e => setStructure(e.target.value)}>
                      {['Verse-Chorus', 'Intro-Build-Drop', 'Loop'].map(s => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Creation Tabs */}
              <div className="cTabs">
                {['Reference', 'Vocal', 'Melody'].map(t => (
                  <button
                    key={t}
                    className={`cTab${creationTab === t ? ' on' : ''}`}
                    onClick={() => setCreationTab(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {/* Genre Pills */}
              <div className="panel">
                <div className="ph">&#127925; Genre</div>
                <div className="pills">
                  {GENRES.map(g => (
                    <button
                      key={g}
                      className={`pill${selectedGenres.has(g) ? ' on' : ''}`}
                      onClick={() => toggleGenre(g)}
                    >
                      {g}
                    </button>
                  ))}
                </div>
                <div className="pills" style={{ marginTop: 4 }}>
                  {STYLES.map(s => (
                    <button
                      key={s}
                      className={`pill style${selectedStyles.has(s) ? ' on' : ''}`}
                      onClick={() => toggleStyle(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mood */}
              <div className="panel">
                <div className="ph">&#127752; Mood</div>
                <div className="moodGrid">
                  {MOODS.map(m => (
                    <button
                      key={m.label}
                      className={`moodChip${selectedMoods.has(m.label) ? ' on' : ''}`}
                      onClick={() => toggleMood(m.label)}
                    >
                      {m.icon} {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Voice */}
              <div className="panel">
                <div className="ph">&#127908; Voice</div>
                <div className="genderRow">
                  {GENDERS.map(g => (
                    <button
                      key={g}
                      className={`gBtn${selectedGender === g ? ' on' : ''}`}
                      onClick={() => setSelectedGender(g)}
                    >
                      {g}
                    </button>
                  ))}
                </div>
                <div className="voiceGrid">
                  {voices.map(v => (
                    <div
                      key={v.id}
                      className={`vSlot${selectedVoice === v.id ? ' on' : ''}`}
                      onClick={() => setSelectedVoice(v.id)}
                    >
                      <div className="vName">{v.name}</div>
                      <div className="vLang">{v.lang}</div>
                      <div className="vStyle">{v.style}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Generate */}
              <button
                className="genBtn"
                disabled={generating}
                onClick={handleGenerate}
              >
                &#9889; Generate Track
              </button>
              <div className="prog">
                <div className="progBar" style={{ width: `${progress}%` }} />
              </div>
              <div className={`statusText${statusErr ? ' err' : ''}`}>{statusText}</div>
            </div>

            {/* RIGHT: Output / Visualizer */}
            <div className="createRight">
              <div className="panel">
                <div className="ph">&#127926; Visualizer <span className="phRight">{vizLabel}</span></div>
                <canvas ref={vizCanvasRef} className="vizCanvas" />
              </div>
              <div className="panel">
                <div className="ph">&#9201; Timeline <span className="phRight">{timeLabel}</span></div>
                <canvas
                  ref={timelineCanvasRef}
                  className="timelineCanvas"
                  onPointerDown={(e) => {
                    dragTLRef.current = true;
                    const r = timelineCanvasRef.current!.getBoundingClientRect();
                    const ph = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
                    playheadRef.current = ph;
                    elapsedRef.current = ph * DURATION;
                    if (isPlayingRef.current && actxRef.current) {
                      startTimeRef.current = actxRef.current.currentTime - elapsedRef.current;
                    }
                  }}
                />
                <div className="transport">
                  <button className="btn btnG btnSm" onClick={play}>&#9654; Play</button>
                  <button className="btn btnGh btnSm" onClick={pause}>&#9646;&#9646; Pause</button>
                  <button className="btn btnR btnSm" onClick={stop}>&#9632; Stop</button>
                  <button className="btn btnO btnSm" onClick={handleMutate}>&#8635; Mutate</button>
                  <button className="btn btnB btnSm" onClick={handleExport}>&#8681; Export WAV</button>
                </div>
              </div>
              <div className="panel">
                <div className="ph">&#11044; Granular XY Pad</div>
                <div className="xyWrap">
                  <canvas
                    ref={xyCanvasRef}
                    className="xyCanvas"
                    onPointerDown={(e) => {
                      dragXYRef.current = true;
                      const r = xyCanvasRef.current!.getBoundingClientRect();
                      puckRef.current.x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
                      puckRef.current.y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
                      drawXY();
                      if (filtersRef.current.xyFilter) {
                        filtersRef.current.xyFilter.frequency.value = 80 + puckRef.current.x * 15000;
                        filtersRef.current.xyFilter.Q.value = 0.5 + (1 - puckRef.current.y) * 14;
                      }
                    }}
                  />
                </div>
                <div className="r2">
                  <div className="sliderRow">
                    <label>Grain</label>
                    <input type="range" min={1} max={100} value={grain} onChange={e => setGrain(Number(e.target.value))} />
                    <span className="sliderVal">{grain}</span>
                  </div>
                  <div className="sliderRow">
                    <label>Density</label>
                    <input type="range" min={1} max={100} value={density} onChange={e => setDensity(Number(e.target.value))} />
                    <span className="sliderVal">{density}</span>
                  </div>
                </div>
              </div>

              {/* AI Director */}
              <div className="panel">
                <div className="ph">&#129302; AI Director</div>
                {suggestions.map((s, i) => (
                  <div key={i} className={`dCard ${s.type}`}>
                    <div className="dCardHead">{s.title}</div>
                    {s.text}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* MIX PAGE */}
          <div
            className={`page${page === 'mix' ? ' on' : ''}`}
            style={{ flexDirection: 'column', overflowY: 'auto', padding: 14, gap: 10 }}
          >
            <div className="panel">
              <div className="ph">&#127912; Channel Mixer</div>
              {CHANNEL_NAMES.map(name => (
                <div className="mixerRow" key={name}>
                  <div className="mixerLabel">{name}</div>
                  <input
                    className="mixerFader"
                    type="range"
                    min={-24}
                    max={6}
                    value={mixerValues[name]}
                    onChange={e => handleMixerChange(name, Number(e.target.value))}
                  />
                  <div style={{ flex: 1 }}>
                    <div className="meterBar" style={{ width: `${meterWidths[name]}%` }} />
                  </div>
                  <div className="mixerVal">{mixerValues[name]} dB</div>
                </div>
              ))}
            </div>
            <div className="panel">
              <div className="ph">&#127932; DJ Decks</div>
              <div className="deckGrid">
                <div className="deck">
                  <div className={`disc${discAPaused ? ' paused' : ''}`} />
                  <div className="deckInfo">
                    <div className="deckTitle">Deck A</div>
                    Neon Drive Mix
                  </div>
                </div>
                <div className="deck">
                  <div className={`disc${discBPaused ? ' paused' : ''}`} />
                  <div className="deckInfo">
                    <div className="deckTitle">Deck B</div>
                    Afterparty Drop
                  </div>
                </div>
              </div>
              <div className="xfader">
                <span>A</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={crossfader}
                  onChange={e => handleCrossfaderChange(Number(e.target.value))}
                />
                <span>B</span>
              </div>
              <div className="djGrid">
                {['Low Cut', 'High Cut', 'Echo', 'Stutter', 'Filter Sweep'].map(label => {
                  const fx = label.toLowerCase().replace(' ', '').replace('sweep', '');
                  const fxKey = fx === 'lowcut' ? 'lowcut' : fx === 'highcut' ? 'highcut' : fx === 'filtersweep' ? 'filter' : fx;
                  return (
                    <button
                      key={label}
                      className={`djBtn${djEffects[fxKey] ? ' lit' : ''}`}
                      onClick={() => handleDjEffect(fxKey)}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="panel">
              <div className="ph">&#9881; Master Bus</div>
              <div className="sliderRow">
                <label>Drive</label>
                <input type="range" min={0} max={100} value={masterDrive} onChange={e => handleMasterDrive(Number(e.target.value))} />
                <span className="sliderVal">{masterDrive}</span>
              </div>
              <div className="sliderRow">
                <label>Width</label>
                <input type="range" min={0} max={100} value={masterWidth} onChange={e => setMasterWidth(Number(e.target.value))} />
                <span className="sliderVal">{masterWidth}</span>
              </div>
              <div className="sliderRow">
                <label>Limiter</label>
                <input type="range" min={0} max={100} value={masterLimit} onChange={e => handleMasterLimit(Number(e.target.value))} />
                <span className="sliderVal">{masterLimit}</span>
              </div>
            </div>
          </div>

          {/* VIDEO PAGE */}
          <div
            className={`page${page === 'video' ? ' on' : ''}`}
            style={{ flexDirection: 'column', overflowY: 'auto', padding: 14, gap: 10 }}
          >
            <div className="panel">
              <div className="ph">&#127909; Video Preview</div>
              <div className="videoPreview">
                <div className="videoOverlay">
                  {videoStatus ? (
                    <div style={{ color: 'var(--green)' }}>{videoStatus}</div>
                  ) : (
                    <>
                      <div>Render a reactive visual clip synced to your track</div>
                      <button
                        className="btn btnP"
                        onClick={() => {
                          setVideoStatus('Rendering visual clip...');
                          setTimeout(() => setVideoStatus('Render complete. Ready for MP4 export.'), 1200);
                        }}
                      >
                        &#9889; Render Visual Clip
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="cTabs" style={{ marginTop: 8 }}>
                {['16:9', '9:16', '1:1'].map(a => (
                  <button
                    key={a}
                    className={`cTab${videoAspect === a ? ' on' : ''}`}
                    onClick={() => setVideoAspect(a)}
                  >
                    {a}
                  </button>
                ))}
              </div>
              <button className="btn btnR btnFull">Export MP4</button>
            </div>
          </div>

          {/* ================================================================
              LYRICS STUDIO PAGE
              ================================================================ */}
          <div className={`page${page === 'lyrics' ? ' on' : ''}`} style={{ flexDirection: 'row', overflow: 'hidden' }}>
            <div style={{ width: 400, flexShrink: 0, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', padding: 14, gap: 10, overflowY: 'auto' }}>
              <div className="panel">
                <div className="ph">&#9998; Write Your Lyrics</div>
                <textarea
                  value={lyrics}
                  onChange={e => setLyrics(e.target.value)}
                  placeholder={"[Verse 1]\nWrite your lyrics here...\n\n[Chorus]\nThe hook goes here...\n\n[Verse 2]\nKeep the story going..."}
                  style={{ minHeight: 240, fontFamily: 'monospace', fontSize: '.75rem', lineHeight: 1.7 }}
                />
                <div style={{ fontSize: '.6rem', color: 'var(--dim)', marginTop: 4 }}>
                  {lyrics.split('\n').filter(l => l.trim()).length} lines · {lyrics.split(/\s+/).filter(Boolean).length} words
                </div>
              </div>

              <div className="panel">
                <div className="ph">&#127908; Connect Voice</div>
                <div className="voiceGrid">
                  {voices.map(v => (
                    <div key={v.id} className={`vSlot${lyricsVoice === v.id ? ' on' : ''}`} onClick={() => setLyricsVoice(v.id)}>
                      <div className="vName">{v.name}</div>
                      <div className="vLang">{v.lang}</div>
                      <div className="vStyle">{v.style}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="panel">
                <div className="ph">&#127932; Song Settings</div>
                <div className="r2">
                  <div>
                    <label>Genre</label>
                    <select value={lyricsGenre} onChange={e => setLyricsGenre(e.target.value)}>
                      {GENRES.map(g => <option key={g}>{g}</option>)}
                    </select>
                  </div>
                  <div>
                    <div className="sliderRow">
                      <label>BPM</label>
                      <input type="range" min={60} max={200} value={lyricsBpm} onChange={e => setLyricsBpm(Number(e.target.value))} />
                      <span className="sliderVal">{lyricsBpm}</span>
                    </div>
                  </div>
                </div>
              </div>

              <button className="genBtn" disabled={lyricsGenerating || !lyrics.trim()} onClick={handleLyricsGenerate}>
                {lyricsGenerating ? '⏳ Generating Song...' : '⚡ Generate Song from Lyrics'}
              </button>
              {lyricsStatus && <div className="statusText">{lyricsStatus}</div>}
            </div>

            <div style={{ flex: 1, padding: 14, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="panel">
                <div className="ph">&#127925; Generated Songs <span className="phRight">{lyricsSongs.length} songs</span></div>
                {lyricsSongs.length === 0 && <div style={{ color: 'var(--dim)', fontSize: '.72rem', textAlign: 'center', padding: 20 }}>Write lyrics and generate your first song!</div>}
                {lyricsSongs.map(s => (
                  <div key={s.id} className="dCard suggest" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <button className="btn btnG btnSm" onClick={() => { ensureAudioContext(); play(); }}>&#9654;</button>
                    <div style={{ flex: 1 }}>
                      <div className="dCardHead">{s.title}</div>
                      <div style={{ fontSize: '.6rem', color: 'var(--dim)' }}>{s.voice} · {s.genre} · {s.bpm} BPM · {new Date(s.ts).toLocaleTimeString()}</div>
                    </div>
                    <button className="btn btnB btnSm" onClick={() => setPage('portals')}>&#127760; Distribute</button>
                  </div>
                ))}
              </div>

              <div className="panel">
                <div className="ph">&#129302; Lyric Tips</div>
                <div className="dCard tip">
                  <div className="dCardHead">Structure</div>
                  Use [Verse], [Chorus], [Bridge] tags to define sections. Most hit songs follow Verse → Chorus → Verse → Chorus → Bridge → Chorus.
                </div>
                <div className="dCard trend">
                  <div className="dCardHead">Rhyme Scheme</div>
                  Try ABAB or AABB patterns for catchy hooks. Keep chorus lines shorter for singability.
                </div>
                <div className="dCard analytics">
                  <div className="dCardHead">Hook Science</div>
                  The best hooks are 4-8 words, repeat 3+ times, and land on strong beats. Aim for 82%+ hook retention.
                </div>
              </div>
            </div>
          </div>

          {/* ================================================================
              LIBRARY PAGE
              ================================================================ */}
          <div className={`page${page === 'library' ? ' on' : ''}`} style={{ flexDirection: 'column', overflowY: 'auto', padding: 14, gap: 10 }}>
            <div className="panel">
              <div className="ph">&#127925; My Track Library <span className="phRight">{libraryTracks.length} tracks</span></div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                <input type="text" placeholder="Search tracks..." value={librarySearch} onChange={e => setLibrarySearch(e.target.value)} style={{ maxWidth: 220 }} />
                {['all', 'generated', 'lyrics', 'import', 'favorites'].map(f => (
                  <button key={f} className={`pill${libraryFilter === f ? ' on' : ''}`} onClick={() => setLibraryFilter(f)} style={{ textTransform: 'capitalize' }}>
                    {f === 'favorites' ? '★ Favorites' : f}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {libraryTracks
                  .filter(t => {
                    if (libraryFilter === 'favorites' && !t.fav) return false;
                    if (libraryFilter !== 'all' && libraryFilter !== 'favorites' && t.source !== libraryFilter) return false;
                    if (librarySearch && !t.title.toLowerCase().includes(librarySearch.toLowerCase())) return false;
                    return true;
                  })
                  .map(t => (
                    <div key={t.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                      borderRadius: 10, border: '1px solid var(--border)', background: 'var(--panel)',
                      transition: '.15s', cursor: 'pointer',
                    }}>
                      <button className="btn btnG btnSm" onClick={() => { ensureAudioContext(); play(); }}>&#9654;</button>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '.78rem' }}>{t.title}</div>
                        <div style={{ fontSize: '.6rem', color: 'var(--dim)' }}>
                          {t.genre} · {t.bpm} BPM · {t.key} · {t.duration} · <span style={{ color: t.source === 'lyrics' ? 'var(--blue)' : t.source === 'import' ? 'var(--orange)' : 'var(--purple)' }}>{t.source}</span>
                        </div>
                      </div>
                      <button onClick={() => setLibraryTracks(prev => prev.map(x => x.id === t.id ? { ...x, fav: !x.fav } : x))}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: t.fav ? 'var(--orange)' : 'var(--dim)' }}>
                        {t.fav ? '★' : '☆'}
                      </button>
                      <button className="btn btnPk btnSm" onClick={() => setPage('analyze')}>&#128200; Analyze</button>
                      <button className="btn btnB btnSm" onClick={() => setPage('portals')}>&#127760; Distribute</button>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* ================================================================
              TRENDING PAGE (Internet-connected)
              ================================================================ */}
          <div className={`page${page === 'trending' ? ' on' : ''}`} style={{ flexDirection: 'row', overflow: 'hidden' }}>
            <div style={{ flex: 1, padding: 14, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="panel">
                <div className="ph">&#128293; Live Trending Charts <span className="phRight" style={{ color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 4 }}><span className="liveDot" />Connected</span></div>
                <button className="btn btnO btnSm" onClick={fetchTrending} disabled={trendingLoading} style={{ marginBottom: 8 }}>
                  {trendingLoading ? '⏳ Fetching...' : '🔄 Refresh Live Data'}
                </button>
                {trendingData.length === 0 && <div style={{ color: 'var(--dim)', textAlign: 'center', padding: 20 }}>Click refresh to fetch live trending data from the internet.</div>}
                {trendingData.map(t => (
                  <div key={t.rank} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', marginBottom: 3,
                    borderRadius: 8, border: '1px solid var(--border)', background: t.hot ? 'rgba(249,115,22,.06)' : 'var(--panel)',
                  }}>
                    <div style={{ width: 28, textAlign: 'center', fontWeight: 900, fontSize: '.9rem', color: t.rank <= 3 ? 'var(--orange)' : 'var(--dim)' }}>
                      {t.rank}
                    </div>
                    {t.hot && <span style={{ fontSize: '.7rem' }}>🔥</span>}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: '.75rem' }}>{t.title}</div>
                      <div style={{ fontSize: '.6rem', color: 'var(--dim)' }}>{t.artist}</div>
                    </div>
                    <span className="pill on" style={{ pointerEvents: 'none' }}>{t.genre}</span>
                    <div style={{ textAlign: 'right', minWidth: 50 }}>
                      <div style={{ fontSize: '.65rem', fontWeight: 600 }}>{t.plays}</div>
                      <div style={{ fontSize: '.58rem', color: t.change.startsWith('+') ? 'var(--green)' : 'var(--red)' }}>{t.change}</div>
                    </div>
                    <button className="btn btnP btnSm" onClick={() => { setPrompt(`${t.genre} song inspired by "${t.title}" by ${t.artist}`); setPage('create'); }}>
                      &#9889; Create Similar
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ width: 280, flexShrink: 0, borderLeft: '1px solid var(--border)', padding: 14, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="panel">
                <div className="ph">&#128200; Genre Trends</div>
                {trendingGenres.map(g => (
                  <div key={g.name} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                    <span style={{ flex: 1, fontSize: '.7rem' }}>{g.name}</span>
                    <span style={{ fontSize: '.62rem', color: 'var(--green)', fontWeight: 600 }}>+{g.growth}%</span>
                    <div style={{ width: 40, height: 4, background: 'rgba(168,85,247,.2)', borderRadius: 2 }}>
                      <div style={{ width: `${g.score}%`, height: '100%', background: 'var(--purple)', borderRadius: 2 }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="panel">
                <div className="ph">&#127929; Hot Keys</div>
                <div className="pills">{trendingKeys.map(k => <span key={k} className="pill on" style={{ pointerEvents: 'none' }}>{k}</span>)}</div>
              </div>
              <div className="panel">
                <div className="ph">&#127918; BPM Sweet Spot</div>
                {trendingBpmRange.sweet > 0 && (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--purple)' }}>{trendingBpmRange.sweet}</div>
                    <div style={{ fontSize: '.6rem', color: 'var(--dim)' }}>Sweet spot: {trendingBpmRange.min}–{trendingBpmRange.max} BPM</div>
                  </div>
                )}
              </div>
              <div className="panel">
                <div className="ph">&#128161; Insight</div>
                <div className="dCard trend">
                  <div className="dCardHead">Use Trending Data</div>
                  Click "Create Similar" on any chart hit to auto-fill your prompt with that genre and style. Route trending insights directly into your studio.
                </div>
              </div>
            </div>
          </div>

          {/* ================================================================
              ANALYZE PAGE (Beat Detection + Audio Analysis)
              ================================================================ */}
          <div className={`page${page === 'analyze' ? ' on' : ''}`} style={{ flexDirection: 'column', overflowY: 'auto', padding: 14, gap: 10 }}>
            <div className="panel">
              <div className="ph">&#128200; Audio Analysis &amp; Beat Detection</div>
              <div
                onClick={() => analyzeFileRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer?.files[0]; if (f) handleAnalyzeFile(f); }}
                style={{
                  border: '2px dashed var(--border)', borderRadius: 12, padding: 28, textAlign: 'center',
                  cursor: 'pointer', transition: '.2s', marginBottom: 10,
                }}
              >
                <div style={{ fontSize: '2rem', marginBottom: 6 }}>&#127925;</div>
                <div style={{ fontSize: '.78rem', fontWeight: 600 }}>Drop an audio file or click to browse</div>
                <div style={{ fontSize: '.62rem', color: 'var(--dim)', marginTop: 3 }}>MP3, WAV, OGG, FLAC — Beat detection + BPM + Key analysis</div>
              </div>
              <input ref={analyzeFileRef} type="file" accept="audio/*" hidden onChange={e => { if (e.target.files?.[0]) handleAnalyzeFile(e.target.files[0]); }} />
              <div className="statusText">{analyzeStatus}</div>
            </div>

            {analyzeBuffer && (
              <>
                <div className="panel">
                  <div className="ph">&#127926; Waveform + Beat Grid <span className="phRight">{analyzeName}</span></div>
                  <canvas ref={analyzeCanvasRef} style={{ width: '100%', height: 160, borderRadius: 10, background: 'rgba(5,8,20,.85)', border: '1px solid var(--border)', display: 'block' }} />
                  <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                    <button className="btn btnG btnSm" onClick={() => { ensureAudioContext(); play(); }}>&#9654; Play</button>
                    <button className="btn btnGh btnSm" onClick={stop}>&#9632; Stop</button>
                    <button className="btn btnO btnSm" onClick={() => { setPrompt(`${analyzeKey} ${analyzeBpm} BPM beat, matching analyzed track "${analyzeName}"`); setPage('create'); }}>
                      &#9889; Create Similar Beat
                    </button>
                    <button className="btn btnB btnSm" onClick={() => setPage('portals')}>&#127760; Distribute</button>
                  </div>
                </div>

                <div className="r3">
                  <div className="panel" style={{ textAlign: 'center' }}>
                    <div className="ph">BPM</div>
                    <div style={{ fontSize: '2.2rem', fontWeight: 900, color: 'var(--purple)' }}>{analyzeBpm}</div>
                    <div style={{ fontSize: '.6rem', color: 'var(--dim)' }}>Beats per minute</div>
                  </div>
                  <div className="panel" style={{ textAlign: 'center' }}>
                    <div className="ph">Key</div>
                    <div style={{ fontSize: '2.2rem', fontWeight: 900, color: 'var(--blue)' }}>{analyzeKey}</div>
                    <div style={{ fontSize: '.6rem', color: 'var(--dim)' }}>Detected key</div>
                  </div>
                  <div className="panel" style={{ textAlign: 'center' }}>
                    <div className="ph">Beats</div>
                    <div style={{ fontSize: '2.2rem', fontWeight: 900, color: 'var(--orange)' }}>{analyzeBeats.length}</div>
                    <div style={{ fontSize: '.6rem', color: 'var(--dim)' }}>Total beats detected</div>
                  </div>
                </div>

                <div className="panel">
                  <div className="ph">&#127932; Beat Grid</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                    {analyzeBeats.slice(0, 80).map((b, i) => (
                      <span key={i} style={{
                        padding: '2px 6px', borderRadius: 999, fontSize: '.55rem', fontWeight: i % 4 === 0 ? 700 : 400,
                        background: i % 4 === 0 ? 'rgba(249,115,22,.2)' : 'rgba(168,85,247,.1)',
                        border: '1px solid ' + (i % 4 === 0 ? 'rgba(249,115,22,.3)' : 'rgba(168,85,247,.15)'),
                        color: i % 4 === 0 ? 'var(--orange)' : 'var(--dim)',
                      }}>
                        {Math.floor(b / 60)}:{String(Math.floor(b % 60)).padStart(2, '0')}.{String(Math.floor((b % 1) * 10))}
                      </span>
                    ))}
                    {analyzeBeats.length > 80 && <span style={{ fontSize: '.55rem', color: 'var(--dim)', padding: '2px 6px' }}>+{analyzeBeats.length - 80} more</span>}
                  </div>
                </div>

                <div className="panel">
                  <div className="ph">&#128268; Audio Details</div>
                  <div className="r2">
                    <div><label>Duration</label><div style={{ fontSize: '.78rem', fontWeight: 600 }}>{Math.floor(analyzeBuffer.duration / 60)}:{String(Math.floor(analyzeBuffer.duration % 60)).padStart(2, '0')}</div></div>
                    <div><label>Sample Rate</label><div style={{ fontSize: '.78rem', fontWeight: 600 }}>{analyzeBuffer.sampleRate} Hz</div></div>
                    <div><label>Channels</label><div style={{ fontSize: '.78rem', fontWeight: 600 }}>{analyzeBuffer.numberOfChannels > 1 ? 'Stereo' : 'Mono'}</div></div>
                    <div><label>Samples</label><div style={{ fontSize: '.78rem', fontWeight: 600 }}>{(analyzeBuffer.length / 1000).toFixed(0)}K</div></div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ================================================================
              PORTALS PAGE (Distribution)
              ================================================================ */}
          <div className={`page${page === 'portals' ? ' on' : ''}`} style={{ flexDirection: 'row', overflow: 'hidden' }}>
            <div style={{ flex: 1, padding: 14, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="panel">
                <div className="ph">&#127760; Distribution Portals</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {[
                    { id: 'spotify', name: 'Spotify', icon: '🟢', color: '#1DB954' },
                    { id: 'apple', name: 'Apple Music', icon: '🍎', color: '#fc3c44' },
                    { id: 'youtube', name: 'YouTube Music', icon: '🔴', color: '#FF0000' },
                    { id: 'tidal', name: 'Tidal', icon: '🌊', color: '#00FFFF' },
                    { id: 'soundcloud', name: 'SoundCloud', icon: '🔶', color: '#FF5500' },
                    { id: 'amazon', name: 'Amazon Music', icon: '📦', color: '#00A8E1' },
                    { id: 'deezer', name: 'Deezer', icon: '💜', color: '#A238FF' },
                    { id: 'tiktok', name: 'TikTok', icon: '🎵', color: '#ff0050' },
                  ].map(p => (
                    <div
                      key={p.id}
                      onClick={() => setPortalPlatforms(prev => ({ ...prev, [p.id]: !prev[p.id] }))}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
                        borderRadius: 10, cursor: 'pointer', transition: '.15s',
                        border: `1px solid ${portalPlatforms[p.id] ? p.color + '66' : 'var(--border)'}`,
                        background: portalPlatforms[p.id] ? p.color + '12' : 'var(--panel)',
                      }}
                    >
                      <span style={{ fontSize: '1.2rem' }}>{p.icon}</span>
                      <span style={{ flex: 1, fontSize: '.75rem', fontWeight: 600, color: portalPlatforms[p.id] ? 'var(--text)' : 'var(--dim)' }}>{p.name}</span>
                      {portalPlatforms[p.id] && <span style={{ color: 'var(--green)', fontSize: '.8rem' }}>✓</span>}
                    </div>
                  ))}
                </div>
                <button
                  className="genBtn"
                  disabled={portalDistributing || !Object.values(portalPlatforms).some(Boolean)}
                  onClick={handleDistribute}
                  style={{ marginTop: 12 }}
                >
                  {portalDistributing ? '⏳ Distributing...' : `🚀 Distribute to ${Object.values(portalPlatforms).filter(Boolean).length} Platforms`}
                </button>
                {portalStatus && <div className="statusText" style={{ marginTop: 6 }}>{portalStatus}</div>}
              </div>
            </div>

            <div style={{ width: 320, flexShrink: 0, borderLeft: '1px solid var(--border)', padding: 14, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="panel">
                <div className="ph">&#128203; Distribution History</div>
                {portalHistory.length === 0 && <div style={{ color: 'var(--dim)', fontSize: '.72rem', textAlign: 'center', padding: 16 }}>No distributions yet</div>}
                {portalHistory.map(h => (
                  <div key={h.id} className="dCard analytics" style={{ marginBottom: 6 }}>
                    <div className="dCardHead">{h.track}</div>
                    <div style={{ fontSize: '.6rem', color: 'var(--dim)' }}>
                      {h.platforms.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(', ')}
                    </div>
                    <div style={{ fontSize: '.58rem', color: 'var(--green)', marginTop: 3 }}>
                      ● {h.status.toUpperCase()} — {new Date(h.ts).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>

              <div className="panel">
                <div className="ph">&#128279; Quick Links</div>
                <div className="dCard tip">
                  <div className="dCardHead">Route from Anywhere</div>
                  Create in Lyrics Studio → Analyze with Beat Detection → Distribute via Portals. All pages are connected.
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
                  <button className="btn btnP btnSm btnFull" onClick={() => setPage('lyrics')}>&#9998; Write Lyrics</button>
                  <button className="btn btnO btnSm btnFull" onClick={() => setPage('create')}>&#9835; Create Music</button>
                  <button className="btn btnB btnSm btnFull" onClick={() => setPage('analyze')}>&#128200; Analyze Audio</button>
                  <button className="btn btnG btnSm btnFull" onClick={() => setPage('library')}>&#127925; My Library</button>
                  <button className="btn btnPk btnSm btnFull" onClick={() => setPage('trending')}>&#128293; Trending</button>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
