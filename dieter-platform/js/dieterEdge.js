/* Live manifest from GET /api/studio/dieter-edge — Dieter positioning vs cloud-only */

import { getBackendBase, fetchDieterJson } from './apiConfig.js';

export async function fetchDieterEdge() {
  const base = (getBackendBase() || '').trim().replace(/\/+$/, '');
  return fetchDieterJson(`${base}/api/studio/dieter-edge`);
}

export async function fetchRecommendRoute(payload) {
  const base = (getBackendBase() || '').trim().replace(/\/+$/, '');
  return fetchDieterJson(`${base}/api/studio/recommend-route`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

function badge(ok) {
  return ok
    ? '<span style="color:#22c55e;font-weight:700">●</span>'
    : '<span style="color:#64748b">○</span>';
}

export function renderEdgeHtml(manifest) {
  if (!manifest || typeof manifest !== 'object') return '<p style="font-size:.62rem;color:var(--dim)">No data</p>';
  const live = manifest.live || {};
  const mg = live.musicgen || {};
  const rows = [
    ['FFmpeg', live.ffmpeg],
    ['Rubberband filter', live.ffmpegRubberband],
    ['Coqui TTS', live.coquiTts],
    ['Teal sing pipeline', live.tealPipelineReady],
    ['Mureka API key', live.murekaApiKeyConfigured],
    ['MusicGen env', mg.enabled === true],
    ['OpenAI', live.openaiConfigured],
  ];
  const badges = rows
    .map(
      ([label, on]) =>
        `<div style="display:flex;align-items:center;gap:6px;font-size:.58rem"><span>${badge(!!on)}</span><span style="color:var(--dim)">${label}</span></div>`,
    )
    .join('');

  const pillars = (manifest.pillars || [])
    .map(p => {
      const d = typeof p.dieter === 'number' ? p.dieter : '—';
      const c = typeof p.cloud_only_typical === 'number' ? p.cloud_only_typical : '—';
      return `<div style="margin-bottom:8px;padding:8px 10px;border-radius:8px;border:1px solid rgba(45,212,191,.15);background:rgba(8,10,22,.35)">
        <div style="font-size:.68rem;font-weight:800;color:#5eead4">${p.title || ''}</div>
        <div style="font-size:.56rem;color:var(--text-secondary);line-height:1.45;margin-top:4px">${p.body || ''}</div>
        <div style="font-size:.5rem;color:var(--dim);margin-top:6px">Control / breadth · Dieter <strong>${d}</strong> vs typical cloud-only <strong>${c}</strong> <span style="opacity:.7">(subjective 1–5)</span></div>
      </div>`;
    })
    .join('');

  const note = manifest.honestNote
    ? `<p style="font-size:.54rem;color:var(--dim);line-height:1.5;margin-top:10px;font-style:italic">${manifest.honestNote}</p>`
    : '';

  return `
    <p style="font-size:.62rem;color:var(--text-secondary);line-height:1.5;margin:0 0 10px">${manifest.tagline || ''}</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:6px;margin-bottom:12px">${badges}</div>
    <div style="font-size:.56rem;font-weight:700;color:var(--purple);margin-bottom:6px">Why producers pick Dieter</div>
    ${pillars}
    ${note}
  `;
}

export function renderRecommendHtml(rec) {
  if (!rec || !rec.steps) return '';
  const steps = rec.steps.map(s => `<li style="margin-bottom:4px">${s}</li>`).join('');
  return `<div style="font-size:.58rem;color:var(--cyan);margin-top:8px"><strong>Plan (${rec.recommendedPrimary || '—'})</strong><ol style="margin:6px 0 0 16px;padding:0">${steps}</ol></div>`;
}

export async function mountHomeEdge(rootEl) {
  if (!rootEl) return;
  rootEl.innerHTML = '<p style="font-size:.62rem;color:var(--dim)">Loading studio manifest…</p>';
  try {
    const m = await fetchDieterEdge();
    rootEl.innerHTML = renderEdgeHtml(m);
  } catch (e) {
    rootEl.innerHTML = `<p style="font-size:.62rem;color:#f97316">Connect your FastAPI backend (Settings or <code>dp-backend-base</code>) to load the Dieter edge manifest. ${e?.message || e}</p>`;
  }
}

export async function mountMurekaEdge(rootEl, { onRefreshRecommend } = {}) {
  if (!rootEl) return;
  rootEl.innerHTML = '<p style="font-size:.6rem;color:var(--dim)">Loading…</p>';
  try {
    const m = await fetchDieterEdge();
    const controls = `
      <div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(45,212,191,.2)">
        <label style="font-size:.54rem;color:var(--dim)">Goal (routing hint)</label>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;align-items:center">
          <select id="dieter-edge-goal" style="font-size:.62rem;flex:1;min-width:160px">
            <option value="demo_fast">Fast demo (local first)</option>
            <option value="chart_vocal">Chart-grade AI vocal</option>
            <option value="private_stems">Private / no cloud</option>
            <option value="instrumental_bed">Instrumental bed</option>
            <option value="train_voice">Train / QC voice</option>
          </select>
          <label style="font-size:.54rem;display:flex;align-items:center;gap:4px;cursor:pointer">
            <input type="checkbox" id="dieter-edge-privacy"/> Privacy first
          </label>
          <button type="button" class="btn btn-primary btn-sm" id="dieter-edge-plan-btn">Update plan</button>
        </div>
        <div id="dieter-edge-recommend"></div>
      </div>
    `;
    rootEl.innerHTML = renderEdgeHtml(m) + controls;

    const runPlan = async () => {
      const goal = document.getElementById('dieter-edge-goal')?.value || 'demo_fast';
      const privacyFirst = !!document.getElementById('dieter-edge-privacy')?.checked;
      const out = document.getElementById('dieter-edge-recommend');
      if (!out) return;
      out.innerHTML = '<span style="font-size:.54rem;color:var(--dim)">…</span>';
      try {
        const rec = await fetchRecommendRoute({ goal, privacyFirst });
        out.innerHTML = renderRecommendHtml(rec);
        onRefreshRecommend?.(rec);
      } catch (e) {
        out.innerHTML = `<span style="font-size:.54rem;color:#f97316">${e?.message || e}</span>`;
      }
    };

    document.getElementById('dieter-edge-plan-btn')?.addEventListener('click', () => void runPlan());
    await runPlan();
  } catch (e) {
    rootEl.innerHTML = `<p style="font-size:.6rem;color:#f97316">Edge manifest: ${e?.message || e}</p>`;
  }
}
