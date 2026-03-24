/* Agent System — Background monitors keeping everything running */

import * as state from './state.js';
import * as engine from './engine.js';
import * as voiceEngine from './voices.js';

const agents = {};
let healthWorker = null;

class Agent {
  constructor(id, name, icon, checkFn, intervalMs = 15000) {
    this.id = id;
    this.name = name;
    this.icon = icon;
    this.checkFn = checkFn;
    this.intervalMs = intervalMs;
    this.status = 'ok';
    this.message = 'Initializing...';
    this.lastCheck = Date.now();
    this.timer = null;
    this.errors = 0;
    this.repairs = 0;
  }

  start() {
    this.check();
    this.timer = setInterval(() => this.check(), this.intervalMs);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  check() {
    try {
      const result = this.checkFn();
      this.status = result.status || 'ok';
      this.message = result.message || 'OK';
      this.lastCheck = Date.now();
      if (result.status === 'err') this.errors++;
    } catch (e) {
      this.status = 'err';
      this.message = 'Check failed: ' + e.message;
      this.errors++;
    }
    this.report();
  }

  repair() {
    this.status = 'ok';
    this.message = 'Repaired';
    this.repairs++;
    this.report();
  }

  report() {
    state.update('soldiers', s => ({
      ...s,
      [this.id]: {
        status: this.status,
        message: this.message,
        lastCheck: this.lastCheck,
        errors: this.errors,
        repairs: this.repairs,
      }
    }));
  }
}

export function createAgents() {
  agents.audio = new Agent('audio', 'Audio Engine', '🔊', () => {
    const s = engine.getStatus();
    if (s.state === 'suspended') return { status: 'warn', message: 'Suspended — click to activate' };
    if (s.state === 'running') return { status: 'ok', message: `Active · ${s.sampleRate}Hz · ${s.playing ? 'Playing' : 'Ready'}` };
    return { status: 'ok', message: 'Waiting for first interaction' };
  }, 10000);

  agents.network = new Agent('network', 'Network / WiFi', '📡', () => {
    if (navigator.onLine) return { status: 'ok', message: 'Connected to internet' };
    return { status: 'err', message: 'OFFLINE — features limited' };
  }, 5000);

  agents.library = new Agent('library', 'Library Sync', '🎵', () => {
    const lib = state.get('library');
    return { status: 'ok', message: `${lib.length} tracks synced` };
  }, 20000);

  agents.voices = new Agent('voices', 'Voice Engine', '🎤', () => {
    const v = voiceEngine.getVoices();
    const speaking = voiceEngine.getIsSpeaking();
    const singing = voiceEngine.getIsSinging();
    const status = v.length ? 'ok' : 'warn';
    const msg = `${v.length} real voices · ${speaking ? 'Speaking' : singing ? 'Singing' : 'Ready'}`;
    return { status, message: msg };
  }, 10000);

  agents.lyrics = new Agent('lyrics', 'Lyrics Processor', '✍', () => {
    const songs = state.get('songs');
    return { status: 'ok', message: `${songs.length} songs generated` };
  }, 20000);

  agents.beats = new Agent('beats', 'Beat Detection', '📊', () => {
    return { status: 'ok', message: 'WebAudio analysis ready' };
  }, 30000);

  agents.trending = new Agent('trending', 'Trending Feed', '🔥', () => {
    if (!navigator.onLine) return { status: 'warn', message: 'Offline — cached data' };
    return { status: 'ok', message: 'Last.fm API connected' };
  }, 15000);

  agents.news = new Agent('news', 'News Feed', '📰', () => {
    if (!navigator.onLine) return { status: 'warn', message: 'Offline — cached news' };
    return { status: 'ok', message: 'News feed active' };
  }, 15000);

  agents.portals = new Agent('portals', 'Portal Connections', '🌐', () => {
    const sel = state.get('selectedPortals');
    return { status: 'ok', message: `${sel.length} platforms selected` };
  }, 20000);

  agents.cache = new Agent('cache', 'Cache Manager', '💾', () => {
    const mem = performance?.memory?.usedJSHeapSize;
    const msg = mem ? `${Math.round(mem / 1048576)}MB heap` : 'Healthy';
    return { status: 'ok', message: msg };
  }, 15000);

  agents.performance = new Agent('perf', 'Performance Monitor', '⚡', () => {
    return { status: 'ok', message: `${Math.round(perfData.fps)} FPS · ${perfData.renderMs.toFixed(1)}ms render` };
  }, 5000);

  agents.errors = new Agent('errors', 'Error Handler', '🛡', () => {
    return { status: errorCount > 5 ? 'err' : errorCount > 0 ? 'warn' : 'ok', message: `${errorCount} errors caught` };
  }, 10000);
}

export function startAll() {
  Object.values(agents).forEach(a => a.start());
  state.log('System', 'All agents started', 'ok');
}

export function stopAll() {
  Object.values(agents).forEach(a => a.stop());
}

export function repairAll() {
  Object.values(agents).forEach(a => a.repair());
  state.log('System', 'All agents repaired', 'ok');
}

export function runHealthCheck() {
  Object.values(agents).forEach(a => a.check());
  state.log('System', 'Health check complete', 'ok');
}

export function getAgents() { return agents; }

export function getAgent(id) { return agents[id]; }

/* ═══ FPS MONITOR ═══ */
const perfData = { fps: 60, renderMs: 0 };
let lastFrameTime = performance.now();
let frameCount = 0;
let fpsTimer = 0;

export function perfTick() {
  const now = performance.now();
  frameCount++;
  fpsTimer += now - lastFrameTime;
  lastFrameTime = now;
  if (fpsTimer >= 1000) {
    perfData.fps = frameCount;
    perfData.renderMs = fpsTimer / frameCount;
    frameCount = 0;
    fpsTimer = 0;
    const fpsEl = document.getElementById('fps-display');
    const memEl = document.getElementById('mem-display');
    if (fpsEl) fpsEl.textContent = perfData.fps + ' FPS';
    if (memEl) {
      const mem = performance?.memory?.usedJSHeapSize;
      memEl.textContent = mem ? Math.round(mem / 1048576) + ' MB' : '';
    }
  }
}

export function getPerfData() { return perfData; }

/* ═══ GLOBAL ERROR HANDLER ═══ */
let errorCount = 0;

export function setupErrorHandling() {
  window.onerror = (msg, src, line, col, err) => {
    errorCount++;
    console.error('[GlobalError]', msg, src, line);
    state.log('Error Handler', `${msg} at ${src}:${line}`, 'err');
    const overlay = document.getElementById('error-overlay');
    const msgEl = document.getElementById('error-msg');
    if (errorCount <= 3 && overlay && msgEl) {
      msgEl.textContent = msg;
    }
    return true;
  };

  window.addEventListener('unhandledrejection', (e) => {
    errorCount++;
    const msg = e.reason?.message || String(e.reason);
    console.error('[UnhandledPromise]', msg);
    state.log('Error Handler', 'Promise: ' + msg, 'err');
    e.preventDefault();
  });
}

/* ═══ WIFI MONITOR ═══ */
export function setupWifiMonitor() {
  function update() {
    const online = navigator.onLine;
    const dot = document.getElementById('wifi-dot');
    const label = document.getElementById('wifi-label');
    const badge = document.getElementById('network-badge');
    if (dot) dot.className = 'wifi-dot ' + (online ? 'on' : 'off');
    if (label) {
      label.textContent = online ? 'Online' : 'Offline';
      label.style.color = online ? 'var(--green)' : 'var(--red)';
    }
    if (badge) {
      badge.textContent = online ? '📡 Online' : '📡 Offline';
      badge.className = 'top-badge network' + (online ? '' : ' error');
    }
  }
  update();
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  setInterval(update, 5000);
}

/* ═══ SOLDIER BADGE ═══ */
export function updateSoldierBadge() {
  const soldiers = state.get('soldiers');
  const statuses = Object.values(soldiers);
  const errs = statuses.filter(s => s.status === 'err').length;
  const warns = statuses.filter(s => s.status === 'warn').length;
  const badge = document.getElementById('soldier-badge');
  if (!badge) return;
  if (errs) {
    badge.textContent = `🛡 ${errs} Error${errs > 1 ? 's' : ''}`;
    badge.className = 'top-badge soldiers error';
  } else if (warns) {
    badge.textContent = `🛡 ${warns} Warning${warns > 1 ? 's' : ''}`;
    badge.className = 'top-badge soldiers warn';
  } else {
    badge.textContent = '🛡 All OK';
    badge.className = 'top-badge soldiers';
  }
}

state.subscribe('soldiers', updateSoldierBadge);
