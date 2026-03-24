/* Portals Page — Distribution to Spotify, Apple Music, YouTube, Napster, etc. */

import * as state from '../state.js';
import { navigate } from '../router.js';
import { icon } from '../icons.js';

const PORTALS = [
  { id: 'spotify', name: 'Spotify', svgId: 'spotify', color: '#1DB954', url: 'https://open.spotify.com', wpUrl: 'https://engineering.atspotify.com', wpTitle: 'Spotify Engineering Blog' },
  { id: 'apple', name: 'Apple Music', svgId: 'apple', color: '#fc3c44', url: 'https://music.apple.com', wpUrl: 'https://developer.apple.com/musickit/', wpTitle: 'MusicKit Developer Docs' },
  { id: 'youtube', name: 'YouTube Music', svgId: 'youtube', color: '#FF0000', url: 'https://music.youtube.com', wpUrl: 'https://developers.google.com/youtube/v3', wpTitle: 'YouTube Data API v3' },
  { id: 'napster', name: 'Napster', svgId: 'napster', color: '#0099FF', url: 'https://www.napster.com', wpUrl: 'https://developer.prod.napster.com', wpTitle: 'Napster Developer API' },
  { id: 'tidal', name: 'Tidal', svgId: 'tidal', color: '#00FFFF', url: 'https://listen.tidal.com', wpUrl: 'https://developer.tidal.com', wpTitle: 'Tidal Developer Portal' },
  { id: 'soundcloud', name: 'SoundCloud', svgId: 'soundcloud', color: '#FF5500', url: 'https://soundcloud.com', wpUrl: 'https://developers.soundcloud.com', wpTitle: 'SoundCloud API' },
  { id: 'amazon', name: 'Amazon Music', svgId: 'amazon', color: '#00A8E1', url: 'https://music.amazon.com', wpUrl: 'https://developer.amazon.com/apps-and-games/services-and-apis', wpTitle: 'Amazon Developer Services' },
  { id: 'deezer', name: 'Deezer', svgId: 'deezer', color: '#A238FF', url: 'https://www.deezer.com', wpUrl: 'https://developers.deezer.com/api', wpTitle: 'Deezer API Documentation' },
  { id: 'tiktok', name: 'TikTok', svgId: 'tiktok', color: '#ff0050', url: 'https://www.tiktok.com', wpUrl: 'https://developers.tiktok.com', wpTitle: 'TikTok for Developers' },
];

export function render() {
  const selected = new Set(state.get('selectedPortals'));
  return `
    <div class="split">
      <div class="split-right">
        <div class="panel">
          <div class="panel-header">${icon('globe', 16)} Distribution Portals</div>
          <div class="grid-2" id="portal-grid">
            ${PORTALS.map(p => `
              <div class="portal-card${selected.has(p.id) ? ' selected' : ''}" data-portal="${p.id}" style="border-color:${selected.has(p.id) ? p.color + '55' : 'var(--border)'}">
                <span class="portal-icon">${icon(p.svgId, 24)}</span>
                <span class="portal-name">${p.name}</span>
                ${selected.has(p.id) ? `<span class="portal-check">${icon('check', 14)}</span>` : ''}
              </div>
            `).join('')}
          </div>
          <button class="action-btn" id="btn-distribute">🚀 Distribute to ${selected.size} Platforms</button>
          <div class="status-text" id="portal-status"></div>
        </div>

        <div class="panel">
          <div class="panel-header">${icon('clock', 16)} Distribution History</div>
          <div id="dist-history">${renderHistory()}</div>
        </div>
      </div>

      <div class="split-sidebar">
        <div class="panel">
          <div class="panel-header">${icon('link', 16)} Platform Deep Links</div>
          ${PORTALS.map(p => `
            <a href="${p.url}" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:6px;padding:5px 8px;border-radius:6px;text-decoration:none;color:var(--text);font-size:.66rem;border:1px solid var(--border);margin-bottom:3px;transition:var(--transition)" onmouseover="this.style.borderColor='${p.color}'" onmouseout="this.style.borderColor='var(--border)'">${icon(p.svgId, 18)} ${p.name} <span style="margin-left:auto;color:var(--dim)">${icon('externalLink', 12)}</span></a>
          `).join('')}
        </div>

        <div class="panel">
          <div class="panel-header">${icon('file', 16)} White Papers &amp; API Docs</div>
          ${PORTALS.map(p => `
            <a href="${p.wpUrl}" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:5px;padding:5px 8px;border-radius:6px;text-decoration:none;color:var(--blue);font-size:.6rem;margin-bottom:2px;border:1px solid var(--border)">${icon(p.svgId, 16)} ${p.wpTitle} ${icon('externalLink', 10)}</a>
          `).join('')}
        </div>

        <div class="panel">
          <div class="panel-header">${icon('send', 16)} Quick Routes</div>
          <button class="btn btn-primary btn-sm btn-full" data-goto="lyrics" style="margin-bottom:3px">${icon('lyrics', 13)} Lyrics Studio</button>
          <button class="btn btn-orange btn-sm btn-full" data-goto="create" style="margin-bottom:3px">${icon('music', 13)} Create Music</button>
          <button class="btn btn-blue btn-sm btn-full" data-goto="beats" style="margin-bottom:3px">${icon('activity', 13)} Beat Detection</button>
          <button class="btn btn-green btn-sm btn-full" data-goto="library" style="margin-bottom:3px">${icon('disc', 13)} Library</button>
          <button class="btn btn-pink btn-sm btn-full" data-goto="trending">${icon('trending', 13)} Trending</button>
        </div>
      </div>
    </div>
  `;
}

export function init() {
  document.querySelectorAll('[data-portal]').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.portal;
      const sel = new Set(state.get('selectedPortals'));
      if (sel.has(id)) sel.delete(id); else sel.add(id);
      state.set('selectedPortals', [...sel]);
      refreshPortalCards();
    });
  });

  document.getElementById('btn-distribute')?.addEventListener('click', distribute);

  document.querySelectorAll('[data-goto]').forEach(el => {
    el.addEventListener('click', () => navigate(el.dataset.goto));
  });
}

function refreshPortalCards() {
  const selected = new Set(state.get('selectedPortals'));
  document.querySelectorAll('[data-portal]').forEach(el => {
    const id = el.dataset.portal;
    const portal = PORTALS.find(p => p.id === id);
    el.classList.toggle('selected', selected.has(id));
    el.style.borderColor = selected.has(id) ? portal.color + '55' : 'var(--border)';
    const check = el.querySelector('.portal-check');
    if (selected.has(id) && !check) {
      el.insertAdjacentHTML('beforeend', '<span class="portal-check">✓</span>');
    } else if (!selected.has(id) && check) {
      check.remove();
    }
  });
  const btn = document.getElementById('btn-distribute');
  if (btn) btn.textContent = `🚀 Distribute to ${selected.size} Platforms`;
}

function distribute() {
  const selected = state.get('selectedPortals');
  const statusEl = document.getElementById('portal-status');
  const btn = document.getElementById('btn-distribute');
  if (!selected.length) { if (statusEl) statusEl.textContent = 'Select platforms first!'; return; }
  if (btn) btn.disabled = true;
  if (statusEl) statusEl.textContent = `Distributing to ${selected.length} platforms...`;

  const lib = state.get('library');
  const track = lib[0]?.title || 'Latest Track';

  setTimeout(() => {
    state.addDistribution({
      id: crypto.randomUUID(),
      track,
      platforms: [...selected],
      ts: Date.now(),
    });
    if (btn) btn.disabled = false;
    if (statusEl) statusEl.textContent = `"${track}" distributed to ${selected.length} platforms!`;
    state.log('Portal Connections', `Distributed "${track}" to ${selected.length} platforms`);
    const histEl = document.getElementById('dist-history');
    if (histEl) histEl.innerHTML = renderHistory();
  }, 1500);
}

function renderHistory() {
  const history = state.get('distHistory');
  if (!history.length) return '<div style="text-align:center;color:var(--dim);padding:14px;font-size:.66rem">No distributions yet</div>';
  return history.map(h => `
    <div class="news-card" style="border-color:var(--green)">
      <div class="news-title">${h.track}</div>
      <div class="news-meta">${h.platforms.map(p => p[0].toUpperCase() + p.slice(1)).join(', ')}</div>
      <div style="font-size:.54rem;color:var(--green);margin-top:2px">● LIVE — ${new Date(h.ts).toLocaleString()}</div>
    </div>
  `).join('');
}
