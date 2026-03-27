/* Probes FastAPI for audio/vocal/music routes — updates top bar + Task Soldiers cache */

import { getBackendBase } from './apiConfig.js';
import * as state from './state.js';

let lastProbe = {
  ok: false,
  message: 'Not checked yet',
  tealOk: false,
  time: 0,
};
let _lastLoggedSig = '';

export function getLastBackendProbe() {
  return lastProbe;
}

function backendOrigin() {
  return (getBackendBase() || '').trim().replace(/\/+$/, '');
}

export async function probeDieterBackendOnce() {
  const base = backendOrigin();
  const healthUrl = `${base}/api/health`;
  try {
    const r = await fetch(healthUrl, { cache: 'no-store' });
    const text = await r.text();
    let json = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      lastProbe = {
        ok: false,
        message: 'API returned non-JSON (check Vercel DIETER_API_ORIGIN or backend URL)',
        tealOk: false,
        time: Date.now(),
      };
      _reflectProbe();
      return lastProbe;
    }
    if (!r.ok || json.ok !== true) {
      lastProbe = {
        ok: false,
        message: `Health check failed (HTTP ${r.status})`,
        tealOk: false,
        time: Date.now(),
      };
      _reflectProbe();
      return lastProbe;
    }

    let tealOk = false;
    try {
      const tr = await fetch(`${base}/api/tealvoices/status`, { cache: 'no-store' });
      if (tr.ok) {
        await tr.json().catch(() => ({}));
        tealOk = true;
      }
    } catch {
      tealOk = false;
    }

    lastProbe = {
      ok: true,
      message: `FastAPI OK · music/jobs/vocals under ${base || 'same origin'}/api`,
      tealOk,
      time: Date.now(),
    };
  } catch (e) {
    lastProbe = {
      ok: false,
      message: (e && e.message) || String(e),
      tealOk: false,
      time: Date.now(),
    };
  }
  _reflectProbe();
  return lastProbe;
}

function _reflectProbe() {
  updateTopBarEngineBadge();
  try {
    const sig = `${lastProbe.ok}|${lastProbe.message}|${lastProbe.tealOk}`;
    if (sig !== _lastLoggedSig) {
      _lastLoggedSig = sig;
      state.log(
        'Studio API',
        lastProbe.ok
          ? lastProbe.message + (lastProbe.tealOk ? ' · Teal route reachable' : '')
          : 'Offline — ' + lastProbe.message,
      );
    }
  } catch { /* ignore */ }
}

export function updateTopBarEngineBadge() {
  const el = document.getElementById('engine-badge');
  if (!el) return;
  const ok = lastProbe.ok;
  el.classList.toggle('live', ok);
  el.classList.toggle('warn', !ok);
  el.innerHTML = ok
    ? '<span class="pulse-dot"></span> API ready'
    : '<span class="pulse-dot" style="opacity:.4"></span> API setup';
  el.title = lastProbe.message;
}

export function startBackendProbeLoop() {
  void probeDieterBackendOnce();
  setInterval(() => void probeDieterBackendOnce(), 25000);
}
