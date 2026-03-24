/* DIETER PRO Platform — Main Application Bootstrap */

import * as state from './state.js';
import * as engine from './engine.js';
import * as router from './router.js';
import * as agents from './agents.js';
import * as voiceEngine from './voices.js';
import { icon } from './icons.js';

import * as homePage from './pages/home.js';
import * as lyricsPage from './pages/lyrics.js';
import * as createPage from './pages/create.js';
import * as beatsPage from './pages/beats.js';
import * as libraryPage from './pages/library.js';
import * as previewsPage from './pages/previews.js';
import * as trendingPage from './pages/trending.js';
import * as newsPage from './pages/news.js';
import * as portalsPage from './pages/portals.js';
import * as mixerPage from './pages/mixer.js';
import * as videoPage from './pages/video.js';
import * as socialPage from './pages/social.js';
import * as murekaPage from './pages/mureka.js';
import * as coversPage from './pages/covers.js';
import * as soldiersPage from './pages/soldiers.js';

/* ═══ BOOTSTRAP ═══ */
(function boot() {
  try {
    console.log('%c DIETER PRO PLATFORM ', 'background:linear-gradient(135deg,#a855f7,#7c3aed);color:#fff;font-weight:900;font-size:14px;padding:4px 12px;border-radius:4px');

    agents.setupErrorHandling();
    buildSidebar();
    initStars();

    router.register('home', homePage);
    router.register('lyrics', lyricsPage);
    router.register('create', createPage);
    router.register('beats', beatsPage);
    router.register('library', libraryPage);
    router.register('previews', previewsPage);
    router.register('trending', trendingPage);
    router.register('news', newsPage);
    router.register('portals', portalsPage);
    router.register('mixer', mixerPage);
    router.register('video', videoPage);
    router.register('social', socialPage);
    router.register('mureka', murekaPage);
    router.register('covers', coversPage);
    router.register('soldiers', soldiersPage);

    router.init();

    agents.createAgents();
    agents.startAll();
    agents.setupWifiMonitor();

    const toggle = document.getElementById('sb-toggle');
    if (toggle) {
      toggle.addEventListener('click', () => {
        document.getElementById('sidebar')?.classList.toggle('collapsed');
      });
    }

    startPerfLoop();

    voiceEngine.loadVoices().then(v => {
      state.log('Voice Engine', `${v.length} real voices pre-loaded at boot`);
    });

    state.log('System', 'DIETER PRO Platform initialized successfully');
    state.log('Audio Engine', 'WebAudio API ready — all genres & moods active');
    state.log('Network / WiFi', navigator.onLine ? 'Connected to internet' : 'Offline mode');

    const toggleBtn = document.getElementById('sb-toggle');
    if (toggleBtn) toggleBtn.innerHTML = icon('menu', 18);

    console.log('[Platform] Boot complete');
  } catch (e) {
    console.error('[Platform] Boot error:', e);
    const overlay = document.getElementById('error-overlay');
    const msgEl = document.getElementById('error-msg');
    if (overlay && msgEl) {
      msgEl.textContent = 'Failed to initialize: ' + e.message;
      overlay.hidden = false;
    }
  }
})();

/* ═══ SIDEBAR WITH HD ICONS ═══ */
function buildSidebar() {
  const nav = document.getElementById('sbnav');
  if (!nav) return;
  const groups = [
    { label: 'Dashboard', items: [
      { page: 'home', icon: 'home', text: 'Home' },
    ]},
    { label: 'Create', items: [
      { page: 'lyrics', icon: 'lyrics', text: 'Lyrics Studio', badge: 'NEW', badgeColor: 'purple' },
      { page: 'create', icon: 'music', text: 'Create Music', badge: 'AI', badgeColor: 'blue' },
      { page: 'mixer', icon: 'sliders', text: 'Mix & Fade' },
    ]},
    { label: 'Visuals', items: [
      { page: 'covers', icon: 'disc', text: 'Album Covers', badge: 'NEW', badgeColor: 'purple' },
      { page: 'video', icon: 'disc', text: 'Video Engine', badge: 'HD', badgeColor: 'purple' },
      { page: 'beats', icon: 'activity', text: 'Beat Detection', badge: 'REAL', badgeColor: 'orange' },
    ]},
    { label: 'Library', items: [
      { page: 'library', icon: 'disc', text: 'My Tracks' },
      { page: 'previews', icon: 'headphones', text: 'Preview & Play' },
    ]},
    { label: 'Connected', items: [
      { page: 'trending', icon: 'trending', text: 'Trending', badge: 'LIVE', badgeColor: 'green' },
      { page: 'news', icon: 'newspaper', text: 'Live News', badge: 'LIVE', badgeColor: 'green' },
    ]},
    { label: 'Mureka AI', items: [
      { page: 'mureka', icon: 'zap', text: 'Mureka AI', badge: 'SYNC', badgeColor: 'purple' },
    ]},
    { label: 'Share & Distribute', items: [
      { page: 'social', icon: 'share', text: 'Social Media', badge: 'NEW', badgeColor: 'purple' },
      { page: 'portals', icon: 'globe', text: 'Portals' },
    ]},
    { label: 'System', items: [
      { page: 'soldiers', icon: 'shield', text: 'Task Soldiers' },
    ]},
  ];

  nav.innerHTML = groups.map(g => `
    <div class="sb-group">
      <div class="sb-group-label">${g.label}</div>
      ${g.items.map(item => `
        <a class="sb-item${item.page === 'home' ? ' active' : ''}" href="#/${item.page}" data-page="${item.page}">
          <span class="sb-ic">${icon(item.icon, 18)}</span>${item.text}${item.badge ? `<span class="sb-badge ${item.badgeColor}">${item.badge}</span>` : ''}
        </a>
      `).join('')}
    </div>
  `).join('');
}

/* ═══ STAR BACKGROUND ═══ */
function initStars() {
  const canvas = document.getElementById('stars');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  let stars = [];

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    stars = Array.from({ length: 100 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.2 + 0.2,
      a: Math.random(),
      v: Math.random() * 0.008 + 0.002,
    }));
  }

  function draw() {
    requestAnimationFrame(draw);
    try {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const s of stars) {
        s.a += s.v;
        if (s.a > 1 || s.a < 0.05) s.v *= -1;
        ctx.beginPath();
        ctx.fillStyle = `rgba(168,85,247,${s.a.toFixed(2)})`;
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
    } catch { /* safe */ }
  }

  resize();
  draw();
  window.addEventListener('resize', resize);
}

/* ═══ FPS LOOP ═══ */
function startPerfLoop() {
  function tick() {
    requestAnimationFrame(tick);
    agents.perfTick();
  }
  tick();
}
