/* Album Cover Generator — Canvas-based art creation */

import * as state from '../state.js';
import { navigate } from '../router.js';
import { icon } from '../icons.js';

const TEMPLATES = [
  { id: 'gradient1', name: 'Purple Haze', bg: ['#a855f7', '#6d28d9', '#1e1b4b'], text: '#fff' },
  { id: 'gradient2', name: 'Ocean Blue', bg: ['#06b6d4', '#0ea5e9', '#0c4a6e'], text: '#fff' },
  { id: 'gradient3', name: 'Fire Red', bg: ['#ef4444', '#f97316', '#451a03'], text: '#fff' },
  { id: 'gradient4', name: 'Neon Green', bg: ['#22c55e', '#10b981', '#022c22'], text: '#fff' },
  { id: 'gradient5', name: 'Sunset Pink', bg: ['#ec4899', '#f43f5e', '#4c0519'], text: '#fff' },
  { id: 'gradient6', name: 'Gold Rush', bg: ['#eab308', '#f59e0b', '#422006'], text: '#000' },
  { id: 'gradient7', name: 'Midnight', bg: ['#1e1b4b', '#312e81', '#000'], text: '#c084fc' },
  { id: 'gradient8', name: 'Ice White', bg: ['#e5e7eb', '#d1d5db', '#9ca3af'], text: '#111' },
  { id: 'gradient9', name: 'Cyberpunk', bg: ['#f0abfc', '#a855f7', '#18181b'], text: '#fef08a' },
  { id: 'gradient10', name: 'Deep Space', bg: ['#020617', '#0f172a', '#1e293b'], text: '#38bdf8' },
  { id: 'gradient11', name: 'Tropical', bg: ['#34d399', '#06b6d4', '#1e3a5f'], text: '#fff' },
  { id: 'gradient12', name: 'Blood Moon', bg: ['#7f1d1d', '#991b1b', '#000'], text: '#fca5a5' },
];

let selectedTemplate = TEMPLATES[0];
let generatedCovers = [];

export function render() {
  return `
    <div class="split">
      <div class="split-left">
        <div class="panel">
          <div class="panel-header">${icon('disc', 16)} Cover Details</div>
          <div style="margin-bottom:6px">
            <label>Artist Name</label>
            <input type="text" id="cover-artist" placeholder="EDUARD GEERDES" value="EDUARD GEERDES"/>
          </div>
          <div style="margin-bottom:6px">
            <label>Track / Album Title</label>
            <input type="text" id="cover-title" placeholder="Enter title..."/>
          </div>
          <div style="margin-bottom:6px">
            <label>Subtitle (optional)</label>
            <input type="text" id="cover-subtitle" placeholder="e.g. Deluxe Edition, Single, EP..."/>
          </div>
          <div class="grid-2" style="margin-bottom:6px">
            <div>
              <label>Size</label>
              <select id="cover-size">
                <option value="1400">1400 × 1400 (Standard)</option>
                <option value="3000" selected>3000 × 3000 (HD)</option>
                <option value="1080">1080 × 1080 (Social)</option>
              </select>
            </div>
            <div>
              <label>Style</label>
              <select id="cover-style">
                <option value="centered">Centered</option>
                <option value="bottom">Bottom Aligned</option>
                <option value="top">Top Left</option>
                <option value="minimal">Minimal</option>
                <option value="bold">Bold</option>
              </select>
            </div>
          </div>
          <div style="margin-bottom:6px">
            <label>Custom Image (optional)</label>
            <input type="file" id="cover-image" accept="image/*"/>
          </div>
          <div class="slider-row">
            <label>Overlay</label>
            <input type="range" id="cover-overlay" min="0" max="100" value="40"/>
            <span class="slider-val" id="cover-overlay-val">40%</span>
          </div>
        </div>

        <div class="panel">
          <div class="panel-header">${icon('star', 16)} Templates</div>
          <div class="grid-3" id="template-grid">
            ${TEMPLATES.map(t => `
              <div class="vid-style-card${t.id === selectedTemplate.id ? ' active' : ''}" data-tpl="${t.id}" style="padding:6px">
                <div style="width:100%;height:36px;border-radius:5px;background:linear-gradient(135deg,${t.bg.join(',')});margin-bottom:3px"></div>
                <div class="vs-name" style="font-size:.56rem">${t.name}</div>
              </div>
            `).join('')}
          </div>
        </div>

        <div style="display:flex;gap:4px">
          <button class="action-btn" id="btn-gen-cover" style="flex:1">${icon('zap', 16)} Generate Cover</button>
        </div>
        <div class="status-text" id="cover-status"></div>
      </div>

      <div class="split-right">
        <div class="panel">
          <div class="panel-header">${icon('disc', 16)} Preview</div>
          <canvas id="cover-canvas" style="width:100%;max-width:500px;aspect-ratio:1;border-radius:var(--radius);background:#0a0a12;display:block;margin:0 auto;border:1px solid var(--border)"></canvas>
          <div style="display:flex;gap:4px;margin-top:8px;justify-content:center">
            <button class="btn btn-primary" id="btn-download-cover">${icon('download', 14)} Download PNG</button>
            <button class="btn btn-blue" id="btn-download-jpg">${icon('download', 14)} Download JPG</button>
            <button class="btn btn-green" id="btn-cover-to-library">${icon('plus', 14)} Add to Library</button>
          </div>
        </div>

        <div class="panel">
          <div class="panel-header">${icon('disc', 16)} Generated Covers <span class="panel-header-right" id="covers-count">${generatedCovers.length}</span></div>
          <div id="covers-list" style="max-height:200px;overflow-y:auto"></div>
        </div>

        <div class="panel">
          <div class="panel-header">${icon('zap', 16)} Quick Routes</div>
          <div style="display:flex;gap:3px;flex-wrap:wrap">
            <button class="btn btn-primary btn-sm" data-goto="library">${icon('disc', 12)} Library</button>
            <button class="btn btn-orange btn-sm" data-goto="video">${icon('disc', 12)} Video</button>
            <button class="btn btn-blue btn-sm" data-goto="social">${icon('share', 12)} Social</button>
            <button class="btn btn-green btn-sm" data-goto="portals">${icon('globe', 12)} Distribute</button>
            <button class="btn btn-pink btn-sm" data-goto="mureka">${icon('zap', 12)} Mureka</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

let customImage = null;

export function init() {
  document.querySelectorAll('[data-tpl]').forEach(el => {
    el.addEventListener('click', () => {
      selectedTemplate = TEMPLATES.find(t => t.id === el.dataset.tpl) || TEMPLATES[0];
      document.querySelectorAll('[data-tpl]').forEach(x => x.classList.toggle('active', x.dataset.tpl === selectedTemplate.id));
      generateCover();
    });
  });

  document.getElementById('cover-image')?.addEventListener('change', e => {
    const file = e.target.files?.[0];
    if (file) {
      const img = new Image();
      img.onload = () => { customImage = img; generateCover(); };
      img.src = URL.createObjectURL(file);
    }
  });

  const overlaySlider = document.getElementById('cover-overlay');
  const overlayVal = document.getElementById('cover-overlay-val');
  if (overlaySlider) overlaySlider.addEventListener('input', () => {
    if (overlayVal) overlayVal.textContent = overlaySlider.value + '%';
    generateCover();
  });

  ['cover-artist', 'cover-title', 'cover-subtitle', 'cover-size', 'cover-style'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', generateCover);
    document.getElementById(id)?.addEventListener('change', generateCover);
  });

  document.getElementById('btn-gen-cover')?.addEventListener('click', generateCover);
  document.getElementById('btn-download-cover')?.addEventListener('click', () => downloadCover('png'));
  document.getElementById('btn-download-jpg')?.addEventListener('click', () => downloadCover('jpeg'));
  document.getElementById('btn-cover-to-library')?.addEventListener('click', addCoverToLibrary);

  document.querySelectorAll('[data-goto]').forEach(el => {
    el.addEventListener('click', () => navigate(el.dataset.goto));
  });

  generateCover();
  renderCoversList();
}

function generateCover() {
  const canvas = document.getElementById('cover-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const size = parseInt(document.getElementById('cover-size')?.value || '3000');
  canvas.width = size;
  canvas.height = size;

  const tpl = selectedTemplate;
  const artist = document.getElementById('cover-artist')?.value || 'ARTIST';
  const title = document.getElementById('cover-title')?.value || 'UNTITLED';
  const subtitle = document.getElementById('cover-subtitle')?.value || '';
  const style = document.getElementById('cover-style')?.value || 'centered';
  const overlay = parseInt(document.getElementById('cover-overlay')?.value || '40') / 100;

  const grad = ctx.createLinearGradient(0, 0, size, size);
  tpl.bg.forEach((c, i) => grad.addColorStop(i / (tpl.bg.length - 1), c));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  addPatternOverlay(ctx, size, tpl);

  if (customImage) {
    const aspect = customImage.width / customImage.height;
    let dw = size, dh = size;
    if (aspect > 1) { dh = size / aspect; } else { dw = size * aspect; }
    const dx = (size - dw) / 2, dy = (size - dh) / 2;
    ctx.drawImage(customImage, dx, dy, dw, dh);
    ctx.fillStyle = `rgba(0,0,0,${overlay})`;
    ctx.fillRect(0, 0, size, size);
  }

  const scale = size / 3000;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (style === 'centered') {
    drawTextCentered(ctx, size, scale, artist, title, subtitle, tpl);
  } else if (style === 'bottom') {
    drawTextBottom(ctx, size, scale, artist, title, subtitle, tpl);
  } else if (style === 'top') {
    drawTextTop(ctx, size, scale, artist, title, subtitle, tpl);
  } else if (style === 'minimal') {
    drawTextMinimal(ctx, size, scale, artist, title, subtitle, tpl);
  } else if (style === 'bold') {
    drawTextBold(ctx, size, scale, artist, title, subtitle, tpl);
  }

  ctx.fillStyle = 'rgba(168,85,247,.35)';
  ctx.font = `${Math.round(28 * scale)}px -apple-system, sans-serif`;
  ctx.textAlign = 'right';
  ctx.fillText('DIETER PRO', size - 40 * scale, size - 30 * scale);

  const statusEl = document.getElementById('cover-status');
  if (statusEl) statusEl.textContent = `Cover generated · ${size}×${size}px`;
}

function addPatternOverlay(ctx, size, tpl) {
  ctx.globalAlpha = 0.04;
  const step = size / 20;
  for (let i = 0; i < 20; i++) {
    for (let j = 0; j < 20; j++) {
      if ((i + j) % 3 === 0) {
        ctx.beginPath();
        ctx.arc(i * step + step / 2, j * step + step / 2, step * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = tpl.text;
        ctx.fill();
      }
    }
  }
  ctx.globalAlpha = 1;
}

function drawTextCentered(ctx, size, scale, artist, title, subtitle, tpl) {
  ctx.fillStyle = tpl.text;
  ctx.font = `900 ${Math.round(180 * scale)}px -apple-system, 'SF Pro Display', 'Segoe UI', sans-serif`;
  ctx.fillText(title.toUpperCase(), size / 2, size / 2);
  ctx.font = `300 ${Math.round(80 * scale)}px -apple-system, sans-serif`;
  ctx.fillText(artist, size / 2, size / 2 + 140 * scale);
  if (subtitle) {
    ctx.font = `200 ${Math.round(50 * scale)}px -apple-system, sans-serif`;
    ctx.globalAlpha = 0.6;
    ctx.fillText(subtitle, size / 2, size / 2 + 220 * scale);
    ctx.globalAlpha = 1;
  }
}

function drawTextBottom(ctx, size, scale, artist, title, subtitle, tpl) {
  ctx.fillStyle = 'rgba(0,0,0,.4)';
  ctx.fillRect(0, size * 0.7, size, size * 0.3);
  ctx.fillStyle = tpl.text;
  ctx.font = `900 ${Math.round(150 * scale)}px -apple-system, sans-serif`;
  ctx.fillText(title.toUpperCase(), size / 2, size * 0.82);
  ctx.font = `300 ${Math.round(70 * scale)}px -apple-system, sans-serif`;
  ctx.fillText(artist, size / 2, size * 0.9);
  if (subtitle) {
    ctx.font = `200 ${Math.round(44 * scale)}px -apple-system, sans-serif`;
    ctx.globalAlpha = 0.6;
    ctx.fillText(subtitle, size / 2, size * 0.95);
    ctx.globalAlpha = 1;
  }
}

function drawTextTop(ctx, size, scale, artist, title, subtitle, tpl) {
  ctx.textAlign = 'left';
  ctx.fillStyle = tpl.text;
  ctx.font = `900 ${Math.round(120 * scale)}px -apple-system, sans-serif`;
  ctx.fillText(title.toUpperCase(), 80 * scale, 200 * scale);
  ctx.font = `300 ${Math.round(60 * scale)}px -apple-system, sans-serif`;
  ctx.fillText(artist, 80 * scale, 300 * scale);
  if (subtitle) {
    ctx.font = `200 ${Math.round(40 * scale)}px -apple-system, sans-serif`;
    ctx.globalAlpha = 0.6;
    ctx.fillText(subtitle, 80 * scale, 370 * scale);
    ctx.globalAlpha = 1;
  }
  ctx.textAlign = 'center';
}

function drawTextMinimal(ctx, size, scale, artist, title, subtitle, tpl) {
  ctx.fillStyle = tpl.text;
  ctx.font = `100 ${Math.round(100 * scale)}px -apple-system, sans-serif`;
  ctx.fillText(title, size / 2, size / 2 - 20 * scale);
  ctx.font = `100 ${Math.round(50 * scale)}px -apple-system, sans-serif`;
  ctx.globalAlpha = 0.5;
  ctx.fillText(artist, size / 2, size / 2 + 60 * scale);
  ctx.globalAlpha = 1;
}

function drawTextBold(ctx, size, scale, artist, title, subtitle, tpl) {
  ctx.fillStyle = tpl.text;
  ctx.font = `900 ${Math.round(260 * scale)}px -apple-system, sans-serif`;
  const words = title.toUpperCase().split(' ');
  const lineH = 280 * scale;
  const startY = size / 2 - ((words.length - 1) * lineH) / 2;
  words.forEach((w, i) => ctx.fillText(w, size / 2, startY + i * lineH));
  ctx.font = `600 ${Math.round(70 * scale)}px -apple-system, sans-serif`;
  ctx.globalAlpha = 0.7;
  ctx.fillText(artist, size / 2, startY + words.length * lineH);
  ctx.globalAlpha = 1;
}

function downloadCover(format) {
  const canvas = document.getElementById('cover-canvas');
  if (!canvas) return;
  const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png';
  const ext = format === 'jpeg' ? 'jpg' : 'png';
  const artist = document.getElementById('cover-artist')?.value || 'artist';
  const title = document.getElementById('cover-title')?.value || 'cover';
  const filename = `${artist.replace(/\s+/g, '-')}-${title.replace(/\s+/g, '-')}.${ext}`;

  canvas.toBlob(blob => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);

    generatedCovers.unshift({
      name: filename,
      size: (blob.size / 1024).toFixed(0) + ' KB',
      ts: Date.now(),
    });
    renderCoversList();
    state.log('Covers', `Downloaded ${filename}`);
  }, mime, format === 'jpeg' ? 0.95 : undefined);
}

function addCoverToLibrary() {
  const title = document.getElementById('cover-title')?.value || 'Cover Art';
  const artist = document.getElementById('cover-artist')?.value || 'EDUARD GEERDES';
  generatedCovers.unshift({ name: `${artist} - ${title}`, size: 'Cover', ts: Date.now() });
  renderCoversList();
  state.log('Covers', `Added "${title}" cover to collection`);
  const statusEl = document.getElementById('cover-status');
  if (statusEl) statusEl.textContent = `Cover "${title}" saved!`;
}

function renderCoversList() {
  const el = document.getElementById('covers-list');
  const countEl = document.getElementById('covers-count');
  if (countEl) countEl.textContent = generatedCovers.length;
  if (!el) return;
  el.innerHTML = generatedCovers.length ? generatedCovers.map(c => `
    <div class="track-row">
      <span style="color:var(--purple)">${icon('disc', 16)}</span>
      <div class="track-info">
        <div class="track-title">${c.name}</div>
        <div class="track-meta">${c.size} · ${new Date(c.ts).toLocaleTimeString()}</div>
      </div>
    </div>
  `).join('') : '<div style="text-align:center;color:var(--dim);padding:14px;font-size:.66rem">Generate your first cover above</div>';
}
