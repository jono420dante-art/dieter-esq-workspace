/* Task Soldiers Page — System health monitoring */

import * as state from '../state.js';
import * as agents from '../agents.js';
import { icon } from '../icons.js';

export function render() {
  return `
    <div class="scroll-page">
      <div class="panel">
        <div class="panel-header">${icon('shield', 16)} Task Soldiers — System Health Monitor</div>
        <div class="soldier-grid" id="soldier-grid"></div>
      </div>
      <div class="panel">
        <div class="panel-header">${icon('file', 16)} System Log</div>
        <div class="sys-log" id="system-log"></div>
      </div>
      <div class="panel">
        <div class="panel-header">${icon('settings', 16)} Actions</div>
        <div class="transport">
          <button class="btn btn-green btn-sm" id="btn-health-check">${icon('refresh', 13)} Health Check</button>
          <button class="btn btn-blue btn-sm" id="btn-repair-all">${icon('settings', 13)} Repair All</button>
          <button class="btn btn-orange btn-sm" id="btn-clear-cache">${icon('trash', 13)} Clear Cache</button>
          <button class="btn btn-ghost btn-sm" id="btn-clear-log">${icon('file', 13)} Clear Log</button>
        </div>
      </div>
      <div class="panel">
        <div class="panel-header">${icon('zap', 16)} Performance</div>
        <div class="grid-3" id="perf-stats">
          <div class="stat-card"><div class="stat-value" style="color:var(--green)" id="stat-fps">--</div><div class="stat-label">FPS</div></div>
          <div class="stat-card"><div class="stat-value" style="color:var(--blue)" id="stat-mem">--</div><div class="stat-label">Heap MB</div></div>
          <div class="stat-card"><div class="stat-value" style="color:var(--purple)" id="stat-agents">--</div><div class="stat-label">Active Agents</div></div>
        </div>
      </div>
    </div>
  `;
}

let refreshTimer = null;

export function init() {
  document.getElementById('btn-health-check')?.addEventListener('click', () => {
    agents.runHealthCheck();
    refreshView();
  });
  document.getElementById('btn-repair-all')?.addEventListener('click', () => {
    agents.repairAll();
    refreshView();
  });
  document.getElementById('btn-clear-cache')?.addEventListener('click', () => {
    state.log('Cache Manager', 'Cache cleared');
    refreshView();
  });
  document.getElementById('btn-clear-log')?.addEventListener('click', () => {
    state.set('systemLog', []);
    refreshView();
  });

  agents.runHealthCheck();
  refreshView();

  refreshTimer = setInterval(refreshView, 3000);
}

export function destroy() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = null;
}

function refreshView() {
  renderSoldiers();
  renderLog();
  renderPerf();
}

function renderSoldiers() {
  const soldierData = state.get('soldiers');
  const agentList = agents.getAgents();
  const el = document.getElementById('soldier-grid');
  if (!el) return;

  el.innerHTML = Object.entries(agentList).map(([id, agent]) => {
    const data = soldierData[id] || {};
    const status = data.status || 'ok';
    return `
      <div class="soldier-card">
        <div class="soldier-name">
          <span class="soldier-dot ${status}"></span>
          ${agent.icon} ${agent.name}
        </div>
        <div class="soldier-val">${data.message || 'Initializing...'}</div>
        <div class="soldier-val">Errors: ${data.errors || 0} · Repairs: ${data.repairs || 0}</div>
        <div class="soldier-val">Last: ${data.lastCheck ? new Date(data.lastCheck).toLocaleTimeString() : '--'}</div>
      </div>
    `;
  }).join('');
}

function renderLog() {
  const logs = state.get('systemLog');
  const el = document.getElementById('system-log');
  if (!el) return;
  el.innerHTML = logs.slice(0, 100).map(l => {
    const cls = l.level === 'err' ? 'log-err' : l.level === 'warn' ? 'log-warn' : l.level === 'info' ? 'log-info' : 'log-ok';
    return `<div class="${cls}">[${new Date(l.ts).toLocaleTimeString()}] ${l.system}: ${l.msg}</div>`;
  }).join('');
}

function renderPerf() {
  const perf = agents.getPerfData();
  const fpsEl = document.getElementById('stat-fps');
  const memEl = document.getElementById('stat-mem');
  const agEl = document.getElementById('stat-agents');
  if (fpsEl) fpsEl.textContent = Math.round(perf.fps);
  if (memEl) {
    const mem = performance?.memory?.usedJSHeapSize;
    memEl.textContent = mem ? Math.round(mem / 1048576) : '--';
  }
  if (agEl) agEl.textContent = Object.keys(agents.getAgents()).length;
}
