/* Mix & Master Page — Channel mixer + real fade in/out */

import * as engine from '../engine.js';
import * as state from '../state.js';
import { navigate } from '../router.js';
import { icon } from '../icons.js';
import * as voices from '../voices.js';

const CHANNELS = [
  { name: 'Drums', color: 'var(--orange)', vol: 0 },
  { name: 'Bass', color: 'var(--purple)', vol: -2 },
  { name: 'Synth', color: 'var(--blue)', vol: -4 },
  { name: 'Vocal', color: 'var(--pink)', vol: 0 },
  { name: 'FX', color: 'var(--cyan)', vol: -6 },
  { name: 'Pads', color: 'var(--green)', vol: -8 },
];

export function render() {
  return `
    <div class="scroll-page">

      <!-- FADE IN / OUT -->
      <div class="panel" style="background:linear-gradient(135deg,rgba(168,85,247,.06),rgba(124,58,237,.03));border-color:rgba(168,85,247,.2)">
        <div class="panel-header">${icon('activity', 16)} Song Fade Controls
          <span class="panel-header-right">Real-time gain ramps via Web Audio</span>
        </div>
        <div class="grid-2" style="margin-bottom:8px">
          <div>
            <div class="slider-row">
              <label style="min-width:70px">Fade In</label>
              <input type="range" id="fade-in" min="0" max="10" value="2" step="0.5"/>
              <span class="slider-val" id="fade-in-val">2.0s</span>
            </div>
            <button class="btn btn-green btn-sm btn-full" id="btn-fade-in">${icon('play', 12)} Apply Fade In</button>
          </div>
          <div>
            <div class="slider-row">
              <label style="min-width:70px">Fade Out</label>
              <input type="range" id="fade-out" min="0" max="10" value="3" step="0.5"/>
              <span class="slider-val" id="fade-out-val">3.0s</span>
            </div>
            <button class="btn btn-red btn-sm btn-full" id="btn-fade-out">${icon('stop', 12)} Apply Fade Out</button>
          </div>
        </div>
        <div class="grid-2">
          <div>
            <div class="slider-row">
              <label style="min-width:90px">Crossfade</label>
              <input type="range" id="crossfade" min="0" max="10" value="4" step="0.5"/>
              <span class="slider-val" id="crossfade-val">4.0s</span>
            </div>
          </div>
          <div style="display:flex;gap:3px;align-items:end">
            <button class="btn btn-primary btn-sm" id="btn-play-faded">${icon('play', 12)} Play with Fade In</button>
            <button class="btn btn-orange btn-sm" id="btn-stop-faded">${icon('stop', 12)} Fade Out &amp; Stop</button>
          </div>
        </div>
        <div class="status-text" id="fade-status"></div>

        <!-- Fade curve visualiser -->
        <canvas id="fade-canvas" style="width:100%;height:60px;border-radius:6px;background:rgba(5,8,20,.7);border:1px solid var(--border);display:block;margin-top:6px"></canvas>
      </div>

      <!-- GRANULAR ENGINE -->
      <div class="panel" style="border-color:rgba(56,189,248,.22);background:linear-gradient(135deg,rgba(56,189,248,.06),rgba(168,85,247,.03))">
        <div class="panel-header">${icon('waveform', 16)} Granular Engine
          <span class="panel-header-right">Buffer-based texture playback</span>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:10px">
          <label style="display:flex;gap:8px;align-items:center;font-size:.76rem;color:var(--text)">
            <input type="checkbox" id="granular-enabled" style="accent-color:var(--blue)"/>
            Enable Granular Mode
          </label>
          <div class="status-text" id="granular-status" style="margin-top:0"></div>
        </div>
        <div class="grid-2" style="margin-bottom:8px">
          <div>
            <div class="slider-row">
              <label>Grain</label>
              <input type="range" id="gran-grain" min="20" max="300" value="120" step="10"/>
              <span class="slider-val" id="gran-grain-val">120ms</span>
            </div>
          </div>
          <div>
            <div class="slider-row">
              <label>Density</label>
              <input type="range" id="gran-density" min="1" max="60" value="20" step="1"/>
              <span class="slider-val" id="gran-density-val">20/s</span>
            </div>
          </div>
        </div>
        <div class="grid-2" style="margin-bottom:8px">
          <div>
            <div class="slider-row">
              <label>Position</label>
              <input type="range" id="gran-pos" min="0" max="100" value="20" step="1"/>
              <span class="slider-val" id="gran-pos-val">20%</span>
            </div>
          </div>
          <div>
            <div class="slider-row">
              <label>Spread</label>
              <input type="range" id="gran-spread" min="0" max="100" value="50" step="1"/>
              <span class="slider-val" id="gran-spread-val">50%</span>
            </div>
          </div>
        </div>
        <div class="grid-2" style="margin-bottom:8px">
          <div>
            <div class="slider-row">
              <label>Rate</label>
              <input type="range" id="gran-rate" min="0.5" max="2" value="1" step="0.1"/>
              <span class="slider-val" id="gran-rate-val">1.0×</span>
            </div>
          </div>
          <div style="display:flex;gap:8px;align-items:flex-end">
            <button class="btn btn-blue btn-sm btn-full" id="btn-gran-play">${icon('play', 12)} Play Granular</button>
          </div>
        </div>
      </div>

      <!-- CHANNEL MIXER -->
      <div class="panel">
        <div class="panel-header">${icon('sliders', 16)} Channel Mixer</div>
        <div id="mixer-channels">
          ${CHANNELS.map((ch, i) => `
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;padding:6px 8px;border-radius:7px;border:1px solid var(--border)">
              <span style="width:50px;font-size:.65rem;font-weight:700;color:${ch.color}">${ch.name}</span>
              <button class="btn btn-ghost btn-sm mixer-solo" data-ch="${i}" style="font-size:.66rem;padding:6px 10px">${icon('play', 12)} Solo</button>
              <button class="btn btn-ghost btn-sm mixer-mute" data-ch="${i}" style="font-size:.66rem;padding:6px 10px">${icon('stop', 12)} Mute</button>
              <input type="range" min="-24" max="6" value="${ch.vol}" style="flex:1" data-ch-vol="${i}"/>
              <div style="width:60px;height:5px;background:rgba(168,85,247,.1);border-radius:3px;overflow:hidden">
                <div class="meter" data-meter="${i}" style="width:${40 + Math.random() * 40}%;height:100%;background:linear-gradient(90deg,var(--green),var(--yellow),var(--red));border-radius:3px;transition:width .1s"></div>
              </div>
              <span style="width:36px;font-size:.56rem;color:var(--purple);text-align:right;font-weight:600" data-ch-label="${i}">${ch.vol} dB</span>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- VOCAL LANGUAGE & VOICE PREVIEW -->
      <div class="panel" style="border-color:rgba(236,72,153,.22);background:linear-gradient(135deg,rgba(236,72,153,.06),rgba(168,85,247,.03))">
        <div class="panel-header">${icon('mic', 16)} Vocal Language & Voice Preview
          <span class="panel-header-right">Real browser TTS voices</span>
        </div>
        <div style="margin-bottom:8px">
          <label>Filter by Language</label>
          <select id="mixer-lang-filter" style="margin-bottom:4px"></select>
        </div>
        <div id="mixer-voice-list" style="max-height:220px;overflow-y:auto"></div>
        <div class="status-text" id="mixer-voice-status"></div>
      </div>

      <!-- MASTER BUS -->
      <div class="panel">
        <div class="panel-header">${icon('volumeUp', 16)} Master Bus</div>
        <div class="slider-row">
          <label>Drive</label>
          <input type="range" min="0" max="100" value="20"/>
          <span class="slider-val">20%</span>
        </div>
        <div class="slider-row">
          <label>Width</label>
          <input type="range" min="0" max="100" value="70"/>
          <span class="slider-val">70%</span>
        </div>
        <div class="slider-row">
          <label>Limiter</label>
          <input type="range" min="0" max="100" value="82"/>
          <span class="slider-val">82%</span>
        </div>
        <div class="slider-row">
          <label>Output</label>
          <input type="range" min="0" max="100" value="80" id="master-vol"/>
          <span class="slider-val" id="master-vol-val">80%</span>
        </div>
      </div>

      <!-- EFFECTS -->
      <div class="panel">
        <div class="panel-header">${icon('settings', 16)} Effects Chain</div>
        <div class="pills">
          <button class="pill active">Reverb</button>
          <button class="pill">Delay</button>
          <button class="pill active">Compressor</button>
          <button class="pill">EQ</button>
          <button class="pill">Chorus</button>
          <button class="pill active">Limiter</button>
          <button class="pill">Saturation</button>
          <button class="pill">Stereo Enhancer</button>
        </div>
      </div>

      <!-- TRANSPORT -->
      <div class="transport" style="margin-top:8px">
        <button class="btn btn-green" id="btn-mix-play">${icon('play', 14)} Play</button>
        <button class="btn btn-red" id="btn-mix-stop">${icon('stop', 14)} Stop</button>
        <button class="btn btn-blue" data-goto="mureka">${icon('download', 14)} Export</button>
        <button class="btn btn-primary" data-goto="covers">${icon('disc', 14)} Album Art</button>
        <button class="btn btn-orange" data-goto="video">${icon('disc', 14)} Video</button>
      </div>
    </div>
  `;
}

let meterTimer = null;
let fadeVizRAF = null;
let mixerSelectedVoice = null;
let mixerVoices = [];
let mixerLang = 'all';

export function init() {
  document.querySelectorAll('[data-ch-vol]').forEach(el => {
    el.addEventListener('input', () => {
      const label = document.querySelector(`[data-ch-label="${el.dataset.chVol}"]`);
      if (label) label.textContent = el.value + ' dB';
    });
  });

  const masterVol = document.getElementById('master-vol');
  const masterLabel = document.getElementById('master-vol-val');
  if (masterVol) {
    masterVol.addEventListener('input', () => {
      if (masterLabel) masterLabel.textContent = masterVol.value + '%';
      const gain = engine.getMasterGain();
      if (gain) gain.gain.value = masterVol.value / 100;
    });
  }

  setupFadeSlider('fade-in', 'fade-in-val');
  setupFadeSlider('fade-out', 'fade-out-val');
  setupFadeSlider('crossfade', 'crossfade-val');

  setupGranSlider('gran-grain', 'gran-grain-val', v => `${v}ms`);
  setupGranSlider('gran-density', 'gran-density-val', v => `${v}/s`);
  setupGranSlider('gran-pos', 'gran-pos-val', v => `${v}%`);
  setupGranSlider('gran-spread', 'gran-spread-val', v => `${v}%`);
  setupGranSlider('gran-rate', 'gran-rate-val', v => `${parseFloat(v).toFixed(1)}×`);

  document.getElementById('btn-fade-in')?.addEventListener('click', applyFadeIn);
  document.getElementById('btn-fade-out')?.addEventListener('click', applyFadeOut);
  document.getElementById('btn-play-faded')?.addEventListener('click', playWithFadeIn);
  document.getElementById('btn-stop-faded')?.addEventListener('click', fadeOutAndStop);

  document.getElementById('btn-mix-play')?.addEventListener('click', () => {
    if (isGranularEnabled()) playWithFadeIn();
    else {
      const ok = engine.play();
      if (!ok) setFadeStatus(engine.getLastPlayError() || 'No audio loaded');
    }
  });
  document.getElementById('btn-mix-stop')?.addEventListener('click', () => engine.stop());

  document.getElementById('btn-gran-play')?.addEventListener('click', () => {
    const status = document.getElementById('granular-status');
    if (!isGranularEnabled()) {
      if (status) status.textContent = 'Enable Granular Mode first.';
      return;
    }
    const buf = engine.getBuffer();
    if (!buf) {
      if (status) status.textContent = 'Load/import an audio file first for granular playback.';
      return;
    }
    playWithFadeIn();
  });

  document.querySelectorAll('.pill').forEach(el => {
    el.addEventListener('click', () => el.classList.toggle('active'));
  });

  document.querySelectorAll('[data-goto]').forEach(el => {
    el.addEventListener('click', () => navigate(el.dataset.goto));
  });

  meterTimer = setInterval(() => {
    const fd = engine.getFrequencyData();
    document.querySelectorAll('[data-meter]').forEach(el => {
      const idx = parseInt(el.dataset.meter);
      const val = fd.length > idx * 40 ? fd[idx * 40] / 255 * 80 + 10 : 30 + Math.random() * 50;
      el.style.width = val + '%';
    });
  }, 100);

  drawFadeCurve();

  loadMixerVoices();
}

export function destroy() {
  try { engine.stop(); } catch {}
  try { voices.stopSpeaking(); } catch {}
  if (meterTimer) clearInterval(meterTimer);
  if (fadeVizRAF) cancelAnimationFrame(fadeVizRAF);
  meterTimer = null;
  fadeVizRAF = null;
}

function setupFadeSlider(inputId, valId) {
  const input = document.getElementById(inputId);
  const val = document.getElementById(valId);
  if (input && val) {
    input.addEventListener('input', () => {
      val.textContent = parseFloat(input.value).toFixed(1) + 's';
      drawFadeCurve();
    });
  }
}

function setupGranSlider(inputId, valId, fmt) {
  const input = document.getElementById(inputId);
  const val = document.getElementById(valId);
  if (!input || !val) return;
  const apply = () => { val.textContent = fmt ? fmt(input.value) : input.value; };
  apply();
  input.addEventListener('input', apply);
}

function isGranularEnabled() {
  return !!document.getElementById('granular-enabled')?.checked;
}

function getGranularOpts() {
  return {
    grainSizeMs: +(document.getElementById('gran-grain')?.value || 120),
    density: +(document.getElementById('gran-density')?.value || 20),
    positionPct: +(document.getElementById('gran-pos')?.value || 20),
    spreadPct: +(document.getElementById('gran-spread')?.value || 50),
    playbackRate: +(document.getElementById('gran-rate')?.value || 1),
  };
}

async function loadMixerVoices() {
  const status = document.getElementById('mixer-voice-status');
  const selectEl = document.getElementById('mixer-lang-filter');
  if (!selectEl) return;

  try {
    if (status) status.textContent = 'Loading voices...';
    await voices.loadVoices();
    mixerVoices = voices.getVoices();
    const byLang = voices.getVoicesByLanguage();

    selectEl.innerHTML = '<option value="all">All Languages (' + mixerVoices.length + ')</option>';
    for (const [lang, voiceList] of Object.entries(byLang)) {
      selectEl.innerHTML += `<option value="${lang}">${lang} (${voiceList.length})</option>`;
    }

    mixerLang = 'all';
    if (status) status.textContent = `${mixerVoices.length} voices ready`;
    renderMixerVoiceList();

    selectEl.addEventListener('change', () => {
      mixerLang = selectEl.value || 'all';
      renderMixerVoiceList();
    });

  } catch (e) {
    if (status) status.textContent = 'Voice load failed';
    console.error('[Mixer] load voices failed:', e);
  }
}

function renderMixerVoiceList() {
  const listEl = document.getElementById('mixer-voice-list');
  if (!listEl) return;

  const byLang = voices.getVoicesByLanguage();
  let voicesToShow = [];
  if (mixerLang === 'all') voicesToShow = mixerVoices;
  else voicesToShow = byLang[mixerLang] || [];

  if (!voicesToShow.length) {
    listEl.innerHTML = '<div style="text-align:center;color:var(--dim);padding:12px;font-size:.66rem">No voices found</div>';
    return;
  }

  listEl.innerHTML = voicesToShow.map((v, i) => {
    const isSelected = mixerSelectedVoice === v;
    const isLocal = v.localService;
    return `
      <div class="track-row voice-row${isSelected ? ' selected' : ''}" style="${isSelected ? 'border-color:var(--green);background:rgba(34,197,94,.06)' : ''}">
        <button class="btn btn-green btn-sm mixer-voice-preview" data-vpi="${i}">${icon('play', 11)} Preview</button>
        <div class="track-info">
          <div class="track-title" style="font-size:.66rem">${v.name}</div>
          <div class="track-meta">${v.lang} · ${isLocal ? 'Local' : 'Network'}</div>
        </div>
        <button class="btn ${isSelected ? 'btn-green' : 'btn-primary'} btn-sm mixer-voice-select" data-vsi="${i}">
          ${isSelected ? icon('check', 11) + ' Selected' : 'Select'}
        </button>
      </div>
    `;
  }).join('');

  listEl.querySelectorAll('.mixer-voice-preview').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.vpi);
      const v = voicesToShow[idx];
      if (v) voices.previewVoice(v);
    });
  });

  listEl.querySelectorAll('.mixer-voice-select').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.vsi);
      const v = voicesToShow[idx];
      if (v) mixerSelectedVoice = v;
      renderMixerVoiceList();
    });
  });
}

function applyFadeIn() {
  const dur = parseFloat(document.getElementById('fade-in')?.value || '2');
  const gain = engine.getMasterGain();
  if (!gain) { setFadeStatus('Start playback first'); return; }
  const ctx = engine.getContext();
  const now = ctx.currentTime;
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.8, now + dur);
  setFadeStatus(`Fade in: 0 → 0.8 over ${dur}s`);
  state.log('Mixer', `Applied fade in: ${dur}s`);
}

function applyFadeOut() {
  const dur = parseFloat(document.getElementById('fade-out')?.value || '3');
  const gain = engine.getMasterGain();
  if (!gain) { setFadeStatus('Start playback first'); return; }
  const ctx = engine.getContext();
  const now = ctx.currentTime;
  const currentVol = gain.gain.value;
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(currentVol, now);
  gain.gain.linearRampToValueAtTime(0, now + dur);
  setFadeStatus(`Fade out: ${currentVol.toFixed(2)} → 0 over ${dur}s`);
  state.log('Mixer', `Applied fade out: ${dur}s`);
}

function playWithFadeIn() {
  const dur = parseFloat(document.getElementById('fade-in')?.value || '2');
  const gain = engine.getMasterGain();
  if (gain) {
    const ctx = engine.getContext();
    gain.gain.cancelScheduledValues(ctx.currentTime);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.8, ctx.currentTime + dur);
  }
  let ok = false;
  if (isGranularEnabled()) {
    ok = engine.playGranular(getGranularOpts());
  } else {
    ok = engine.play();
  }
  if (!ok) {
    setFadeStatus(engine.getLastPlayError() || 'No audio loaded');
    return;
  }
  setFadeStatus(`Playing with ${dur}s fade in`);
  state.log('Mixer', `Play with fade in: ${dur}s`);
}

function fadeOutAndStop() {
  const dur = parseFloat(document.getElementById('fade-out')?.value || '3');
  const delay = parseFloat(document.getElementById('crossfade')?.value || '0');
  const gain = engine.getMasterGain();
  if (!gain) { engine.stop(); return; }
  const ctx = engine.getContext();
  const now = ctx.currentTime;
  const currentVol = gain.gain.value;
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(currentVol, now);
  const startFadeAt = now + delay;
  gain.gain.setValueAtTime(currentVol, startFadeAt);
  gain.gain.linearRampToValueAtTime(0, startFadeAt + dur);
  setTimeout(() => {
    engine.stop();
    gain.gain.cancelScheduledValues(engine.getContext().currentTime);
    gain.gain.setValueAtTime(0.8, engine.getContext().currentTime);
  }, (delay + dur) * 1000 + 120);
  setFadeStatus(`Hold ${delay.toFixed(1)}s → fade out ${dur.toFixed(1)}s → stop`);
  state.log('Mixer', `Fade out & stop: hold ${delay}s then ${dur}s`);
}

function drawFadeCurve() {
  const canvas = document.getElementById('fade-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const w = rect.width, h = rect.height;
  ctx.clearRect(0, 0, w, h);

  const fadeIn = parseFloat(document.getElementById('fade-in')?.value || '2');
  const fadeOut = parseFloat(document.getElementById('fade-out')?.value || '3');
  const total = 10;
  const fiEnd = (fadeIn / total) * w;
  const foStart = w - (fadeOut / total) * w;

  ctx.strokeStyle = 'rgba(168,85,247,.15)';
  ctx.lineWidth = 1;
  for (let y = 0; y < h; y += h / 4) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(fiEnd, h * 0.15);
  ctx.lineTo(foStart, h * 0.15);
  ctx.lineTo(w, h);
  ctx.strokeStyle = 'rgba(34,197,94,.7)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fillStyle = 'rgba(34,197,94,.08)';
  ctx.fill();

  ctx.fillStyle = 'rgba(34,197,94,.6)';
  ctx.font = '10px -apple-system, sans-serif';
  ctx.fillText(`${fadeIn}s`, fiEnd / 2, h - 4);
  ctx.fillText(`${fadeOut}s`, (foStart + w) / 2, h - 4);
  ctx.fillStyle = 'rgba(168,85,247,.5)';
  ctx.fillText('sustain', (fiEnd + foStart) / 2, h - 4);
}

function setFadeStatus(msg) {
  const el = document.getElementById('fade-status');
  if (el) el.textContent = msg;
}
