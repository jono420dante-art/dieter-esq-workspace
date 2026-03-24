/* Lyrics Studio Page — Real voices, real languages, lyrics-to-song */

import * as state from '../state.js';
import * as engine from '../engine.js';
import * as voices from '../voices.js';
import { navigate } from '../router.js';
import { icon } from '../icons.js';

let selectedVoice = null;
let currentLangFilter = 'all';
let vizRAF = null;
let liveWindow = null;

export function render() {
  return `
    <div class="split">
      <div class="split-left">
        <div class="panel">
          <div class="panel-header">${icon('lyrics', 16)} Write Your Lyrics</div>
          <textarea id="lyrics-text" placeholder="Start typing your lyrics here..." style="min-height:200px;font-family:'SF Mono','Cascadia Code',monospace;font-size:.72rem;line-height:1.8"></textarea>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px">
            <span id="lyrics-count" style="font-size:.54rem;color:var(--dim)">0 lines · 0 words</span>
            <div style="display:flex;gap:4px;align-items:center">
              <span id="lyrics-structure" style="font-size:.54rem;color:var(--purple)"></span>
              <button class="btn btn-ghost btn-sm" id="btn-clear-lyrics" title="Clear lyrics">${icon('x', 12)} Clear</button>
            </div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-header">${icon('mic', 16)} Real Voices <span class="panel-header-right" id="voice-count">Loading...</span></div>
          <div style="margin-bottom:6px">
            <label>Filter by Language</label>
            <select id="lang-filter" style="margin-bottom:4px"><option value="all">All Languages</option></select>
          </div>
          <div id="voice-list" style="max-height:220px;overflow-y:auto"></div>
        </div>

        <div class="panel">
          <div class="panel-header">${icon('music', 16)} Song Settings</div>
          <div class="grid-2">
            <div><label>Genre / Melody</label>
              <select id="lyrics-genre">
                <option value="pop">Pop</option><option value="hiphop">Hip Hop</option><option value="rnb">R&B</option>
                <option value="afrobeat">Afrobeat</option><option value="synthwave">Synthwave</option><option value="lofi">Lo-fi</option>
                <option value="rock">Rock</option><option value="ballad">Ballad</option>
                <option value="house">House</option><option value="trap">Trap</option><option value="drill">Drill</option>
                <option value="techno">Techno</option><option value="phonk">Phonk</option><option value="amapiano">Amapiano</option>
                <option value="jazz">Jazz</option><option value="reggaeton">Reggaeton</option><option value="classical">Classical</option>
                <option value="edm">EDM</option><option value="dancehall">Dancehall</option><option value="gospel">Gospel</option>
                <option value="country">Country</option><option value="soul">Soul</option><option value="funk">Funk</option>
                <option value="metal">Metal</option><option value="ambient">Ambient</option>
              </select>
            </div>
            <div><label>Mood</label>
              <select id="lyrics-mood">
                <option>Energetic</option><option>Chill</option><option>Dark</option><option>Uplifting</option>
                <option>Romantic</option><option>Aggressive</option><option>Dreamy</option><option>Melancholic</option>
              </select>
            </div>
          </div>
          <div class="slider-row" style="margin-top:8px">
            <label>BPM</label>
            <input type="range" id="lyrics-bpm" min="60" max="200" value="120"/>
            <span class="slider-val" id="lyrics-bpm-val">120</span>
          </div>
          <div class="slider-row">
            <label>Pitch</label>
            <input type="range" id="lyrics-pitch" min="0.5" max="2" value="1" step="0.1"/>
            <span class="slider-val" id="lyrics-pitch-val">1.0</span>
          </div>
          <div class="slider-row">
            <label>Speed</label>
            <input type="range" id="lyrics-rate" min="0.3" max="2" value="0.9" step="0.1"/>
            <span class="slider-val" id="lyrics-rate-val">0.9</span>
          </div>
        </div>

        <div style="display:flex;gap:4px">
          <button class="action-btn" id="btn-sing-lyrics" style="flex:1">${icon('music', 16)} Sing Lyrics</button>
          <button class="action-btn" id="btn-speak-lyrics" style="flex:1;background:linear-gradient(135deg,var(--blue),#0ea5e9)">${icon('mic', 16)} Speak Lyrics</button>
        </div>
        <button class="btn btn-red btn-sm btn-full" id="btn-stop-voice" style="margin-top:4px">${icon('stop', 13)} Stop</button>
        <div class="status-text" id="lyrics-status"></div>
      </div>

      <div class="split-right">
        <div class="panel">
          <div class="panel-header">${icon('volumeUp', 16)} Live Preview</div>
          <canvas id="lyrics-viz" class="wave-canvas" style="height:90px"></canvas>
          <div class="transport">
            <button class="btn btn-green btn-sm" id="btn-lyrics-play">${icon('play', 13)} Play</button>
            <button class="btn btn-ghost btn-sm" id="btn-lyrics-pause">${icon('pause', 13)}</button>
            <button class="btn btn-red btn-sm" id="btn-lyrics-stop">${icon('stop', 13)} Stop</button>
          </div>
        </div>

        <div class="panel">
          <div class="panel-header">${icon('mic', 16)} Selected Voice</div>
          <div id="selected-voice-info">
            <div style="text-align:center;color:var(--dim);padding:14px;font-size:.68rem">Select a voice from the left panel</div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-header">${icon('disc', 16)} Generated Songs <span class="panel-header-right" id="song-count">0</span></div>
          <div id="song-list"></div>
        </div>

        <div class="panel">
          <div class="panel-header">${icon('zap', 16)} Voice Tips</div>
          <div class="news-card"><div class="news-title">Song Structure</div>
          <div class="news-body">Use [Verse], [Chorus], [Bridge] tags. Section headers are skipped during singing. Hit formula: V→C→V→C→Bridge→C.</div></div>
          <div class="news-card"><div class="news-title">Multi-Language</div>
          <div class="news-body">Write lyrics in any language — select a matching voice and the engine will sing/speak in that language natively.</div></div>
          <div class="news-card"><div class="news-title">Singing vs Speaking</div>
          <div class="news-body"><b>Sing</b> = voice follows a melody matched to your genre. <b>Speak</b> = natural speech rhythm, great for rap/spoken word.</div></div>
        </div>
      </div>
    </div>
  `;
}

export function init() {
  const textarea = document.getElementById('lyrics-text');
  if (textarea) {
    textarea.addEventListener('input', updateCounts);
    textarea.addEventListener('focus', () => {
      textarea.setAttribute('placeholder', '');
    });
    textarea.addEventListener('blur', () => {
      if (!textarea.value.trim()) {
        textarea.setAttribute('placeholder', 'Start typing your lyrics here...');
      }
    });
  }

  document.getElementById('btn-clear-lyrics')?.addEventListener('click', () => {
    const ta = document.getElementById('lyrics-text');
    if (ta) { ta.value = ''; ta.focus(); updateCounts(); }
  });

  setupSlider('lyrics-bpm', 'lyrics-bpm-val');
  setupSlider('lyrics-pitch', 'lyrics-pitch-val', v => parseFloat(v).toFixed(1));
  setupSlider('lyrics-rate', 'lyrics-rate-val', v => parseFloat(v).toFixed(1));

  document.getElementById('btn-sing-lyrics')?.addEventListener('click', handleSing);
  document.getElementById('btn-speak-lyrics')?.addEventListener('click', handleSpeak);
  document.getElementById('btn-stop-voice')?.addEventListener('click', () => {
    voices.stopSpeaking();
    engine.stop();
    voices.setCallbacks({});
    if (liveWindow && !liveWindow.closed) liveWindow.close();
    liveWindow = null;
    setStatus('Stopped');
  });

  document.getElementById('btn-lyrics-play')?.addEventListener('click', () => {
    engine.setGenre(document.getElementById('lyrics-genre')?.value || 'pop');
    const ok = engine.play();
    if (!ok) setStatus(engine.getLastPlayError() || 'Load audio in Create or Beats first.');
  });
  document.getElementById('btn-lyrics-pause')?.addEventListener('click', () => engine.pause());
  document.getElementById('btn-lyrics-stop')?.addEventListener('click', () => {
    engine.stop();
    voices.stopSpeaking();
    voices.setCallbacks({});
    if (liveWindow && !liveWindow.closed) liveWindow.close();
    liveWindow = null;
  });

  document.getElementById('lang-filter')?.addEventListener('change', renderVoiceList);

  loadRealVoices();
  renderSongs();
  tryApplyMurekaDraftToLyrics();
  startViz();
}

function tryApplyMurekaDraftToLyrics() {
  try {
    const raw = sessionStorage.getItem('dp-mureka-draft');
    if (!raw) return;
    const d = JSON.parse(raw);
    const ta = document.getElementById('lyrics-text');
    if (ta && !ta.value.trim()) {
      if (d.instrumental) {
        ta.value = '[Instrumental section — optional vocal chops]\n';
      } else if (d.lyrics) {
        ta.value = d.lyrics;
      }
      if (ta.value) updateCounts();
    }
  } catch { /* ignore */ }
}

export function destroy() {
  if (vizRAF) cancelAnimationFrame(vizRAF);
  vizRAF = null;
  voices.setCallbacks({});
  if (liveWindow && !liveWindow.closed) liveWindow.close();
  liveWindow = null;
}

async function loadRealVoices() {
  const countEl = document.getElementById('voice-count');
  if (countEl) countEl.textContent = 'Loading...';

  await voices.loadVoices();
  const allVoices = voices.getVoices();
  if (countEl) countEl.textContent = `${allVoices.length} real voices`;

  const byLang = voices.getVoicesByLanguage();
  const langSelect = document.getElementById('lang-filter');
  if (langSelect) {
    langSelect.innerHTML = '<option value="all">All Languages (' + allVoices.length + ')</option>';
    for (const [lang, voiceList] of Object.entries(byLang)) {
      langSelect.innerHTML += `<option value="${lang}">${lang} (${voiceList.length})</option>`;
    }
  }

  renderVoiceList();
}

function renderVoiceList() {
  const container = document.getElementById('voice-list');
  if (!container) return;

  const filter = document.getElementById('lang-filter')?.value || 'all';
  const byLang = voices.getVoicesByLanguage();
  let voicesToShow = [];

  if (filter === 'all') {
    voicesToShow = voices.getVoices();
  } else {
    voicesToShow = byLang[filter] || [];
  }

  if (!voicesToShow.length) {
    container.innerHTML = '<div style="text-align:center;color:var(--dim);padding:12px;font-size:.66rem">No voices found</div>';
    return;
  }

  container.innerHTML = voicesToShow.map((v, i) => {
    const isSelected = selectedVoice === v;
    const isLocal = v.localService;
    return `
      <div class="track-row voice-row${isSelected ? ' selected' : ''}" data-vidx="${i}" style="${isSelected ? 'border-color:var(--green);background:rgba(34,197,94,.06)' : ''}">
        <button class="btn btn-green btn-sm voice-preview-btn" data-vpi="${i}" title="Preview this voice">${icon('play', 11)}</button>
        <div class="track-info">
          <div class="track-title" style="font-size:.66rem">${v.name}</div>
          <div class="track-meta">${v.lang} · ${isLocal ? 'Local' : 'Network'} · ${v.default ? 'Default' : ''}</div>
        </div>
        <button class="btn ${isSelected ? 'btn-green' : 'btn-primary'} btn-sm voice-select-btn" data-vsi="${i}">${isSelected ? icon('check', 11) + ' Selected' : 'Select'}</button>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.voice-preview-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.vpi);
      const v = voicesToShow[idx];
      if (v) voices.previewVoice(v);
    });
  });

  container.querySelectorAll('.voice-select-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.vsi);
      const v = voicesToShow[idx];
      if (v) {
        selectedVoice = v;
        renderVoiceList();
        renderSelectedVoice(v);
      }
    });
  });
}

function renderSelectedVoice(v) {
  const el = document.getElementById('selected-voice-info');
  if (!el) return;
  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;padding:6px">
      <div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,var(--purple),var(--violet));display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0">${icon('mic', 20)}</div>
      <div style="flex:1">
        <div style="font-weight:800;font-size:.78rem">${v.name}</div>
        <div style="font-size:.58rem;color:var(--dim)">Language: ${v.lang} · ${v.localService ? 'Built-in (offline)' : 'Network voice'}</div>
        <div style="margin-top:4px;display:flex;gap:3px">
          <button class="btn btn-green btn-sm" id="btn-preview-sel">${icon('play', 11)} Preview</button>
          <button class="btn btn-primary btn-sm" id="btn-test-sing">${icon('music', 11)} Test Sing</button>
        </div>
      </div>
    </div>
  `;
  document.getElementById('btn-preview-sel')?.addEventListener('click', () => voices.previewVoice(v));
  document.getElementById('btn-test-sing')?.addEventListener('click', () => {
    const g = document.getElementById('lyrics-genre')?.value || 'pop';
    engine.setGenre(g);
    voices.singLyrics("La la la, singing a melody for you\nThis is how the voice sounds when it sings", v, {
      genre: g,
      mood: document.getElementById('lyrics-mood')?.value || 'Energetic',
      bpm: +(document.getElementById('lyrics-bpm')?.value || 120),
    });
  });
}

async function handleSing() {
  const text = document.getElementById('lyrics-text')?.value?.trim();
  if (!text) { setStatus('Write lyrics first!'); return; }
  if (!selectedVoice) { setStatus('Select a voice first!'); return; }

  const genre = document.getElementById('lyrics-genre')?.value || 'pop';
  const mood = document.getElementById('lyrics-mood')?.value || 'Energetic';
  const bpm = +(document.getElementById('lyrics-bpm')?.value || 120);
  const btn = document.getElementById('btn-sing-lyrics');
  if (btn) btn.disabled = true;
  setStatus(`Singing with ${selectedVoice.name} · ${genre} · ${mood} · ${bpm} BPM...`);
  engine.setGenre(genre);

  openLiveWindow(text, genre, mood, bpm, 'sing');

  try {
    await voices.singLyrics(text, selectedVoice, { genre, mood, bpm });
    setStatus(`Done singing with ${selectedVoice.name}!`);
    saveSong(text, 'sung');
  } catch (e) {
    setStatus('Error: ' + e.message);
  }
  if (btn) btn.disabled = false;
}

async function handleSpeak() {
  const text = document.getElementById('lyrics-text')?.value?.trim();
  if (!text) { setStatus('Write lyrics first!'); return; }
  if (!selectedVoice) { setStatus('Select a voice first!'); return; }

  const pitch = parseFloat(document.getElementById('lyrics-pitch')?.value || 1);
  const rate = parseFloat(document.getElementById('lyrics-rate')?.value || 0.9);
  const btn = document.getElementById('btn-speak-lyrics');
  if (btn) btn.disabled = true;
  setStatus(`Speaking with ${selectedVoice.name}...`);

  openLiveWindow(text, document.getElementById('lyrics-genre')?.value || 'pop', 'Chill', 90, 'speak');

  try {
    await voices.speakLyrics(text, selectedVoice, { pitch, rate });
    setStatus(`Done speaking with ${selectedVoice.name}!`);
    saveSong(text, 'spoken');
  } catch (e) {
    setStatus('Error: ' + e.message);
  }
  if (btn) btn.disabled = false;
}

function openLiveWindow(lyricsText, genre, mood, bpm, mode) {
  if (liveWindow && !liveWindow.closed) liveWindow.close();

  const w = 820, h = 600;
  const left = (screen.width - w) / 2, top = (screen.height - h) / 2;
  liveWindow = window.open('', 'dieter-live', `width=${w},height=${h},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`);
  if (!liveWindow) { setStatus('Popup blocked — allow popups for live lyrics window'); return; }

  const allLines = lyricsText.split('\n').filter(l => l.trim());

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>DIETER PRO — Live Lyrics</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#06060c;color:#e5e7eb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;overflow:hidden;height:100vh;display:flex;flex-direction:column}
.top{display:flex;align-items:center;justify-content:space-between;padding:12px 20px;background:rgba(8,10,22,.95);border-bottom:1px solid rgba(168,85,247,.15)}
.title{font-size:13px;font-weight:800;color:#c084fc}
.meta{font-size:10px;color:#6b7280}
.badge{font-size:9px;padding:2px 8px;border-radius:99px;border:1px solid #22c55e;color:#22c55e;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
.main{flex:1;display:flex;overflow:hidden}
.viz{width:200px;flex-shrink:0;background:rgba(5,8,20,.8);border-right:1px solid rgba(168,85,247,.1);display:flex;align-items:center;justify-content:center;position:relative}
.viz canvas{width:100%;height:100%}
.lyrics-panel{flex:1;overflow-y:auto;padding:24px 30px;scroll-behavior:smooth}
.line{padding:8px 14px;border-radius:8px;margin-bottom:4px;font-size:18px;line-height:1.7;transition:all .3s ease;color:#4b5563;font-weight:400}
.line.active{color:#e5e7eb;font-weight:700;font-size:22px;background:rgba(168,85,247,.08);border-left:3px solid #a855f7}
.line.done{color:#6b7280;font-weight:400;font-size:18px}
.line.section{color:#a855f7;font-size:13px;font-weight:600;letter-spacing:.15em;text-transform:uppercase;padding:12px 14px 4px;border-left:none;background:none}
.word{display:inline;transition:color .15s,text-shadow .15s}
.word.active{color:#a855f7;text-shadow:0 0 20px rgba(168,85,247,.5)}
.word.done{color:#9ca3af}
.now-singing{position:absolute;bottom:12px;left:0;right:0;text-align:center;font-size:11px;color:#22c55e;font-weight:700}
.footer{padding:8px 16px;background:rgba(8,10,22,.95);border-top:1px solid rgba(168,85,247,.1);display:flex;justify-content:space-between;align-items:center}
.footer-text{font-size:9px;color:#4b5563}
.stop-btn{background:linear-gradient(135deg,#ef4444,#dc2626);color:#fff;border:none;padding:5px 14px;border-radius:99px;font-size:11px;font-weight:700;cursor:pointer}
.stop-btn:hover{filter:brightness(1.2)}
::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:rgba(168,85,247,.2);border-radius:3px}
</style></head><body>
<div class="top">
  <div class="title">DIETER PRO — Live ${mode === 'sing' ? 'Singing' : 'Speaking'}</div>
  <div class="meta">${genre} · ${mood} · ${bpm} BPM</div>
  <div class="badge">● LIVE</div>
</div>
<div class="main">
  <div class="viz"><canvas id="viz"></canvas><div class="now-singing" id="now-word"></div></div>
  <div class="lyrics-panel" id="lyrics-panel">
    ${allLines.map((line, i) => {
      if (line.trim().startsWith('[')) {
        return `<div class="line section" data-li="${i}">${line.trim()}</div>`;
      }
      const words = line.trim().split(/\s+/);
      return `<div class="line" data-li="${i}">${words.map((w, wi) => `<span class="word" data-li="${i}" data-wi="${wi}">${w} </span>`).join('')}</div>`;
    }).join('')}
  </div>
</div>
<div class="footer">
  <div class="footer-text">Licensed to EDUARD GEERDES · DIETER PRO Platform</div>
  <button class="stop-btn" id="stop-btn">Stop</button>
</div>
<script>
const vizCanvas = document.getElementById('viz');
const vizCtx = vizCanvas.getContext('2d');
let animId;

function resizeViz(){
  const r = vizCanvas.parentElement.getBoundingClientRect();
  vizCanvas.width = r.width * devicePixelRatio;
  vizCanvas.height = r.height * devicePixelRatio;
  vizCtx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
}
resizeViz();
window.addEventListener('resize', resizeViz);

let activeHue = 270;
function drawViz(){
  animId = requestAnimationFrame(drawViz);
  const w = vizCanvas.width / devicePixelRatio;
  const h = vizCanvas.height / devicePixelRatio;
  vizCtx.clearRect(0,0,w,h);
  const t = performance.now() * 0.002;
  const bars = 16;
  const bw = w / bars;
  for(let i=0;i<bars;i++){
    const v = 0.2 + Math.abs(Math.sin(t + i * 0.5)) * 0.6;
    const hue = activeHue + i * 4;
    vizCtx.fillStyle = 'hsla(' + hue + ',80%,55%,' + (0.3 + v * 0.5) + ')';
    vizCtx.fillRect(i * bw + 2, h - v * h, bw - 4, v * h);
  }
}
drawViz();

document.getElementById('stop-btn').addEventListener('click', function(){
  if(window.opener && window.opener.__dieterStopSinging) window.opener.__dieterStopSinging();
  window.close();
});
<\/script></body></html>`;

  liveWindow.document.open();
  liveWindow.document.write(html);
  liveWindow.document.close();

  window.__dieterStopSinging = () => {
    voices.stopSpeaking();
    engine.stop();
    setStatus('Stopped from live window');
  };

  voices.setCallbacks({
    onWord(lineIdx, wordIdx, word) {
      if (!liveWindow || liveWindow.closed) return;
      try {
        const doc = liveWindow.document;
        doc.querySelectorAll('.word.active').forEach(el => { el.classList.remove('active'); el.classList.add('done'); });
        const wordEl = doc.querySelector(`.word[data-li="${lineIdx}"][data-wi="${wordIdx}"]`);
        if (wordEl) {
          wordEl.classList.add('active');
          wordEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        const nowEl = doc.getElementById('now-word');
        if (nowEl) nowEl.textContent = word;
      } catch {}
    },
    onLine(lineIdx, wordIdx, lineText) {
      if (!liveWindow || liveWindow.closed) return;
      try {
        const doc = liveWindow.document;
        doc.querySelectorAll('.line.active').forEach(el => { el.classList.remove('active'); el.classList.add('done'); });
        const lineEl = doc.querySelector(`.line[data-li="${lineIdx}"]`);
        if (lineEl) {
          lineEl.classList.add('active');
          lineEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      } catch {}
    },
    onDone() {
      if (!liveWindow || liveWindow.closed) return;
      try {
        const doc = liveWindow.document;
        doc.querySelectorAll('.word.active').forEach(el => { el.classList.remove('active'); el.classList.add('done'); });
        doc.querySelectorAll('.line.active').forEach(el => { el.classList.remove('active'); el.classList.add('done'); });
        const nowEl = doc.getElementById('now-word');
        if (nowEl) nowEl.textContent = 'Done!';
        const badge = doc.querySelector('.badge');
        if (badge) { badge.textContent = 'DONE'; badge.style.borderColor = '#a855f7'; badge.style.color = '#a855f7'; }
      } catch {}
    },
  });
}

function saveSong(text, mode) {
  const title = text.split('\n').find(l => l.trim() && !l.startsWith('['))?.slice(0, 40) || 'Untitled';
  const genre = document.getElementById('lyrics-genre')?.value || 'Pop';
  const bpm = +(document.getElementById('lyrics-bpm')?.value || 120);
  const song = {
    id: crypto.randomUUID(), title,
    voice: selectedVoice?.name || 'Default',
    lang: selectedVoice?.lang || 'en',
    genre, bpm, mode,
    ts: Date.now(),
  };
  state.addSong(song);
  state.addToLibrary({
    id: song.id, title, genre, bpm, key: 'Am',
    duration: '3:' + String(Math.floor(Math.random() * 50 + 10)).padStart(2, '0'),
    fav: false, ts: song.ts, source: 'lyrics',
  });
  renderSongs();
  state.log('Lyrics Processor', `${mode === 'sung' ? 'Sang' : 'Spoke'} "${title}" with ${song.voice} (${song.lang})`);
}

function renderSongs() {
  const songs = state.get('songs');
  const countEl = document.getElementById('song-count');
  const listEl = document.getElementById('song-list');
  if (countEl) countEl.textContent = songs.length;
  if (!listEl) return;

  const playIc = icon('play', 12);
  const globeIc = icon('globe', 12);
  listEl.innerHTML = songs.length ? songs.map(s => `
    <div class="track-row">
      <button class="btn btn-green btn-sm song-play-btn">${playIc}</button>
      <div class="track-info">
        <div class="track-title">${s.title}</div>
        <div class="track-meta">${s.voice} · ${s.lang || ''} · ${s.genre} · ${s.bpm} BPM · ${s.mode || 'generated'}</div>
      </div>
      <button class="btn btn-blue btn-sm song-portal-btn">${globeIc}</button>
    </div>
  `).join('') : '<div style="text-align:center;color:var(--dim);padding:18px;font-size:.68rem">Write lyrics, select a voice, and sing or speak!</div>';

  listEl.querySelectorAll('.song-play-btn').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const ok = engine.play();
      if (!ok) setStatus(engine.getLastPlayError() || 'No backing track loaded.');
    });
  });
  listEl.querySelectorAll('.song-portal-btn').forEach(el => {
    el.addEventListener('click', () => navigate('portals'));
  });
}

function updateCounts() {
  const textarea = document.getElementById('lyrics-text');
  if (!textarea) return;
  const t = textarea.value;
  const lines = t.split('\n').filter(l => l.trim()).length;
  const words = t.split(/\s+/).filter(Boolean).length;
  const countEl = document.getElementById('lyrics-count');
  const structEl = document.getElementById('lyrics-structure');
  if (countEl) countEl.textContent = `${lines} lines · ${words} words`;
  if (structEl) structEl.textContent = (t.match(/\[.+?\]/g) || []).join(' → ');
}

function setStatus(msg) {
  const el = document.getElementById('lyrics-status');
  if (el) el.textContent = msg;
}

function setupSlider(inputId, valId, fmt) {
  const input = document.getElementById(inputId);
  const val = document.getElementById(valId);
  if (input && val) {
    input.addEventListener('input', () => { val.textContent = fmt ? fmt(input.value) : input.value; });
  }
}

function startViz() {
  function draw() {
    vizRAF = requestAnimationFrame(draw);
    try {
      const c = document.getElementById('lyrics-viz');
      if (!c) return;
      const ctx = c.getContext('2d');
      if (!ctx) return;
      const dpr = devicePixelRatio || 1;
      const r = c.getBoundingClientRect();
      if (r.width < 10) return;
      c.width = Math.floor(r.width * dpr);
      c.height = Math.floor(r.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const w = r.width, h = r.height;
      ctx.clearRect(0, 0, w, h);

      const speaking = voices.getIsSpeaking() || voices.getIsSinging();

      if (engine.isPlaying() || speaking) {
        const fd = engine.getFrequencyData();
        if (fd.length) {
          const bars = 48;
          const bw = w / bars;
          for (let i = 0; i < bars; i++) {
            const v = fd[i * 4] / 255;
            const hue = speaking ? 150 + i * 2 : 270 + i * 2;
            ctx.fillStyle = `hsla(${hue}, 80%, 55%, ${0.3 + v * 0.5})`;
            ctx.fillRect(i * bw, h - v * h, bw - 1, v * h);
          }
        }
        if (speaking && (!fd.length || fd[0] === 0)) {
          const t = performance.now() * 0.003;
          ctx.strokeStyle = 'rgba(34, 197, 94, .6)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          for (let x = 0; x < w; x += 2) {
            const y = h / 2 + Math.sin(x * 0.06 + t) * 15 * Math.sin(t * 0.5) + Math.sin(x * 0.02 + t * 1.3) * 8;
            if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      } else {
        ctx.strokeStyle = 'rgba(168, 85, 247, .35)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let x = 0; x < w; x += 3) {
          const y = h / 2 + Math.sin((x + performance.now() * 0.02) * 0.035) * 8;
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    } catch { /* safe */ }
  }
  draw();
}
