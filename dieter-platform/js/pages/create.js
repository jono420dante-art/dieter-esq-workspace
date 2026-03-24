/* Create Music Page — AI-powered generation */

import * as state from '../state.js';
import * as engine from '../engine.js';
import * as voiceEngine from '../voices.js';
import { icon } from '../icons.js';
import { getBackendBase, setBackendBase } from '../apiConfig.js';

let vizRAF = null;

export function render() {
  return `
    <div class="split">
      <div class="split-left">
        <div class="panel">
          <div class="panel-header">${icon('zap', 16)} AI Music Prompt</div>
          <textarea id="ai-prompt" placeholder="Describe your track..."></textarea>
          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;align-items:flex-start">
            <div style="flex:1;min-width:260px">
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
                <input type="checkbox" id="ai-use-backend" style="accent-color:var(--purple)"/>
                Use DIETER Backend API (FastAPI + jobs)
              </label>
              <input
                id="ai-backend-base"
                type="text"
                placeholder="Backend base URL (blank = same origin)"
                value="${(() => { try { return localStorage.getItem('dp-backend-base') || ''; } catch { return ''; } })()}"
                style="margin-top:8px"
              />
              <div style="font-size:.6rem;color:var(--dim);margin-top:4px;line-height:1.4">
                Examples: <span style="font-family:'SF Mono',monospace">http://127.0.0.1:8787</span> or <span style="font-family:'SF Mono',monospace">https://dieter-api.yourdomain.com</span>
              </div>
              <div style="margin-top:12px;padding-top:10px;border-top:1px solid rgba(168,85,247,.2)">
                <label style="display:block;margin-bottom:6px">${icon('disc', 14)} Real audio file (local)</label>
                <input type="file" id="ai-import-audio" accept="audio/*" style="font-size:.85rem;max-width:100%"/>
                <div style="font-size:.58rem;color:var(--dim);margin-top:6px;line-height:1.45">
                  Playback uses <strong>real recordings only</strong> (no built‑in synth tones). Import a track here, or use the backend API to generate WAV.
                </div>
              </div>
            </div>
          </div>
          <div class="grid-2" style="margin-top:8px">
            <div><label>Genre</label>
              <select id="ai-genre">
                <option value="synthwave">Synthwave</option><option value="house">House</option><option value="afrobeat">Afrobeat</option>
                <option value="trap">Trap</option><option value="lofi">Lo-fi</option><option value="drill">Drill</option>
                <option value="rnb">R&B</option><option value="pop">Pop</option><option value="techno">Techno</option>
                <option value="phonk">Phonk</option><option value="amapiano">Amapiano</option><option value="hiphop">Hip Hop</option>
                <option value="jazz">Jazz</option><option value="reggaeton">Reggaeton</option><option value="edm">EDM</option>
                <option value="dancehall">Dancehall</option><option value="rock">Rock</option><option value="ballad">Ballad</option>
                <option value="classical">Classical</option><option value="gospel">Gospel</option><option value="country">Country</option>
                <option value="soul">Soul</option><option value="funk">Funk</option><option value="metal">Metal</option>
                <option value="ambient">Ambient</option>
              </select>
            </div>
            <div><label>Mood</label>
              <select id="ai-mood">
                <option>Energetic</option><option>Chill</option><option>Dark</option><option>Uplifting</option>
                <option>Romantic</option><option>Aggressive</option><option>Dreamy</option><option>Melancholic</option>
              </select>
            </div>
          </div>
          <div class="slider-row" style="margin-top:6px">
            <label>BPM</label>
            <input type="range" id="ai-bpm" min="60" max="200" value="128"/>
            <span class="slider-val" id="ai-bpm-val">128</span>
          </div>
          <button class="action-btn" id="btn-ai-gen">${icon('zap', 16)} Generate Track</button>
          <div class="status-text" id="ai-status"></div>
        </div>

        <div class="panel">
          <div class="panel-header">${icon('mic', 16)} Voice Selection</div>
          <div id="create-voice-grid" style="max-height:180px;overflow-y:auto"></div>
        </div>
      </div>

      <div class="split-right">
        <div class="panel">
          <div class="panel-header">${icon('volumeUp', 16)} Visualizer</div>
          <canvas id="create-viz" class="wave-canvas"></canvas>
          <div class="transport">
            <button class="btn btn-green btn-sm" id="btn-create-play">${icon('play', 13)} Play</button>
            <button class="btn btn-ghost btn-sm" id="btn-create-pause">${icon('pause', 13)}</button>
            <button class="btn btn-red btn-sm" id="btn-create-stop">${icon('stop', 13)} Stop</button>
          </div>
        </div>

        <div class="panel">
          <div class="panel-header">🤖 AI Director</div>
          <div class="news-card" style="border-color:rgba(250,204,21,.3)">
            <div class="news-title">Suggestion</div>
            <div class="news-body">Boost chorus energy +8% at 01:12 for maximum hook lift.</div>
          </div>
          <div class="news-card" style="border-color:rgba(56,189,248,.3)">
            <div class="news-title">Trend Alert</div>
            <div class="news-body">Afro-house vocal chops are peaking globally. Consider adding a chopped vocal layer.</div>
          </div>
          <div class="news-card" style="border-color:rgba(249,115,22,.3)">
            <div class="news-title">Production Tip</div>
            <div class="news-body">Layer a noise riser 4 bars before the drop for cinematic tension.</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function init() {
  const promptBox = document.getElementById('ai-prompt');
  if (promptBox) {
    promptBox.addEventListener('focus', () => { promptBox.setAttribute('placeholder', ''); });
    promptBox.addEventListener('blur', () => {
      if (!promptBox.value.trim()) promptBox.setAttribute('placeholder', 'Describe your track...');
    });
  }

  const baseInput = document.getElementById('ai-backend-base');
  if (baseInput) {
    baseInput.addEventListener('change', () => setBackendBase(baseInput.value));
    baseInput.addEventListener('blur', () => setBackendBase(baseInput.value));
  }

  const bpmSlider = document.getElementById('ai-bpm');
  const bpmVal = document.getElementById('ai-bpm-val');
  if (bpmSlider) bpmSlider.addEventListener('input', () => { if (bpmVal) bpmVal.textContent = bpmSlider.value; });

  loadCreateVoices();

  const genBtn = document.getElementById('btn-ai-gen');
  if (genBtn) genBtn.addEventListener('click', generateTrack);

  document.getElementById('ai-import-audio')?.addEventListener('change', async (e) => {
    const f = e.target?.files?.[0];
    const statusEl = document.getElementById('ai-status');
    if (!f) return;
    try {
      if (statusEl) statusEl.textContent = 'Decoding ' + f.name + '…';
      await engine.decodeFile(f);
      if (statusEl) statusEl.textContent = 'Loaded: ' + f.name + ' — ready to play or “finalize” with Generate.';
    } catch (err) {
      console.error(err);
      if (statusEl) statusEl.textContent = 'Could not load audio: ' + (err?.message || err);
    }
  });

  document.getElementById('btn-create-play')?.addEventListener('click', () => {
    const ok = engine.play();
    if (!ok) {
      const statusEl = document.getElementById('ai-status');
      if (statusEl) statusEl.textContent = engine.getLastPlayError() || 'No audio loaded.';
    }
  });
  document.getElementById('btn-create-pause')?.addEventListener('click', () => engine.pause());
  document.getElementById('btn-create-stop')?.addEventListener('click', () => engine.stop());

  tryApplyMurekaDraftToCreate();
  startViz();
}

function tryApplyMurekaDraftToCreate() {
  try {
    const raw = sessionStorage.getItem('dp-mureka-draft');
    if (!raw) return;
    const d = JSON.parse(raw);
    const promptBox = document.getElementById('ai-prompt');
    if (!promptBox || promptBox.value.trim()) return;
    const parts = [];
    if (d.title) parts.push(`Title: ${d.title}`);
    if (d.style) parts.push(`Style / mood / instruments: ${d.style}`);
    if (d.instrumental) parts.push('Instrumental — no lead vocals.');
    else if (d.vocal) parts.push(`Vocal: ${d.vocal}`);
    if (d.modes?.length) parts.push(`Modes: ${d.modes.join(', ')}`);
    if (!d.instrumental && d.lyrics) parts.push(`Lyrics:\n${d.lyrics}`);
    if (parts.length) promptBox.value = parts.join('\n\n');
  } catch { /* ignore */ }
}

async function loadCreateVoices() {
  await voiceEngine.loadVoices();
  const all = voiceEngine.getVoices();
  const grid = document.getElementById('create-voice-grid');
  if (!grid) return;
  const shown = all.slice(0, 20);
  grid.innerHTML = shown.map((v, i) => `
    <div class="track-row" data-cvi="${i}" style="cursor:pointer;margin-bottom:2px">
      <button class="btn btn-green btn-sm" data-cvp="${i}">${icon('play', 11)}</button>
      <div class="track-info">
        <div class="track-title" style="font-size:.64rem">${v.name}</div>
        <div class="track-meta">${v.lang}</div>
      </div>
    </div>
  `).join('') + (all.length > 20 ? `<div style="text-align:center;font-size:.56rem;color:var(--dim);padding:6px">+${all.length - 20} more in Lyrics Studio</div>` : '');

  grid.querySelectorAll('[data-cvp]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      voiceEngine.previewVoice(shown[parseInt(el.dataset.cvp)]);
    });
  });
}

export function destroy() {
  if (vizRAF) cancelAnimationFrame(vizRAF);
  vizRAF = null;
}

function generateTrack() {
  const prompt = document.getElementById('ai-prompt')?.value?.trim();
  const statusEl = document.getElementById('ai-status');
  const btn = document.getElementById('btn-ai-gen');
  if (!prompt) { if (statusEl) statusEl.textContent = 'Write a prompt first!'; return; }

  if (btn) btn.disabled = true;

  const useBackend = document.getElementById('ai-use-backend')?.checked;
  if (useBackend) {
    generateTrackViaBackend(prompt, statusEl, btn);
    return;
  }

  if (!engine.getBuffer()) {
    if (statusEl) {
      statusEl.textContent = 'Real audio only: turn on “Use DIETER Backend API” for AI WAV output, or import a WAV/MP3 file above.';
    }
    if (btn) btn.disabled = false;
    return;
  }

  const genre = document.getElementById('ai-genre')?.value || 'synthwave';
  const mood = document.getElementById('ai-mood')?.value || 'Energetic';
  const bpm = +(document.getElementById('ai-bpm')?.value || 128);
  const steps = [
    `Tagging "${prompt.slice(0, 30)}..." · ${genre}…`,
    `Applying ${mood} mood metadata · ${bpm} BPM…`,
    'Registering in your library…',
    'Playing your loaded audio…',
    'Done!'
  ];
  let step = 0;
  if (statusEl) statusEl.textContent = steps[0];

  engine.setGenre(genre);

  const iv = setInterval(() => {
    step++;
    if (step >= steps.length) {
      clearInterval(iv);
      if (btn) btn.disabled = false;
      const buf = engine.getBuffer();
      const durSec = buf?.duration != null ? Math.round(buf.duration) : 0;
      const duration = durSec ? `${Math.floor(durSec / 60)}:${String(durSec % 60).padStart(2, '0')}` : '—';
      if (statusEl) statusEl.textContent = `Library entry added · ${genre} · ${mood} · ${bpm} BPM · playing real audio`;
      const title = prompt.slice(0, 40);
      state.addToLibrary({ id: crypto.randomUUID(), title, genre, bpm, key: 'Am', duration, fav: false, ts: Date.now(), source: 'import' });
      state.log('AI Creator', `Registered "${title}" from loaded audio · ${genre} · ${mood}`);
      const ok = engine.play();
      if (!ok && statusEl) statusEl.textContent = engine.getLastPlayError() || 'Playback failed';
    } else {
      if (statusEl) statusEl.textContent = steps[step];
    }
  }, 500);
}

async function generateTrackViaBackend(prompt, statusEl, btn) {
  const genre = document.getElementById('ai-genre')?.value || 'synthwave';
  const mood = document.getElementById('ai-mood')?.value || 'Energetic';
  const bpm = +(document.getElementById('ai-bpm')?.value || 128);

  const base = getBackendBase(); // '' = same origin
  const baseUrl = base ? base : '';

  const setStatus = (msg) => { if (statusEl) statusEl.textContent = msg; };

  try {
    setStatus(`API: submitting job for ${genre} · ${mood} · ${bpm} BPM...`);
    const genResp = await fetch(`${baseUrl}/api/music/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        lyrics: undefined,
        bpm,
        mood,
        style: genre,
        language: 'en',
        vocalPreset: 'Radio',
        modelLine: 'V7.5',
        tier: 'pro',
        stems: true,
        durationSec: 45,
      }),
    });

    if (!genResp.ok) {
      const t = await genResp.text().catch(() => '');
      throw new Error(`Backend error ${genResp.status}: ${t || genResp.statusText}`);
    }

    const gen = await genResp.json();
    const jobId = gen.jobId;
    setStatus(`API: job queued (${jobId.slice(0, 12)}...). Waiting...`);

    let tries = 0;
    while (tries < 90) {
      tries++;
      setStatus(`API: generating... (${tries}/90)`);
      await new Promise(r => setTimeout(r, 2000));

      const poll = await fetch(`${baseUrl}/api/jobs/${encodeURIComponent(jobId)}`);
      if (!poll.ok) continue;
      const job = await poll.json();
      if (job.status === 'running' || job.status === 'queued') continue;
      if (job.status === 'failed') throw new Error(job.error || 'Backend job failed');
      if (job.status === 'succeeded' && job.output?.mix?.wavUrl) {
        const wavUrl = job.output.mix.wavUrl; // backend returns relative /api/storage/...
        const url = wavUrl.startsWith('http') ? wavUrl : `${baseUrl}${wavUrl}`;
        setStatus('API: downloading WAV and decoding...');

        const audioResp = await fetch(url);
        if (!audioResp.ok) throw new Error(`Failed to download WAV: HTTP ${audioResp.status}`);
        const blob = await audioResp.blob();
        const decoded = await engine.decodeFile(blob);
        engine.setBuffer(decoded);

        const title = prompt.slice(0, 40) || 'API Generated Track';
        const duration = String(job.output.meta?.durationSec ?? 45) + 's';
        state.addToLibrary({
          id: crypto.randomUUID(),
          title,
          genre,
          bpm,
          key: 'Am',
          duration,
          fav: false,
          ts: Date.now(),
          source: 'api',
        });

        engine.setGenre(genre);
        const played = engine.play();
        setStatus(played ? `API: done! Playing ${title}` : (`API: decoded, but playback failed: ` + (engine.getLastPlayError() || 'unknown')));

        if (btn) btn.disabled = false;
        return;
      }
    }

    throw new Error('Backend timed out waiting for job output');
  } catch (e) {
    console.error('[API] generate error', e);
    setStatus('API error: ' + (e?.message || e));
    if (btn) btn.disabled = false;
  }
}

function startViz() {
  function draw() {
    vizRAF = requestAnimationFrame(draw);
    try {
      const c = document.getElementById('create-viz');
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
      if (engine.isPlaying()) {
        const fd = engine.getFrequencyData();
        const bars = 64;
        const bw = w / bars;
        for (let i = 0; i < bars; i++) {
          const v = (fd[i * 4] || 0) / 255;
          ctx.fillStyle = `hsla(${270 + i * 2}, 80%, 55%, ${0.3 + v * 0.5})`;
          ctx.fillRect(i * bw, h - v * h, bw - 1, v * h);
        }
      } else {
        ctx.strokeStyle = 'rgba(168, 85, 247, .4)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let x = 0; x < w; x += 3) {
          const y = h / 2 + Math.sin((x + performance.now() * 0.018) * 0.03) * 12 + Math.sin((x + performance.now() * 0.007) * 0.02) * 6;
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    } catch { /* safe */ }
  }
  draw();
}
