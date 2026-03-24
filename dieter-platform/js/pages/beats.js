/* Beat Detection Page — Real Web Audio analysis */

import * as state from '../state.js';
import * as engine from '../engine.js';
import { navigate } from '../router.js';
import { icon } from '../icons.js';

export function render() {
  return `
    <div class="scroll-page">
      <div class="panel">
        <div class="panel-header">${icon('activity', 16)} Audio Analysis &amp; Beat Detection</div>
        <div class="drop-zone" id="beat-drop">
          <div class="drop-icon">${icon('music', 36)}</div>
          <div class="drop-text">Drop an audio file or click to browse</div>
          <div class="drop-hint">MP3, WAV, OGG, FLAC — Real beat detection + BPM + Key</div>
        </div>
        <input type="file" id="beat-file-input" accept="audio/*" hidden/>
        <div class="status-text" id="beat-status">Drop a file to begin analysis</div>
      </div>

      <div id="beat-results" style="display:none">
        <div class="panel">
          <div class="panel-header">${icon('waveform', 16)} Waveform + Beats <span class="panel-header-right" id="beat-filename"></span></div>
          <canvas id="beat-canvas" class="wave-canvas" style="height:150px"></canvas>
          <div class="transport">
            <button class="btn btn-green btn-sm" id="btn-beat-play">${icon('play', 13)} Play</button>
            <button class="btn btn-red btn-sm" id="btn-beat-stop">${icon('stop', 13)} Stop</button>
            <button class="btn btn-orange btn-sm" id="btn-beat-create">${icon('zap', 13)} Create Similar</button>
            <button class="btn btn-blue btn-sm" id="btn-beat-distribute">${icon('globe', 13)} Distribute</button>
          </div>
        </div>

        <div class="grid-3">
          <div class="stat-card"><div class="panel-header" style="justify-content:center">BPM</div><div class="stat-value" style="color:var(--purple)" id="beat-bpm">--</div></div>
          <div class="stat-card"><div class="panel-header" style="justify-content:center">Key</div><div class="stat-value" style="color:var(--blue)" id="beat-key">--</div></div>
          <div class="stat-card"><div class="panel-header" style="justify-content:center">Beats</div><div class="stat-value" style="color:var(--orange)" id="beat-count">--</div></div>
        </div>

        <div class="panel">
          <div class="panel-header">${icon('music', 16)} Beat Grid</div>
          <div class="pills" id="beat-grid" style="max-height:120px;overflow-y:auto"></div>
        </div>

        <div class="panel">
          <div class="panel-header">${icon('file', 16)} Audio Details</div>
          <div class="grid-4" id="beat-details"></div>
        </div>
      </div>
    </div>
  `;
}

export function init() {
  const dropZone = document.getElementById('beat-drop');
  const fileInput = document.getElementById('beat-file-input');

  if (dropZone) {
    dropZone.addEventListener('click', () => fileInput?.click());
    dropZone.addEventListener('dragover', e => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', e => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      if (e.dataTransfer.files[0]) analyzeFile(e.dataTransfer.files[0]);
    });
  }

  if (fileInput) {
    fileInput.addEventListener('change', () => {
      if (fileInput.files[0]) analyzeFile(fileInput.files[0]);
    });
  }

  const playBtn = document.getElementById('btn-beat-play');
  const stopBtn = document.getElementById('btn-beat-stop');
  const createBtn = document.getElementById('btn-beat-create');
  const distBtn = document.getElementById('btn-beat-distribute');

  if (playBtn) {
    playBtn.addEventListener('click', () => {
      const ok = engine.play();
      if (!ok) {
        const st = document.getElementById('beat-status');
        if (st) st.textContent = engine.getLastPlayError() || 'No audio loaded.';
      }
    });
  }
  if (stopBtn) stopBtn.addEventListener('click', () => engine.stop());
  if (createBtn) createBtn.addEventListener('click', () => {
    const bpm = document.getElementById('beat-bpm')?.textContent || '120';
    const key = document.getElementById('beat-key')?.textContent || 'Am';
    navigate('create');
    setTimeout(() => {
      const prompt = document.getElementById('ai-prompt');
      const bpmInput = document.getElementById('ai-bpm');
      if (prompt) prompt.value = `Track at ${bpm} BPM in ${key}`;
      if (bpmInput) { bpmInput.value = bpm; const ev = new Event('input'); bpmInput.dispatchEvent(ev); }
    }, 100);
  });
  if (distBtn) distBtn.addEventListener('click', () => navigate('portals'));
}

async function analyzeFile(file) {
  const statusEl = document.getElementById('beat-status');
  try {
    if (statusEl) statusEl.textContent = `Decoding ${file.name}...`;

    const buffer = await engine.decodeFile(file);
    if (statusEl) statusEl.textContent = 'Running beat detection...';

    const beats = engine.detectBeats(buffer);
    const bpm = engine.calculateBPM(beats);
    const key = await engine.detectKey(buffer);

    const bpmEl = document.getElementById('beat-bpm');
    const keyEl = document.getElementById('beat-key');
    const countEl = document.getElementById('beat-count');
    const nameEl = document.getElementById('beat-filename');
    const resultsEl = document.getElementById('beat-results');

    if (bpmEl) bpmEl.textContent = bpm;
    if (keyEl) keyEl.textContent = key;
    if (countEl) countEl.textContent = beats.length;
    if (nameEl) nameEl.textContent = file.name;
    if (resultsEl) resultsEl.style.display = 'block';

    drawWaveform(buffer, beats);
    renderBeatGrid(beats);
    renderDetails(buffer);

    state.addToLibrary({
      id: crypto.randomUUID(),
      title: file.name.replace(/\.\w+$/, ''),
      genre: 'Imported', bpm, key,
      duration: formatDuration(buffer.duration),
      fav: false, ts: Date.now(), source: 'import',
    });

    if (statusEl) statusEl.textContent = `${file.name}: ${beats.length} beats at ${bpm} BPM — Key: ${key}`;
    state.log('Beat Detection', `Analyzed "${file.name}": ${bpm} BPM, ${key}, ${beats.length} beats`);
  } catch (e) {
    if (statusEl) statusEl.textContent = 'Error: ' + (e.message || 'Could not decode');
    state.log('Beat Detection', 'Error: ' + e.message, 'err');
  }
}

function drawWaveform(buffer, beats) {
  try {
    const c = document.getElementById('beat-canvas');
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const dpr = devicePixelRatio || 1;
    const r = c.getBoundingClientRect();
    c.width = Math.floor(r.width * dpr);
    c.height = Math.floor(r.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = r.width, h = r.height, data = buffer.getChannelData(0);
    const step = Math.max(1, Math.floor(data.length / w));
    const mid = h / 2;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(168, 85, 247, .5)';
    for (let x = 0; x < w; x++) {
      const idx = x * step;
      let mn = 0, mx = 0;
      for (let j = 0; j < step; j++) {
        const s = data[idx + j] || 0;
        if (s < mn) mn = s;
        if (s > mx) mx = s;
      }
      ctx.fillRect(x, mid + mn * mid, 1, (mx - mn) * mid || 1);
    }

    ctx.fillStyle = 'rgba(249, 115, 22, .35)';
    beats.forEach(b => {
      ctx.fillRect((b / buffer.duration) * w, 0, 1.5, h);
    });
  } catch (e) {
    console.error('[Beats] drawWaveform error:', e);
  }
}

function renderBeatGrid(beats) {
  const el = document.getElementById('beat-grid');
  if (!el) return;
  el.innerHTML = beats.slice(0, 80).map((b, i) => {
    const min = Math.floor(b / 60);
    const sec = Math.floor(b % 60);
    const ms = Math.floor((b % 1) * 10);
    return `<span class="pill${i % 4 === 0 ? ' active' : ''}" style="font-size:.5rem">${min}:${String(sec).padStart(2, '0')}.${ms}</span>`;
  }).join('') + (beats.length > 80 ? `<span class="pill" style="font-size:.5rem">+${beats.length - 80} more</span>` : '');
}

function renderDetails(buffer) {
  const el = document.getElementById('beat-details');
  if (!el) return;
  el.innerHTML = `
    <div><label>Duration</label><div style="font-size:.72rem;font-weight:700">${formatDuration(buffer.duration)}</div></div>
    <div><label>Sample Rate</label><div style="font-size:.72rem;font-weight:700">${buffer.sampleRate} Hz</div></div>
    <div><label>Channels</label><div style="font-size:.72rem;font-weight:700">${buffer.numberOfChannels > 1 ? 'Stereo' : 'Mono'}</div></div>
    <div><label>Samples</label><div style="font-size:.72rem;font-weight:700">${(buffer.length / 1000).toFixed(0)}K</div></div>
  `;
}

function formatDuration(s) {
  return Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
}
