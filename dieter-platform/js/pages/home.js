/* Home Dashboard Page */

import * as state from '../state.js';
import { navigate } from '../router.js';
import { icon, iconXl } from '../icons.js';
import { mountHomeEdge } from '../dieterEdge.js';

export function render() {
  const lib = state.get('library');
  const songs = state.get('songs');
  return `
    <div class="scroll-page">
      <div class="dash-hero">
        <h2>Welcome to DIETER PRO</h2>
        <p>Your complete music production platform — create, analyze, distribute, all connected.</p>
        <p style="font-size:.72rem;opacity:.9;max-width:52rem;margin-top:10px;line-height:1.55">
          Dieter is built to <strong>outclass closed garden UIs</strong> on <em>ownership</em>, <em>stem workflows</em>, and <em>multi-engine routing</em> — use Mureka or any API when you want frontier vocals, while your pipeline stays yours.
        </p>
      </div>

      <div class="panel" style="margin-bottom:20px;border-color:rgba(45,212,191,.35);background:linear-gradient(135deg,rgba(13,148,136,.1),transparent)">
        <div class="panel-header">${icon('zap', 16)} Live studio manifest</div>
        <div id="home-dieter-edge" style="max-height:420px;overflow-y:auto"></div>
      </div>

      <div class="dash-grid">
        <div class="dash-card" data-goto="lyrics">
          <div class="ic">${iconXl('lyrics')}</div>
          <div class="label">Lyrics Studio</div>
          <div class="desc">Write lyrics, connect to voices</div>
        </div>
        <div class="dash-card" data-goto="create">
          <div class="ic">${iconXl('music')}</div>
          <div class="label">Create Music</div>
          <div class="desc">AI-powered music generation</div>
        </div>
        <div class="dash-card" data-goto="beats">
          <div class="ic">${iconXl('activity')}</div>
          <div class="label">Beat Detection</div>
          <div class="desc">Analyze BPM, key, beats</div>
        </div>
        <div class="dash-card" data-goto="library">
          <div class="ic">${iconXl('disc')}</div>
          <div class="label">Library</div>
          <div class="desc">${lib.length} tracks</div>
        </div>
        <div class="dash-card" data-goto="mixer">
          <div class="ic">${iconXl('sliders')}</div>
          <div class="label">Mix & Master</div>
          <div class="desc">Professional mixing</div>
        </div>
        <div class="dash-card" data-goto="trending">
          <div class="ic">${iconXl('trending')}</div>
          <div class="label">Trending</div>
          <div class="desc">Live global charts</div>
        </div>
        <div class="dash-card" data-goto="news">
          <div class="ic">${iconXl('newspaper')}</div>
          <div class="label">Live News</div>
          <div class="desc">Music industry updates</div>
        </div>
        <div class="dash-card" data-goto="portals">
          <div class="ic">${iconXl('globe')}</div>
          <div class="label">Portals</div>
          <div class="desc">Spotify, Apple, YouTube...</div>
        </div>
        <div class="dash-card" data-goto="soldiers">
          <div class="ic">${iconXl('shield')}</div>
          <div class="label">Task Soldiers</div>
          <div class="desc">System health monitors</div>
        </div>
      </div>

      <div class="grid-2">
        <div class="panel">
          <div class="panel-header">${icon('barChart', 16)} Quick Stats</div>
          <div style="display:flex;gap:14px;flex-wrap:wrap">
            <div><div style="font-size:1.4rem;font-weight:900;color:var(--purple)">${lib.length}</div><div style="font-size:.54rem;color:var(--dim)">Tracks</div></div>
            <div><div style="font-size:1.4rem;font-weight:900;color:var(--blue)">${songs.length}</div><div style="font-size:.54rem;color:var(--dim)">Songs</div></div>
            <div><div style="font-size:1.4rem;font-weight:900;color:var(--green)">${lib.filter(t => t.fav).length}</div><div style="font-size:.54rem;color:var(--dim)">Favorites</div></div>
            <div><div style="font-size:1.4rem;font-weight:900;color:var(--orange)">6</div><div style="font-size:.54rem;color:var(--dim)">Voices</div></div>
          </div>
        </div>
        <div class="panel">
          <div class="panel-header">${icon('disc', 16)} Recent Tracks</div>
          ${lib.slice(0, 3).map(t => `
            <div class="track-row">
              <span style="color:var(--purple)">${icon('music', 16)}</span>
              <div class="track-info">
                <div class="track-title">${t.title}</div>
                <div class="track-meta">${t.genre} · ${t.bpm} BPM · ${t.key}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

export function init() {
  document.querySelectorAll('[data-goto]').forEach(el => {
    el.addEventListener('click', () => navigate(el.dataset.goto));
  });
  void mountHomeEdge(document.getElementById('home-dieter-edge'));
}
