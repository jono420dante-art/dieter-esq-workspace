/* Preview & Play Page */

import * as state from '../state.js';
import * as engine from '../engine.js';
import { navigate } from '../router.js';
import { icon } from '../icons.js';

export function render() {
  const lib = state.get('library');
  return `
    <div class="scroll-page">
      <div class="panel">
        <div class="panel-header">${icon('headphones', 16)} Preview &amp; Play <span class="panel-header-right">${lib.length} tracks available</span></div>
        <div id="preview-list">
          ${lib.slice(0, 15).map(t => `
            <div class="track-row">
              <button class="btn btn-green btn-sm pv-play">${icon('play', 12)} Preview</button>
              <div class="track-info">
                <div class="track-title">${t.title}</div>
                <div class="track-meta">${t.genre} · ${t.bpm} BPM · ${t.key} · ${t.duration}</div>
              </div>
              <button class="btn btn-primary btn-sm pv-remix" data-goto="lyrics">Remix</button>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">${icon('package', 16)} Free Sample Packs</div>
        ${['808 Drum Kit', 'Lo-Fi Piano Pack', 'Afrobeat Percussion', 'Synthwave Arps', 'Trap Hi-Hats', 'Vocal Chop Collection', 'Ambient Textures', 'Latin Percussion'].map(p => `
          <div class="track-row">
            <span style="color:var(--purple)">${icon('package', 18)}</span>
            <div class="track-info">
              <div class="track-title">${p}</div>
              <div class="track-meta">Free · 24 samples · Click to preview</div>
            </div>
            <button class="btn btn-green btn-sm pv-play">${icon('play', 12)}</button>
            <button class="btn btn-ghost btn-sm">${icon('download', 12)} Load</button>
          </div>
        `).join('')}
      </div>

      <div class="panel">
        <div class="panel-header">${icon('zap', 16)} Quick Create</div>
        <div class="transport">
          <button class="btn btn-primary" data-goto="lyrics">${icon('lyrics', 14)} From Lyrics</button>
          <button class="btn btn-orange" data-goto="create">${icon('music', 14)} AI Generate</button>
          <button class="btn btn-blue" data-goto="beats">${icon('activity', 14)} Analyze</button>
        </div>
      </div>
    </div>
  `;
}

export function init() {
  document.querySelectorAll('.pv-play').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!engine.play()) state.log('Preview', engine.getLastPlayError() || 'No audio loaded.');
    });
  });
  document.querySelectorAll('[data-goto]').forEach(el => {
    el.addEventListener('click', () => navigate(el.dataset.goto));
  });
  document.querySelectorAll('.pv-remix').forEach(el => {
    el.addEventListener('click', () => navigate('lyrics'));
  });
}
