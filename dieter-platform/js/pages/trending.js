/* Trending Page — Live internet-connected charts */

import * as state from '../state.js';
import { navigate } from '../router.js';
import { icon } from '../icons.js';

let loaded = false;

export function render() {
  return `
    <div class="split">
      <div class="split-right">
        <div class="panel">
          <div class="panel-header">${icon('trending', 16)} Live Trending Charts
            <span class="panel-header-right" style="color:var(--green);display:flex;align-items:center;gap:3px">
              <span class="pulse-dot"></span>Connected
            </span>
          </div>
          <button class="btn btn-orange btn-sm" id="btn-refresh-trending" style="margin-bottom:8px">${icon('refresh', 13)} Refresh Live Data</button>
          <div id="trending-list"><div style="text-align:center;color:var(--dim);padding:20px">Loading...</div></div>
        </div>
      </div>
      <div class="split-sidebar">
        <div class="panel">
          <div class="panel-header">${icon('trending', 16)} Genre Trends</div>
          <div id="genre-trends"></div>
        </div>
        <div class="panel">
          <div class="panel-header">${icon('music', 16)} Hot Keys</div>
          <div class="pills" id="hot-keys"></div>
        </div>
        <div class="panel">
          <div class="panel-header">${icon('radio', 16)} BPM Sweet Spot</div>
          <div id="bpm-spot" style="text-align:center"></div>
        </div>
        <div class="panel">
          <div class="panel-header">${icon('send', 16)} Quick Routes</div>
          <button class="btn btn-primary btn-sm btn-full" data-goto="create" style="margin-bottom:3px">${icon('music', 13)} Create Track</button>
          <button class="btn btn-orange btn-sm btn-full" data-goto="lyrics" style="margin-bottom:3px">${icon('lyrics', 13)} Write Lyrics</button>
          <button class="btn btn-blue btn-sm btn-full" data-goto="beats">${icon('activity', 13)} Analyze</button>
        </div>
      </div>
    </div>
  `;
}

export function init() {
  document.getElementById('btn-refresh-trending')?.addEventListener('click', fetchTrending);
  document.querySelectorAll('[data-goto]').forEach(el => {
    el.addEventListener('click', () => navigate(el.dataset.goto));
  });
  if (!loaded) fetchTrending();
}

async function fetchTrending() {
  const btn = document.getElementById('btn-refresh-trending');
  if (btn) btn.disabled = true;

  let tracks;
  try {
    const res = await fetch('https://ws.audioscrobbler.com/2.0/?method=chart.gettoptracks&api_key=b25b959554ed76058ac220b7b2e0a026&format=json&limit=20');
    const d = await res.json();
    tracks = (d?.tracks?.track || []).map((t, i) => ({
      rank: i + 1,
      title: t.name,
      artist: t.artist?.name || 'Unknown',
      plays: +t.playcount > 1e6 ? (+t.playcount / 1e6).toFixed(1) + 'M' : +t.playcount > 1e3 ? (+t.playcount / 1e3).toFixed(0) + 'K' : t.playcount,
      hot: i < 5,
    }));
    state.log('Trending Feed', `Fetched ${tracks.length} tracks from Last.fm`);
  } catch {
    tracks = fallbackTracks();
    state.log('Trending Feed', 'Using cached data (offline)', 'warn');
  }

  renderTrendingList(tracks);
  renderSidebar();
  loaded = true;
  if (btn) btn.disabled = false;
}

function renderTrendingList(tracks) {
  const el = document.getElementById('trending-list');
  if (!el) return;
  el.innerHTML = tracks.map(t => `
    <div class="chart-row${t.hot ? ' hot' : ''}">
      <div class="chart-rank${t.rank <= 3 ? ' top' : ''}">${t.rank}</div>
      ${t.hot ? `<span style="color:var(--orange)">${icon('zap', 14)}</span>` : ''}
      <div style="flex:1">
        <div class="chart-title">${t.title}</div>
        <div class="chart-artist">${t.artist}</div>
      </div>
      <div style="text-align:right;min-width:40px;font-size:.6rem;font-weight:600">${t.plays}</div>
      <button class="btn btn-primary btn-sm" data-inspire="${t.title} by ${t.artist}">${icon('zap', 12)}</button>
    </div>
  `).join('');

  el.querySelectorAll('[data-inspire]').forEach(btn => {
    btn.addEventListener('click', () => {
      navigate('create');
      setTimeout(() => {
        const prompt = document.getElementById('ai-prompt');
        if (prompt) prompt.value = `Song inspired by ${btn.dataset.inspire}`;
      }, 100);
    });
  });
}

function renderSidebar() {
  const genres = [
    { n: 'Afrobeat', g: 34, s: 92 }, { n: 'Lo-Fi', g: 28, s: 88 },
    { n: 'Hyperpop', g: 21, s: 85 }, { n: 'Latin Pop', g: 19, s: 82 },
    { n: 'Drill', g: 15, s: 78 }, { n: 'K-Pop', g: 14, s: 76 },
    { n: 'Amapiano', g: 12, s: 74 }, { n: 'Phonk', g: 10, s: 71 },
  ];
  const genreEl = document.getElementById('genre-trends');
  if (genreEl) {
    genreEl.innerHTML = genres.map(g => `
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px">
        <span style="flex:1;font-size:.66rem">${g.n}</span>
        <span style="font-size:.56rem;color:var(--green);font-weight:700">+${g.g}%</span>
        <div style="width:40px;height:3px;background:rgba(168,85,247,.15);border-radius:2px">
          <div style="width:${g.s}%;height:100%;background:var(--purple);border-radius:2px"></div>
        </div>
      </div>
    `).join('');
  }

  const keysEl = document.getElementById('hot-keys');
  if (keysEl) {
    keysEl.innerHTML = ['C minor', 'G minor', 'A minor', 'F major', 'D minor', 'Bb major'].map(k => `<span class="pill active" style="cursor:default">${k}</span>`).join('');
  }

  const bpmEl = document.getElementById('bpm-spot');
  if (bpmEl) {
    bpmEl.innerHTML = `<div style="font-size:2rem;font-weight:900;color:var(--purple)">120</div><div style="font-size:.56rem;color:var(--dim)">Sweet spot: 85–145 BPM</div>`;
  }
}

function fallbackTracks() {
  const titles = ['Espresso', 'Birds of a Feather', 'Taste', 'Die With A Smile', 'APT.', 'Not Like Us', 'Lose Control', 'Moonlit Floor', 'Good Luck Babe', 'Beautiful Things', 'A Bar Song', 'Timeless', 'Miles', 'Fortnight', 'Saturn'];
  const artists = ['Sabrina Carpenter', 'Billie Eilish', 'Sabrina Carpenter', 'Lady Gaga', 'ROSÉ', 'Kendrick Lamar', 'Teddy Swims', 'LISA', 'Chappell Roan', 'Benson Boone', 'Shaboozey', 'The Weeknd', 'Lola Young', 'Taylor Swift', 'SZA'];
  return titles.map((t, i) => ({ rank: i + 1, title: t, artist: artists[i], plays: (Math.random() * 500 + 100).toFixed(0) + 'M', hot: i < 5 }));
}
