/* Video Engine — Real HD procedural video generation + rendering */

import * as state from '../state.js';
import * as engine from '../engine.js';
import { icon } from '../icons.js';

const STYLES = [
  { id: 'galaxy', name: 'Particle Galaxy', desc: 'Swirling star particles', color: '#a855f7' },
  { id: 'waveform', name: 'Audio Waveform', desc: 'Reactive sound bars', color: '#38bdf8' },
  { id: 'tunnel', name: 'Neon Tunnel', desc: 'Infinite depth warp', color: '#22c55e' },
  { id: 'kaleidoscope', name: 'Kaleidoscope', desc: 'Mirrored geometry', color: '#ec4899' },
  { id: 'matrix', name: 'Matrix Rain', desc: 'Digital code rain', color: '#22c55e' },
  { id: 'fractal', name: 'Fractal Tree', desc: 'Organic branching', color: '#f97316' },
  { id: 'circles', name: 'Pulse Circles', desc: 'Expanding rings', color: '#06b6d4' },
  { id: 'aurora', name: 'Aurora Borealis', desc: 'Northern lights flow', color: '#a855f7' },
  { id: 'fire', name: 'Fire & Smoke', desc: 'Particle flames', color: '#f97316' },
  { id: 'geometric', name: 'Sacred Geometry', desc: 'Rotating shapes', color: '#eab308' },
  { id: 'glitch', name: 'Glitch Art', desc: 'Digital distortion', color: '#ef4444' },
  { id: 'ocean', name: 'Deep Ocean', desc: 'Underwater waves', color: '#38bdf8' },
];

let currentStyle = 'galaxy';
let animRAF = null;
let isRendering = false;
let recorder = null;
let chunks = [];
let particles = [];
let matrixColumns = [];
let time = 0;
let aiGenerating = false;
let aiResults = [];

export function render() {
  return `
    <div class="split">
      <div class="split-right">
        <div class="panel" style="padding:6px">
          <div class="panel-header">${icon('disc', 16)} Video Preview — HD Real-Time
            <span class="panel-header-right" id="vid-resolution">1280×720</span>
          </div>
          <canvas id="vid-canvas" class="vid-canvas" width="1280" height="720"></canvas>
          <div class="vid-controls">
            <button class="btn btn-green btn-sm" id="btn-vid-play">${icon('play', 13)} Play</button>
            <button class="btn btn-ghost btn-sm" id="btn-vid-pause">${icon('pause', 13)}</button>
            <button class="btn btn-red btn-sm" id="btn-vid-stop">${icon('stop', 13)} Stop</button>
            <span style="width:1px;height:16px;background:var(--border);margin:0 4px"></span>
            <button class="btn btn-orange btn-sm" id="btn-vid-render">${icon('download', 13)} Render Video</button>
            <button class="btn btn-blue btn-sm" id="btn-vid-screenshot">${icon('download', 13)} Screenshot</button>
            <button class="btn btn-primary btn-sm" id="btn-vid-random">${icon('refresh', 13)} Random Style</button>
          </div>
          <div class="render-progress" id="render-progress" style="display:none">
            <div class="render-progress-bar" id="render-bar" style="width:0%"></div>
          </div>
          <div class="status-text" id="vid-status">Select a style and hit Play</div>
        </div>

        <div class="panel">
          <div class="panel-header">${icon('sliders', 16)} Video Settings</div>
          <div class="grid-3">
            <div>
              <label>Resolution</label>
              <select id="vid-res">
                <option value="1280,720" selected>720p HD</option>
                <option value="1920,1080">1080p Full HD</option>
                <option value="640,360">360p Fast</option>
              </select>
            </div>
            <div>
              <label>Speed</label>
              <select id="vid-speed">
                <option value="0.5">Slow</option>
                <option value="1" selected>Normal</option>
                <option value="2">Fast</option>
                <option value="4">Ultra</option>
              </select>
            </div>
            <div>
              <label>Color Theme</label>
              <select id="vid-theme">
                <option value="purple">Purple / Violet</option>
                <option value="blue">Blue / Cyan</option>
                <option value="green">Green / Lime</option>
                <option value="orange">Orange / Fire</option>
                <option value="pink">Pink / Magenta</option>
                <option value="rainbow">Rainbow</option>
              </select>
            </div>
          </div>
          <div class="slider-row" style="margin-top:6px">
            <label>Intensity</label>
            <input type="range" id="vid-intensity" min="1" max="100" value="70"/>
            <span class="slider-val" id="vid-intensity-val">70</span>
          </div>
          <div class="slider-row">
            <label>Particle Count</label>
            <input type="range" id="vid-particles" min="50" max="2000" value="500" step="50"/>
            <span class="slider-val" id="vid-particles-val">500</span>
          </div>
        </div>

        <div class="panel">
          <div class="panel-header">${icon('disc', 16)} Rendered Videos</div>
          <div id="rendered-list">
            <div style="text-align:center;color:var(--dim);padding:14px;font-size:.66rem">Hit "Render Video" to create a downloadable video file</div>
          </div>
        </div>
      </div>

      <div class="split-sidebar">
        <div class="panel">
          <div class="panel-header">${icon('zap', 16)} AI Image Generator <span class="panel-header-right" id="ai-model-badge" style="color:#22c55e">FLUX SCHNELL</span></div>
          <div style="margin-bottom:6px">
            <label>Describe your image / video frame</label>
            <textarea id="ai-vid-prompt" placeholder="A cinematic sunset over neon-lit city rooftops, volumetric lighting, 8K..." style="min-height:100px;font-size:.7rem;line-height:1.6"></textarea>
          </div>
          <div style="margin-bottom:6px">
            <label>AI Model</label>
            <select id="ai-vid-model">
              <option value="flux-schnell" selected>Flux Schnell (fast, reliable)</option>
              <option value="flux-1.1-pro">Flux 1.1 Pro (quality)</option>
              <option value="flux-dev">Flux Dev</option>
            </select>
          </div>
          <div class="grid-2" style="margin-bottom:6px">
            <div>
              <label>Aspect Ratio</label>
              <select id="ai-vid-ratio">
                <option value="1:1">1:1 Square</option>
                <option value="16:9" selected>16:9 Widescreen</option>
                <option value="9:16">9:16 Portrait</option>
                <option value="4:3">4:3 Classic</option>
                <option value="3:4">3:4 Tall</option>
                <option value="21:9">21:9 Ultra-wide</option>
              </select>
            </div>
            <div>
              <label>Resolution</label>
              <select id="ai-vid-megapixels">
                <option value="0.25 MP">0.25 MP (Fast)</option>
                <option value="1 MP" selected>1 MP (Standard)</option>
                <option value="4 MP">4 MP (HD)</option>
              </select>
            </div>
          </div>
          <div class="grid-2" style="margin-bottom:6px">
            <div>
              <label>Output Format</label>
              <select id="ai-vid-format">
                <option value="webp" selected>WebP</option>
                <option value="png">PNG</option>
                <option value="jpg">JPG</option>
              </select>
            </div>
            <div>
              <label>Output Quality</label>
              <select id="ai-vid-quality">
                <option value="60">60 (Small)</option>
                <option value="80" selected>80 (Default)</option>
                <option value="95">95 (High)</option>
                <option value="100">100 (Max)</option>
              </select>
            </div>
          </div>
          <div id="ai-flux-dev-settings" style="display:none">
            <div class="grid-2" style="margin-bottom:6px">
              <div>
                <label>Steps</label>
                <select id="ai-vid-steps">
                  <option value="25">25 (Fast)</option>
                  <option value="35" selected>35 (Default)</option>
                  <option value="50">50 (Quality)</option>
                </select>
              </div>
              <div>
                <label>Guidance Scale</label>
                <div class="slider-row">
                  <input type="range" id="ai-vid-guidance" min="1" max="20" value="7" step="0.5"/>
                  <span class="slider-val" id="ai-vid-guidance-val">7</span>
                </div>
              </div>
            </div>
          </div>
          <div id="ai-flux-pro-settings">
            <div style="margin-bottom:6px">
              <label>Safety Tolerance <span style="font-size:.5rem;color:var(--dim)">(1=strict · 5=lenient)</span></label>
              <div class="slider-row">
                <input type="range" id="ai-vid-safety" min="1" max="5" value="2" step="1"/>
                <span class="slider-val" id="ai-vid-safety-val">2</span>
              </div>
            </div>
          </div>
          <div style="margin-bottom:8px">
            <label>Replicate API Token <span style="font-size:.48rem;color:var(--dim)">(optional — leave empty to use free Pollinations only)</span></label>
            <input type="password" id="ai-vid-token" placeholder="r8_xxxxxxxx... or leave blank for Pollinations" style="width:100%;font-size:.68rem" value="${(() => { try { return localStorage.getItem('dp-replicate-token') || ''; } catch { return ''; } })()}"/>
            <div style="font-size:.5rem;color:var(--dim);margin-top:2px">With a token: Replicate resolves the correct model <strong>version</strong> automatically (fixes 422). Without token: <a href="https://pollinations.ai/" target="_blank" style="color:var(--purple)">Pollinations</a> image URL (preview).</div>
          </div>
          <button class="action-btn" id="btn-ai-generate" style="width:100%;margin-bottom:4px">${icon('zap', 14)} Generate image</button>
          <div class="status-text" id="ai-vid-status"></div>
          <div id="ai-vid-results" style="margin-top:8px"></div>
        </div>

        <div class="panel">
          <div class="panel-header">${icon('settings', 16)} Video Styles</div>
          <div class="vid-style-grid" id="style-grid">
            ${STYLES.map(s => `
              <div class="vid-style-card${s.id === currentStyle ? ' active' : ''}" data-style="${s.id}">
                <div class="vs-icon" style="color:${s.color}">◆</div>
                <div class="vs-name">${s.name}</div>
                <div class="vs-desc">${s.desc}</div>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="panel">
          <div class="panel-header">${icon('zap', 16)} Quick Actions</div>
          <button class="btn btn-primary btn-sm btn-full" id="btn-auto-cycle" style="margin-bottom:3px">${icon('refresh', 13)} Auto-Cycle Styles</button>
          <button class="btn btn-orange btn-sm btn-full" data-goto="beats" style="margin-bottom:3px">${icon('activity', 13)} Beat Detection</button>
          <button class="btn btn-blue btn-sm btn-full" data-goto="social" style="margin-bottom:3px">${icon('share', 13)} Share Video</button>
          <button class="btn btn-green btn-sm btn-full" data-goto="portals">${icon('globe', 13)} Distribute</button>
        </div>
      </div>
    </div>
  `;
}

let autoCycleTimer = null;
let playing = false;
let renderedVideos = [];

export function init() {
  document.querySelectorAll('[data-style]').forEach(el => {
    el.addEventListener('click', () => {
      currentStyle = el.dataset.style;
      document.querySelectorAll('.vid-style-card').forEach(c => c.classList.toggle('active', c.dataset.style === currentStyle));
      initStyle();
      setStatus(`Style: ${STYLES.find(s => s.id === currentStyle)?.name}`);
    });
  });

  document.getElementById('btn-vid-play')?.addEventListener('click', startVideo);
  document.getElementById('btn-vid-pause')?.addEventListener('click', pauseVideo);
  document.getElementById('btn-vid-stop')?.addEventListener('click', stopVideo);
  document.getElementById('btn-vid-render')?.addEventListener('click', renderVideo);
  document.getElementById('btn-vid-screenshot')?.addEventListener('click', takeScreenshot);
  document.getElementById('btn-vid-random')?.addEventListener('click', randomStyle);
  document.getElementById('btn-auto-cycle')?.addEventListener('click', toggleAutoCycle);

  setupSlider('vid-intensity', 'vid-intensity-val');
  setupSlider('vid-particles', 'vid-particles-val');
  setupSlider('ai-vid-guidance', 'ai-vid-guidance-val');
  setupSlider('ai-vid-safety', 'ai-vid-safety-val');

  document.getElementById('vid-res')?.addEventListener('change', updateResolution);
  document.querySelectorAll('[data-goto]').forEach(el => {
    el.addEventListener('click', () => { import('../router.js').then(r => r.navigate(el.dataset.goto)); });
  });

  const promptTA = document.getElementById('ai-vid-prompt');
  if (promptTA) {
    promptTA.addEventListener('focus', () => promptTA.setAttribute('placeholder', ''));
    promptTA.addEventListener('blur', () => {
      if (!promptTA.value.trim()) promptTA.setAttribute('placeholder', 'A cinematic sunset over neon-lit city rooftops, volumetric lighting, 8K...');
    });
  }

  document.getElementById('ai-vid-model')?.addEventListener('change', (e) => {
    const key = e.target.value;
    const isDev = key === 'flux-dev';
    const devSettings = document.getElementById('ai-flux-dev-settings');
    const proSettings = document.getElementById('ai-flux-pro-settings');
    const badge = document.getElementById('ai-model-badge');
    const btn = document.getElementById('btn-ai-generate');
    const meta = AI_MODELS[key];
    if (devSettings) devSettings.style.display = isDev ? 'block' : 'none';
    if (proSettings) proSettings.style.display = isDev ? 'none' : 'block';
    if (badge && meta) {
      badge.textContent = meta.name.toUpperCase();
      badge.style.color = isDev ? '#38bdf8' : '#22c55e';
    }
    if (btn && meta) btn.innerHTML = `${icon('zap', 14)} Generate (${meta.name})`;
  });

  document.getElementById('ai-vid-token')?.addEventListener('change', (e) => {
    try { localStorage.setItem('dp-replicate-token', e.target.value.trim()); } catch {}
  });

  document.getElementById('btn-ai-generate')?.addEventListener('click', generateAIImage);

  renderAIResults();
  initStyle();
  startVideo();
}

export function destroy() {
  stopVideo();
  if (autoCycleTimer) { clearInterval(autoCycleTimer); autoCycleTimer = null; }
}

function updateResolution() {
  const sel = document.getElementById('vid-res')?.value || '1280,720';
  const [w, h] = sel.split(',').map(Number);
  const c = document.getElementById('vid-canvas');
  if (c) { c.width = w; c.height = h; }
  const lbl = document.getElementById('vid-resolution');
  if (lbl) lbl.textContent = `${w}×${h}`;
  initStyle();
}

function initStyle() {
  const c = document.getElementById('vid-canvas');
  if (!c) return;
  const count = +(document.getElementById('vid-particles')?.value || 500);
  particles = [];

  if (currentStyle === 'galaxy' || currentStyle === 'fire') {
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * c.width, y: Math.random() * c.height,
        vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2,
        r: Math.random() * 2.5 + 0.3, a: Math.random(), life: Math.random(),
      });
    }
  }

  if (currentStyle === 'matrix') {
    matrixColumns = [];
    const cols = Math.floor(c.width / 14);
    for (let i = 0; i < cols; i++) matrixColumns.push(Math.random() * c.height);
  }
}

function startVideo() {
  playing = true;
  time = 0;
  if (animRAF) cancelAnimationFrame(animRAF);
  drawFrame();
  setStatus('Playing: ' + (STYLES.find(s => s.id === currentStyle)?.name || currentStyle));
}

function pauseVideo() {
  playing = false;
  if (animRAF) cancelAnimationFrame(animRAF);
  animRAF = null;
  setStatus('Paused');
}

function stopVideo() {
  playing = false;
  if (animRAF) cancelAnimationFrame(animRAF);
  animRAF = null;
  const c = document.getElementById('vid-canvas');
  if (c) { const ctx = c.getContext('2d'); if (ctx) ctx.clearRect(0, 0, c.width, c.height); }
  setStatus('Stopped');
}

function randomStyle() {
  const idx = Math.floor(Math.random() * STYLES.length);
  currentStyle = STYLES[idx].id;
  document.querySelectorAll('.vid-style-card').forEach(c => c.classList.toggle('active', c.dataset.style === currentStyle));
  initStyle();
  if (!playing) startVideo();
  setStatus('Random: ' + STYLES[idx].name);
}

function toggleAutoCycle() {
  if (autoCycleTimer) {
    clearInterval(autoCycleTimer);
    autoCycleTimer = null;
    setStatus('Auto-cycle stopped');
  } else {
    autoCycleTimer = setInterval(randomStyle, 4000);
    setStatus('Auto-cycling every 4s');
  }
}

function getThemeHue() {
  const theme = document.getElementById('vid-theme')?.value || 'purple';
  const hues = { purple: 270, blue: 210, green: 140, orange: 30, pink: 330, rainbow: -1 };
  return hues[theme] ?? 270;
}

function drawFrame() {
  if (!playing) return;
  animRAF = requestAnimationFrame(drawFrame);
  try {
    const c = document.getElementById('vid-canvas');
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const W = c.width, H = c.height;
    const speed = parseFloat(document.getElementById('vid-speed')?.value || 1);
    const intensity = (+(document.getElementById('vid-intensity')?.value || 70)) / 100;
    const hue = getThemeHue();
    time += 0.016 * speed;

    switch (currentStyle) {
      case 'galaxy': drawGalaxy(ctx, W, H, hue, intensity); break;
      case 'waveform': drawWaveform(ctx, W, H, hue, intensity); break;
      case 'tunnel': drawTunnel(ctx, W, H, hue, intensity); break;
      case 'kaleidoscope': drawKaleidoscope(ctx, W, H, hue, intensity); break;
      case 'matrix': drawMatrix(ctx, W, H, intensity); break;
      case 'fractal': drawFractal(ctx, W, H, hue, intensity); break;
      case 'circles': drawCircles(ctx, W, H, hue, intensity); break;
      case 'aurora': drawAurora(ctx, W, H, hue, intensity); break;
      case 'fire': drawFire(ctx, W, H, intensity); break;
      case 'geometric': drawGeometric(ctx, W, H, hue, intensity); break;
      case 'glitch': drawGlitch(ctx, W, H, hue, intensity); break;
      case 'ocean': drawOcean(ctx, W, H, intensity); break;
      default: drawGalaxy(ctx, W, H, hue, intensity);
    }

    ctx.fillStyle = 'rgba(255,255,255,.5)';
    ctx.font = '10px system-ui';
    ctx.fillText('DIETER PRO — Licensed to EDUARD GEERDES', 10, H - 8);
  } catch { /* safe */ }
}

/* ═══ STYLE RENDERERS ═══ */
function drawGalaxy(ctx, W, H, hue, intensity) {
  ctx.fillStyle = `rgba(0,0,0,${0.05 + (1 - intensity) * 0.1})`;
  ctx.fillRect(0, 0, W, H);
  const cx = W / 2, cy = H / 2;
  for (const p of particles) {
    const dx = p.x - cx, dy = p.y - cy;
    const angle = Math.atan2(dy, dx) + 0.01 * intensity;
    const dist = Math.sqrt(dx * dx + dy * dy);
    p.x = cx + Math.cos(angle) * dist + p.vx;
    p.y = cy + Math.sin(angle) * dist + p.vy;
    if (p.x < 0 || p.x > W) p.x = cx + (Math.random() - 0.5) * W;
    if (p.y < 0 || p.y > H) p.y = cy + (Math.random() - 0.5) * H;
    const h = hue === -1 ? (dist + time * 50) % 360 : hue + (dist * 0.1) % 40;
    ctx.beginPath();
    ctx.fillStyle = `hsla(${h},80%,65%,${p.a * intensity})`;
    ctx.arc(p.x, p.y, p.r * intensity * 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawWaveform(ctx, W, H, hue, intensity) {
  ctx.fillStyle = 'rgba(0,0,0,.15)';
  ctx.fillRect(0, 0, W, H);
  const bars = 80;
  const bw = W / bars;
  const fd = engine.getFrequencyData();
  for (let i = 0; i < bars; i++) {
    const v = fd.length ? (fd[i * 4] || 0) / 255 : (Math.sin(time * 3 + i * 0.2) * 0.5 + 0.5) * intensity;
    const h = hue === -1 ? (i * 4 + time * 20) % 360 : hue + i * 0.5;
    ctx.fillStyle = `hsla(${h},80%,55%,${0.4 + v * 0.5})`;
    const barH = v * H * 0.8;
    ctx.fillRect(i * bw + 1, H - barH, bw - 2, barH);
    ctx.fillStyle = `hsla(${h},80%,75%,${v * 0.3})`;
    ctx.fillRect(i * bw + 1, H / 2 - barH / 2, bw - 2, barH);
  }
}

function drawTunnel(ctx, W, H, hue, intensity) {
  ctx.fillStyle = 'rgba(0,0,0,.12)';
  ctx.fillRect(0, 0, W, H);
  const cx = W / 2, cy = H / 2;
  const rings = 20;
  for (let i = rings; i > 0; i--) {
    const r = (i / rings) * Math.min(W, H) * 0.6 + (time * 80 * intensity) % (Math.min(W, H) * 0.6 / rings);
    const h = hue === -1 ? (i * 20 + time * 40) % 360 : hue + i * 3;
    ctx.strokeStyle = `hsla(${h},80%,55%,${(1 - i / rings) * intensity * 0.6})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    const sides = 6;
    for (let s = 0; s <= sides; s++) {
      const angle = (s / sides) * Math.PI * 2 + time * 0.3;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      if (s === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }
}

function drawKaleidoscope(ctx, W, H, hue, intensity) {
  ctx.fillStyle = 'rgba(0,0,0,.06)';
  ctx.fillRect(0, 0, W, H);
  const cx = W / 2, cy = H / 2;
  const segments = 8;
  for (let s = 0; s < segments; s++) {
    const angle = (s / segments) * Math.PI * 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    if (s % 2) ctx.scale(1, -1);
    const x = Math.sin(time * 1.5) * 100 * intensity;
    const y = Math.cos(time * 2) * 80 * intensity;
    const r = 20 + Math.sin(time * 3) * 15 * intensity;
    const h = hue === -1 ? (time * 30 + s * 45) % 360 : hue + s * 5 + time * 10;
    ctx.fillStyle = `hsla(${h},80%,55%,.4)`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    const x2 = Math.cos(time * 2.5) * 60 * intensity;
    const y2 = Math.sin(time * 1.8) * 50 * intensity;
    ctx.fillStyle = `hsla(${h + 60},70%,60%,.35)`;
    ctx.beginPath();
    ctx.arc(x2, y2, r * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawMatrix(ctx, W, H, intensity) {
  ctx.fillStyle = 'rgba(0,0,0,.06)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = `rgba(34,197,94,${0.6 * intensity})`;
  ctx.font = '13px monospace';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZアイウエオカキクケコ0123456789@#$%&';
  for (let i = 0; i < matrixColumns.length; i++) {
    const ch = chars[Math.floor(Math.random() * chars.length)];
    ctx.fillText(ch, i * 14, matrixColumns[i]);
    matrixColumns[i] += 14;
    if (matrixColumns[i] > H && Math.random() > 0.98) matrixColumns[i] = 0;
  }
}

function drawFractal(ctx, W, H, hue, intensity) {
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.fillRect(0, 0, W, H);
  function branch(x, y, len, angle, depth) {
    if (depth <= 0 || len < 3) return;
    const x2 = x + Math.cos(angle) * len;
    const y2 = y - Math.sin(angle) * len;
    const h = hue === -1 ? (depth * 40 + time * 20) % 360 : hue + depth * 8;
    ctx.strokeStyle = `hsla(${h},70%,55%,${intensity * 0.7})`;
    ctx.lineWidth = depth * 0.8;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
    const sway = Math.sin(time * 2 + depth * 0.5) * 0.15;
    branch(x2, y2, len * 0.7, angle + 0.5 + sway, depth - 1);
    branch(x2, y2, len * 0.7, angle - 0.5 + sway, depth - 1);
  }
  branch(W / 2, H, H * 0.22 * intensity, Math.PI / 2, 10);
}

function drawCircles(ctx, W, H, hue, intensity) {
  ctx.fillStyle = 'rgba(0,0,0,.08)';
  ctx.fillRect(0, 0, W, H);
  const cx = W / 2, cy = H / 2;
  for (let i = 0; i < 12; i++) {
    const r = (Math.sin(time * 1.5 - i * 0.3) * 0.5 + 0.5) * Math.min(W, H) * 0.45 * intensity;
    const h = hue === -1 ? (i * 30 + time * 25) % 360 : hue + i * 5;
    ctx.strokeStyle = `hsla(${h},80%,55%,${0.3 + Math.sin(time + i) * 0.2})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(1, r), 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawAurora(ctx, W, H, hue, intensity) {
  ctx.fillStyle = 'rgba(0,0,8,.08)';
  ctx.fillRect(0, 0, W, H);
  for (let band = 0; band < 5; band++) {
    ctx.beginPath();
    const yOff = H * 0.3 + band * 40;
    for (let x = 0; x < W; x += 4) {
      const y = yOff + Math.sin(x * 0.005 + time + band) * 60 * intensity + Math.sin(x * 0.01 + time * 1.5) * 30;
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
    const h = hue === -1 ? (band * 50 + time * 15) % 360 : hue + band * 20 - 30;
    ctx.fillStyle = `hsla(${h},70%,45%,${0.06 * intensity})`;
    ctx.fill();
  }
}

function drawFire(ctx, W, H, intensity) {
  ctx.fillStyle = 'rgba(0,0,0,.1)';
  ctx.fillRect(0, 0, W, H);
  for (const p of particles) {
    p.y -= (2 + Math.random() * 3) * intensity;
    p.x += (Math.random() - 0.5) * 2;
    p.life -= 0.008;
    if (p.y < 0 || p.life <= 0) { p.x = Math.random() * W; p.y = H; p.life = 1; p.r = Math.random() * 4 + 1; }
    const h = 20 + p.life * 30;
    ctx.beginPath();
    ctx.fillStyle = `hsla(${h},100%,50%,${p.life * intensity * 0.7})`;
    ctx.arc(p.x, p.y, p.r * p.life * intensity * 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawGeometric(ctx, W, H, hue, intensity) {
  ctx.fillStyle = 'rgba(0,0,0,.08)';
  ctx.fillRect(0, 0, W, H);
  const cx = W / 2, cy = H / 2;
  for (let shape = 0; shape < 6; shape++) {
    const sides = shape + 3;
    const r = 40 + shape * 40 * intensity;
    const rot = time * (0.3 + shape * 0.15) * (shape % 2 ? 1 : -1);
    const h = hue === -1 ? (shape * 60 + time * 20) % 360 : hue + shape * 8;
    ctx.strokeStyle = `hsla(${h},80%,55%,${0.5 * intensity})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i <= sides; i++) {
      const a = (i / sides) * Math.PI * 2 + rot;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }
}

function drawGlitch(ctx, W, H, hue, intensity) {
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 15 * intensity; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const w = Math.random() * 200 + 20;
    const h2 = Math.random() * 10 + 2;
    const hc = hue === -1 ? Math.random() * 360 : hue + (Math.random() - 0.5) * 40;
    ctx.fillStyle = `hsla(${hc},100%,50%,${Math.random() * 0.5 * intensity})`;
    ctx.fillRect(x, y, w, h2);
  }
  if (Math.random() > 0.7) {
    const shift = (Math.random() - 0.5) * 20 * intensity;
    const sliceY = Math.random() * H;
    const sliceH = Math.random() * 50 + 10;
    const imgData = ctx.getImageData(0, sliceY, W, sliceH);
    ctx.putImageData(imgData, shift, sliceY);
  }
  ctx.fillStyle = '#fff';
  ctx.font = `${14 + Math.random() * 20}px monospace`;
  ctx.fillText(Math.random().toString(36).substring(2, 8), Math.random() * W, Math.random() * H);
}

function drawOcean(ctx, W, H, intensity) {
  ctx.fillStyle = 'rgba(0,5,20,.1)';
  ctx.fillRect(0, 0, W, H);
  for (let wave = 0; wave < 8; wave++) {
    ctx.beginPath();
    const yBase = H * 0.4 + wave * 35;
    for (let x = 0; x < W; x += 3) {
      const y = yBase + Math.sin(x * 0.008 + time * (1 + wave * 0.2) + wave) * 25 * intensity + Math.sin(x * 0.015 + time * 0.8) * 12;
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
    ctx.fillStyle = `hsla(${200 + wave * 8},70%,${30 + wave * 4}%,${0.08 * intensity})`;
    ctx.fill();
  }
  for (let i = 0; i < 5; i++) {
    const bx = (time * 30 + i * 200) % (W + 100) - 50;
    const by = H * 0.35 + Math.sin(time + i) * 15;
    ctx.fillStyle = `rgba(255,255,255,${0.08 * intensity})`;
    ctx.beginPath(); ctx.arc(bx, by, 3, 0, Math.PI * 2); ctx.fill();
  }
}

/* ═══ RENDERING ═══ */
async function renderVideo() {
  const c = document.getElementById('vid-canvas');
  if (!c || isRendering) return;
  isRendering = true;
  const btn = document.getElementById('btn-vid-render');
  if (btn) btn.disabled = true;
  setStatus('Rendering video...');

  const progress = document.getElementById('render-progress');
  const bar = document.getElementById('render-bar');
  if (progress) progress.style.display = 'block';

  try {
    const stream = c.captureStream(30);
    const options = { mimeType: 'video/webm;codecs=vp9' };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options.mimeType = 'video/webm';
    }
    recorder = new MediaRecorder(stream, options);
    chunks = [];
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const sizeMB = (blob.size / 1048576).toFixed(1);

      renderedVideos.unshift({
        id: crypto.randomUUID(),
        name: `${STYLES.find(s => s.id === currentStyle)?.name || 'Video'} — ${c.width}×${c.height}`,
        url, size: sizeMB + ' MB',
        ts: Date.now(),
      });
      renderVideoList();

      const a = document.createElement('a');
      a.href = url; a.download = `dieter-pro-${currentStyle}-${Date.now()}.webm`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);

      isRendering = false;
      if (btn) btn.disabled = false;
      if (progress) progress.style.display = 'none';
      setStatus(`Rendered! ${sizeMB} MB — downloading...`);
      state.log('Video Engine', `Rendered ${currentStyle} video · ${sizeMB} MB`);
    };

    if (!playing) startVideo();
    recorder.start();

    const duration = 5000;
    const steps = 50;
    for (let i = 0; i <= steps; i++) {
      await sleep(duration / steps);
      if (bar) bar.style.width = ((i / steps) * 100) + '%';
      setStatus(`Rendering... ${Math.round((i / steps) * 100)}%`);
    }

    recorder.stop();
  } catch (e) {
    isRendering = false;
    if (btn) btn.disabled = false;
    if (progress) progress.style.display = 'none';
    setStatus('Render error: ' + e.message);
  }
}

function takeScreenshot() {
  const c = document.getElementById('vid-canvas');
  if (!c) return;
  const a = document.createElement('a');
  a.href = c.toDataURL('image/png');
  a.download = `dieter-pro-${currentStyle}-${Date.now()}.png`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setStatus('Screenshot saved!');
}

function renderVideoList() {
  const el = document.getElementById('rendered-list');
  if (!el) return;
  el.innerHTML = renderedVideos.length ? renderedVideos.map(v => `
    <div class="track-row">
      <span style="color:var(--purple)">${icon('disc', 16)}</span>
      <div class="track-info">
        <div class="track-title">${v.name}</div>
        <div class="track-meta">${v.size} · ${new Date(v.ts).toLocaleTimeString()}</div>
      </div>
      <a href="${v.url}" download class="btn btn-green btn-sm">${icon('download', 12)} Save</a>
    </div>
  `).join('') : '<div style="text-align:center;color:var(--dim);padding:14px;font-size:.66rem">No rendered videos yet</div>';
}

/* ═══ AI IMAGE: Replicate (version resolved at runtime) + Pollinations fallback ═══ */
const AI_MODELS = {
  'flux-schnell': {
    name: 'Flux Schnell',
    owner: 'black-forest-labs',
    model: 'flux-schnell',
    buildInput(prompt, opts) {
      return {
        prompt,
        aspect_ratio: opts.ratio || '16:9',
        output_format: (opts.format || 'webp').replace('jpg', 'jpeg'),
        output_quality: Math.min(100, Math.max(1, +(opts.quality || 80))),
        num_inference_steps: 4,
      };
    },
  },
  'flux-1.1-pro': {
    name: 'Flux 1.1 Pro',
    owner: 'black-forest-labs',
    model: 'flux-1.1-pro',
    buildInput(prompt, opts) {
      return {
        prompt,
        aspect_ratio: opts.ratio || '16:9',
        output_format: (opts.format || 'webp').replace('jpg', 'jpeg'),
        output_quality: Math.min(100, Math.max(1, +(opts.quality || 80))),
        safety_tolerance: Math.min(5, Math.max(1, +(opts.safety || 2))),
      };
    },
  },
  'flux-dev': {
    name: 'Flux Dev',
    owner: 'black-forest-labs',
    model: 'flux-dev',
    buildInput(prompt, opts) {
      const input = {
        prompt,
        num_inference_steps: +(opts.steps || 28),
        guidance_scale: +(opts.guidance || 3.5),
        aspect_ratio: opts.ratio || '16:9',
        output_format: (opts.format || 'webp').replace('jpg', 'jpeg'),
        output_quality: Math.min(100, Math.max(1, +(opts.quality || 80))),
      };
      return input;
    },
  },
};

async function replicateFetchLatestVersion(owner, model, token) {
  const r = await fetch(`https://api.replicate.com/v1/models/${owner}/${model}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Replicate model ${owner}/${model}: ${r.status} ${text.slice(0, 400)}`);
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Replicate model ${owner}/${model}: invalid JSON`);
  }
  const vid = data.latest_version?.id;
  if (!vid) throw new Error(`No latest_version for ${owner}/${model}`);
  return vid;
}

async function replicateRunPrediction(version, input, token) {
  const resp = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'wait',
    },
    body: JSON.stringify({ version, input }),
  });
  const text = await resp.text();
  if (!resp.ok) throw new Error(`Replicate ${resp.status}: ${text.slice(0, 500)}`);
  const data = JSON.parse(text);
  if (data.status === 'failed') throw new Error(data.error || 'Replicate prediction failed');
  let out = data.output;
  if (!out && data.urls?.get) {
    out = await pollPrediction(data.urls.get, token, 'Replicate');
  }
  const imageUrl = Array.isArray(out) ? out[0] : out;
  if (!imageUrl || typeof imageUrl !== 'string') throw new Error('Replicate returned no image URL');
  return imageUrl;
}

/** No API key — lower quality, good for previews. https://pollinations.ai/ */
function pollinationsImageUrl(prompt, opts) {
  const ratio = opts.ratio || '16:9';
  let w = 1280;
  let h = 720;
  if (ratio === '1:1') { w = h = 1024; }
  else if (ratio === '9:16') { w = 720; h = 1280; }
  else if (ratio === '4:3') { w = 1280; h = 960; }
  else if (ratio === '21:9') { w = 1680; h = 720; }
  const model = 'flux';
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${w}&height=${h}&model=${model}&nologo=true`;
}

async function generateAIImage() {
  if (aiGenerating) return;

  const prompt = document.getElementById('ai-vid-prompt')?.value?.trim();
  if (!prompt) { setAIStatus('Write a description first!'); return; }

  let token = document.getElementById('ai-vid-token')?.value?.trim();
  if (!token) { try { token = localStorage.getItem('dp-replicate-token') || ''; } catch {} }

  const modelKey = document.getElementById('ai-vid-model')?.value || 'flux-schnell';
  const model = AI_MODELS[modelKey];
  if (!model) { setAIStatus('Unknown model'); return; }

  const opts = {
    ratio: document.getElementById('ai-vid-ratio')?.value || '16:9',
    megapixels: document.getElementById('ai-vid-megapixels')?.value || '1 MP',
    format: document.getElementById('ai-vid-format')?.value || 'webp',
    quality: document.getElementById('ai-vid-quality')?.value || '80',
    safety: document.getElementById('ai-vid-safety')?.value || '2',
    steps: document.getElementById('ai-vid-steps')?.value || '35',
    guidance: document.getElementById('ai-vid-guidance')?.value || '7',
  };

  const input = model.buildInput(prompt, opts);

  aiGenerating = true;
  const btn = document.getElementById('btn-ai-generate');
  if (btn) { btn.disabled = true; btn.textContent = 'Generating...'; }

  if (token) {
    try { localStorage.setItem('dp-replicate-token', token); } catch {}
  }

  setAIStatus(token ? `${model.name} via Replicate…` : `${model.name} via Pollinations (no token)…`);

  try {
    let imageUrl = null;
    let used = model.name;

    if (token) {
      try {
        const version = await replicateFetchLatestVersion(model.owner, model.model, token);
        imageUrl = await replicateRunPrediction(version, input, token);
        used = `${model.name} (Replicate)`;
      } catch (repErr) {
        setAIStatus(`Replicate: ${repErr.message} — trying Pollinations…`);
        state.log('AI Generator', `Replicate fallback: ${repErr.message}`);
        imageUrl = pollinationsImageUrl(prompt, opts);
        used = 'Pollinations (fallback)';
      }
    } else {
      imageUrl = pollinationsImageUrl(prompt, opts);
      used = 'Pollinations';
    }

    if (!imageUrl) throw new Error('No image URL');

    const ext = opts.format || 'webp';
    aiResults.unshift({
      id: crypto.randomUUID(),
      prompt: prompt.slice(0, 80),
      url: imageUrl,
      model: used,
      ratio: opts.ratio || 'default',
      format: ext,
      ts: Date.now(),
    });
    renderAIResults();
    setAIStatus(`${used} — Done! Click "Use as BG" or save the image.`);
    state.log('AI Generator', `${used}: "${prompt.slice(0, 50)}..."`);
  } catch (e) {
    setAIStatus('Error: ' + e.message);
    state.log('AI Generator', `Error: ${e.message}`);
  }

  aiGenerating = false;
  if (btn) { btn.disabled = false; btn.innerHTML = `${icon('zap', 14)} Generate image`; }
}

async function pollPrediction(url, token, modelName = 'AI') {
  for (let i = 0; i < 90; i++) {
    await sleep(2000);
    setAIStatus(`${modelName}: Generating... (${(i + 1) * 2}s)`);
    try {
      const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
      if (!resp.ok) continue;
      const data = await resp.json();
      if (data.status === 'succeeded' && data.output) {
        return Array.isArray(data.output) ? data.output[0] : data.output;
      }
      if (data.status === 'failed') throw new Error(data.error || 'Generation failed');
    } catch (e) {
      if (e.message.includes('failed')) throw e;
    }
  }
  throw new Error('Timed out waiting for result');
}

function renderAIResults() {
  const el = document.getElementById('ai-vid-results');
  if (!el) return;

  if (!aiResults.length) {
    el.innerHTML = '<div style="text-align:center;color:var(--dim);padding:8px;font-size:.58rem">Describe what you want and hit Generate</div>';
    return;
  }

  el.innerHTML = aiResults.map(r => `
    <div class="ai-result-card" style="margin-bottom:8px;border:1px solid var(--border);border-radius:8px;overflow:hidden;cursor:pointer;transition:border-color .2s" data-aiurl="${r.url}">
      <img src="${r.url}" alt="${r.prompt}" style="width:100%;display:block;max-height:200px;object-fit:cover" loading="lazy" crossorigin="anonymous"/>
      <div style="padding:6px 8px">
        <div style="font-size:.6rem;color:var(--dim);margin-bottom:2px">${r.prompt}</div>
        <div style="display:flex;align-items:center;gap:4px;margin-bottom:3px">
          <span style="font-size:.48rem;color:var(--purple);border:1px solid rgba(168,85,247,.3);padding:1px 5px;border-radius:4px">${r.model || 'Flux'}</span>
          <span style="font-size:.48rem;color:var(--dim)">${r.ratio || ''} · ${(r.format || 'webp').toUpperCase()}</span>
        </div>
        <div style="display:flex;gap:4px">
          <a href="${r.url}" download="dieter-flux-${r.id.slice(0,8)}.${r.format || 'webp'}" class="btn btn-green btn-sm" style="font-size:.52rem" target="_blank">${icon('download', 10)} Save</a>
          <button class="btn btn-primary btn-sm ai-use-bg" data-aiurl="${r.url}" style="font-size:.52rem">${icon('disc', 10)} Use as BG</button>
        </div>
      </div>
    </div>
  `).join('');

  el.querySelectorAll('.ai-use-bg').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      useAsBackground(btn.dataset.aiurl);
    });
  });
}

function useAsBackground(url) {
  const c = document.getElementById('vid-canvas');
  if (!c) return;
  const ctx = c.getContext('2d');
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    pauseVideo();
    ctx.clearRect(0, 0, c.width, c.height);
    const scale = Math.max(c.width / img.width, c.height / img.height);
    const w = img.width * scale, h = img.height * scale;
    ctx.drawImage(img, (c.width - w) / 2, (c.height - h) / 2, w, h);
    ctx.fillStyle = 'rgba(0,0,0,.4)';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = 'rgba(255,255,255,.6)';
    ctx.font = '10px system-ui';
    ctx.fillText('DIETER PRO — AI Generated — Licensed to EDUARD GEERDES', 10, c.height - 8);
    setStatus('AI image set as video background');
    state.log('Video Engine', 'AI-generated image applied as background');
  };
  img.onerror = () => setStatus('Failed to load AI image');
  img.src = url;
}

function setAIStatus(msg) {
  const el = document.getElementById('ai-vid-status');
  if (el) el.textContent = msg;
}

function setStatus(msg) {
  const el = document.getElementById('vid-status');
  if (el) el.textContent = msg;
}

function setupSlider(inputId, valId) {
  const input = document.getElementById(inputId);
  const val = document.getElementById(valId);
  if (input && val) input.addEventListener('input', () => { val.textContent = input.value; });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
