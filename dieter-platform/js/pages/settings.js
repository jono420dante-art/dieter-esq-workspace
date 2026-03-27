/* Studio settings — backend URL for WAV vocals, music jobs, Mureka proxy */

import { icon } from '../icons.js';
import { getBackendBase, setBackendBase } from '../apiConfig.js';
import { probeDieterBackendOnce, getLastBackendProbe } from '../studioConnectivity.js';
import { mountHomeEdge } from '../dieterEdge.js';
import { navigate } from '../router.js';
import * as state from '../state.js';

export function render() {
  return `
    <div class="scroll-page">
      <div class="panel" style="border-color:rgba(168,85,247,.3)">
        <div class="panel-header">${icon('settings', 16)} Studio &amp; API</div>
        <p style="font-size:.62rem;color:var(--text-secondary);line-height:1.55;margin:0 0 12px">
          Point DIETER PRO at your <strong>FastAPI</strong> host (same value as Create Music and Lyrics). Leave blank when the UI and
          <code>/api</code> share one origin (Docker full-stack or Vercel <code>DIETER_API_ORIGIN</code>).
        </p>
        <label>Backend origin (no <code>/api</code> suffix)</label>
        <input type="text" id="settings-backend-base" placeholder="https://your-api.up.railway.app" style="width:100%;font-size:.75rem;margin-bottom:8px"/>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
          <button type="button" class="btn btn-green btn-sm" id="settings-save-api">${icon('check', 12)} Save</button>
          <button type="button" class="btn btn-primary btn-sm" id="settings-test-api">${icon('activity', 12)} Test connection</button>
          <button type="button" class="btn btn-ghost btn-sm" id="settings-clear-api">Clear (same-origin)</button>
        </div>
        <div class="status-text" id="settings-api-status" style="min-height:1.4em"></div>
      </div>

      <div class="panel" style="border-color:rgba(45,212,191,.28)">
        <div class="panel-header">${icon('zap', 16)} Audio &amp; voice features (when API is OK)</div>
        <ul style="font-size:.62rem;color:var(--dim);line-height:1.7;margin:0;padding-left:18px">
          <li><strong>Create Music</strong> — <code>POST /api/music/generate</code> + poll job → real WAV in the Web Audio engine.</li>
          <li><strong>Lyrics Studio</strong> — browser voices (sing/speak) + <strong>Backend vocal WAV</strong> via Teal/Coqui or procedural fallback.</li>
          <li><strong>Mureka AI</strong> — optional cloud vocals when <code>MUREKA_API_KEY</code> is set on the server.</li>
          <li><strong>MusicGen</strong> — optional local Audiocraft when <code>DIETER_ENABLE_MUSICGEN=1</code> on the server.</li>
        </ul>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:12px">
          <button type="button" class="btn btn-blue btn-sm" data-goto="create">${icon('music', 12)} Create</button>
          <button type="button" class="btn btn-blue btn-sm" data-goto="lyrics">${icon('lyrics', 12)} Lyrics</button>
          <button type="button" class="btn btn-orange btn-sm" data-goto="mureka">${icon('zap', 12)} Mureka</button>
          <button type="button" class="btn btn-ghost btn-sm" data-goto="home">${icon('home', 12)} Manifest</button>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">${icon('barChart', 16)} Live capability manifest</div>
        <div id="settings-dieter-edge" style="max-height:360px;overflow-y:auto"></div>
      </div>
    </div>
  `;
}

export function init() {
  const input = document.getElementById('settings-backend-base');
  const statusEl = document.getElementById('settings-api-status');
  if (input) input.value = getBackendBase();

  input?.addEventListener('change', () => setBackendBase(input.value));
  input?.addEventListener('blur', () => setBackendBase(input.value));

  document.getElementById('settings-save-api')?.addEventListener('click', () => {
    setBackendBase(input?.value || '');
    state.log('Settings', 'Backend URL saved');
    if (statusEl) statusEl.textContent = 'Saved. Run Test connection.';
  });

  document.getElementById('settings-clear-api')?.addEventListener('click', () => {
    setBackendBase('');
    if (input) input.value = '';
    if (statusEl) statusEl.textContent = 'Using same-origin /api.';
    void probeDieterBackendOnce();
  });

  document.getElementById('settings-test-api')?.addEventListener('click', async () => {
    setBackendBase(input?.value || '');
    if (statusEl) statusEl.textContent = 'Testing…';
    const p = await probeDieterBackendOnce();
    if (statusEl) {
      statusEl.textContent = p.ok ? p.message : 'Failed: ' + p.message;
      statusEl.style.color = p.ok ? 'var(--green)' : 'var(--orange)';
    }
  });

  document.querySelectorAll('[data-goto]').forEach(el => {
    el.addEventListener('click', () => navigate(el.dataset.goto));
  });

  const st = getLastBackendProbe();
  if (statusEl && st.message) {
    statusEl.textContent = (st.ok ? 'Last check: ' : 'Last check failed: ') + st.message;
    statusEl.style.color = st.ok ? 'var(--green)' : 'var(--dim)';
  }

  void mountHomeEdge(document.getElementById('settings-dieter-edge'));
}
