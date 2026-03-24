/* Library Page — Track management with search/filter */

import * as state from '../state.js';
import * as engine from '../engine.js';
import { navigate } from '../router.js';
import { icon } from '../icons.js';

let currentFilter = 'all';

export function render() {
  return `
    <div class="scroll-page">
      <div class="panel">
        <div class="panel-header">${icon('disc', 16)} My Library <span class="panel-header-right" id="lib-count">0 tracks</span></div>
        <div style="display:flex;gap:4px;margin-bottom:10px;flex-wrap:wrap;align-items:center">
          <input type="text" id="lib-search" placeholder="Search tracks..." style="max-width:200px"/>
          <button class="pill active" data-libf="all">All</button>
          <button class="pill" data-libf="generated">Generated</button>
          <button class="pill" data-libf="lyrics">From Lyrics</button>
          <button class="pill" data-libf="import">Imported</button>
          <button class="pill" data-libf="fav">★ Favorites</button>
        </div>
        <div id="lib-list"></div>
      </div>
    </div>
  `;
}

export function init() {
  document.querySelectorAll('[data-libf]').forEach(el => {
    el.addEventListener('click', () => {
      currentFilter = el.dataset.libf;
      document.querySelectorAll('[data-libf]').forEach(x => x.classList.toggle('active', x.dataset.libf === currentFilter));
      renderList();
    });
  });

  document.getElementById('lib-search')?.addEventListener('input', renderList);
  renderList();

  state.subscribe('library', renderList);
}

export function destroy() {}

function renderList() {
  const search = (document.getElementById('lib-search')?.value || '').toLowerCase();
  const lib = state.get('library');
  const filtered = lib.filter(t => {
    if (currentFilter === 'fav' && !t.fav) return false;
    if (currentFilter !== 'all' && currentFilter !== 'fav' && t.source !== currentFilter) return false;
    if (search && !t.title.toLowerCase().includes(search)) return false;
    return true;
  });

  const countEl = document.getElementById('lib-count');
  if (countEl) countEl.textContent = filtered.length + ' tracks';

  const listEl = document.getElementById('lib-list');
  if (!listEl) return;

  listEl.innerHTML = filtered.length ? filtered.map(t => {
    const srcColor = t.source === 'lyrics' ? 'var(--blue)' : t.source === 'import' ? 'var(--orange)' : 'var(--purple)';
    return `
      <div class="track-row" data-tid="${t.id}">
        <button class="btn btn-green btn-sm track-play">${icon('play', 12)}</button>
        <div class="track-info">
          <div class="track-title">${t.title}</div>
          <div class="track-meta">${t.genre} · ${t.bpm} BPM · ${t.key} · ${t.duration} · <span style="color:${srcColor}">${t.source}</span></div>
        </div>
        <button class="track-fav" style="background:none;border:none;cursor:pointer;color:${t.fav ? 'var(--orange)' : 'var(--dim)'}">${t.fav ? icon('starFilled', 16) : icon('star', 16)}</button>
        <button class="btn btn-pink btn-sm track-analyze">${icon('activity', 12)}</button>
        <button class="btn btn-blue btn-sm track-portal">${icon('globe', 12)}</button>
      </div>
    `;
  }).join('') : '<div style="text-align:center;color:var(--dim);padding:24px;font-size:.68rem">No tracks found</div>';

  listEl.querySelectorAll('.track-play').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!engine.play()) state.log('Library', engine.getLastPlayError() || 'No audio loaded — import or generate first.');
    });
  });
  listEl.querySelectorAll('.track-fav').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = el.closest('[data-tid]')?.dataset.tid;
      if (id) state.toggleFav(id);
    });
  });
  listEl.querySelectorAll('.track-analyze').forEach(el => {
    el.addEventListener('click', (e) => { e.stopPropagation(); navigate('beats'); });
  });
  listEl.querySelectorAll('.track-portal').forEach(el => {
    el.addEventListener('click', (e) => { e.stopPropagation(); navigate('portals'); });
  });
}
