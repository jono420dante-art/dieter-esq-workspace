/* Social Media Page — Account sign-in hub, YouTube upload, sharing */

import * as state from '../state.js';
import { navigate } from '../router.js';
import { icon } from '../icons.js';

const PLATFORMS = [
  { id: 'instagram', name: 'Instagram', color: '#E4405F', url: 'https://instagram.com', login: 'https://www.instagram.com/accounts/login/', followers: '2.4B users', desc: 'Share reels, stories, posts.' },
  { id: 'tiktok', name: 'TikTok', color: '#ff0050', url: 'https://tiktok.com', login: 'https://www.tiktok.com/login', followers: '1.5B users', desc: 'Short-form video. Viral music.' },
  { id: 'twitter', name: 'X (Twitter)', color: '#000', url: 'https://x.com', login: 'https://twitter.com/i/flow/login', followers: '600M users', desc: 'Real-time updates and threads.' },
  { id: 'facebook', name: 'Facebook', color: '#1877F2', url: 'https://facebook.com', login: 'https://www.facebook.com/login', followers: '3B users', desc: 'Pages, groups, events.' },
  { id: 'youtube', name: 'YouTube', color: '#FF0000', url: 'https://youtube.com', login: 'https://accounts.google.com/ServiceLogin?service=youtube', upload: 'https://studio.youtube.com', followers: '2.7B users', desc: 'Music videos, live, Shorts.' },
  { id: 'discord', name: 'Discord', color: '#5865F2', url: 'https://discord.com', login: 'https://discord.com/login', followers: '200M users', desc: 'Community and live listening.' },
  { id: 'snapchat', name: 'Snapchat', color: '#FFFC00', url: 'https://snapchat.com', login: 'https://accounts.snapchat.com/', followers: '800M users', desc: 'Stories and Spotlight.' },
  { id: 'linkedin', name: 'LinkedIn', color: '#0A66C2', url: 'https://linkedin.com', login: 'https://www.linkedin.com/login', followers: '950M users', desc: 'Professional networking.' },
  { id: 'threads', name: 'Threads', color: '#000', url: 'https://threads.net', login: 'https://www.threads.net/login', followers: '200M users', desc: 'Text-based social from Meta.' },
  { id: 'pinterest', name: 'Pinterest', color: '#E60023', url: 'https://pinterest.com', login: 'https://www.pinterest.com/login/', followers: '480M users', desc: 'Album art and mood boards.' },
  { id: 'reddit', name: 'Reddit', color: '#FF4500', url: 'https://reddit.com', login: 'https://www.reddit.com/login', followers: '1.7B users', desc: 'Music subreddits and AMAs.' },
  { id: 'whatsapp', name: 'WhatsApp', color: '#25D366', url: 'https://whatsapp.com', login: 'https://web.whatsapp.com/', followers: '2.8B users', desc: 'Direct sharing and status.' },
  { id: 'twitch', name: 'Twitch', color: '#9146FF', url: 'https://twitch.com', login: 'https://www.twitch.tv/login', followers: '140M users', desc: 'Live music production.' },
  { id: 'telegram', name: 'Telegram', color: '#2AABEE', url: 'https://telegram.org', login: 'https://web.telegram.org/', followers: '900M users', desc: 'Channels and bots.' },
];

let connectedPlatforms = new Set(JSON.parse(localStorage.getItem('dp-connected') || '["instagram","tiktok","youtube"]'));
let scheduledPosts = JSON.parse(localStorage.getItem('dp-posts') || '[]');

function saveConnected() { localStorage.setItem('dp-connected', JSON.stringify([...connectedPlatforms])); }
function savePosts() { localStorage.setItem('dp-posts', JSON.stringify(scheduledPosts)); }

export function render() {
  const lib = state.get('library');
  return `
    <div class="scroll-page">

      <!-- ACCOUNTS SIGN-IN HUB -->
      <div class="panel" style="background:linear-gradient(135deg,rgba(168,85,247,.06),rgba(124,58,237,.03));border-color:rgba(168,85,247,.2)">
        <div class="panel-header" style="font-size:.68rem">${icon('settings', 16)} Account Sign-In Hub
          <span class="panel-header-right">${connectedPlatforms.size} connected</span>
        </div>
        <p style="font-size:.62rem;color:var(--dim);margin-bottom:8px">Click "Sign In" to open the real login page in a new tab. After you log in there, click "Mark Connected" to sync.</p>
        <div class="grid-2" id="accounts-grid">
          ${PLATFORMS.map(p => {
            const connected = connectedPlatforms.has(p.id);
            return `
              <div class="track-row" style="border-color:${connected ? p.color + '44' : 'var(--border)'};${connected ? 'background:rgba(34,197,94,.03)' : ''}">
                <span>${icon(p.id, 24)}</span>
                <div class="track-info" style="flex:1;min-width:0">
                  <div class="track-title" style="font-size:.68rem">${p.name}</div>
                  <div class="track-meta">${p.followers} · ${connected ? '<span style="color:var(--green)">Connected</span>' : 'Not connected'}</div>
                </div>
                <div style="display:flex;gap:2px;flex-shrink:0">
                  <a href="${p.login}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm" title="Sign in to ${p.name}" style="font-size:.5rem">${icon('externalLink', 10)} Sign In</a>
                  <button class="btn ${connected ? 'btn-red' : 'btn-green'} btn-sm acct-toggle" data-acct="${p.id}" style="font-size:.5rem">${connected ? 'Disconnect' : 'Mark Connected'}</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <div style="flex:1;min-width:300px">

          <!-- YOUTUBE UPLOAD -->
          <div class="panel" style="border-color:rgba(255,0,0,.2)">
            <div class="panel-header">${icon('youtube', 16)} Upload to YouTube
              <span class="panel-header-right">${connectedPlatforms.has('youtube') ? '<span style="color:var(--green)">● Connected</span>' : '<span style="color:var(--red)">Not connected</span>'}</span>
            </div>
            <p style="font-size:.62rem;color:var(--dim);margin-bottom:6px">Select a track or video, add details, then upload directly to YouTube Studio.</p>
            <div style="margin-bottom:6px">
              <label>Track / Video</label>
              <select id="yt-track">
                ${lib.map(t => `<option value="${t.id}">${t.title} — ${t.genre} · ${t.duration}</option>`).join('')}
              </select>
            </div>
            <div style="margin-bottom:6px">
              <label>Video Title</label>
              <input type="text" id="yt-title" placeholder="My New Track — Official Audio"/>
            </div>
            <div style="margin-bottom:6px">
              <label>Description</label>
              <textarea id="yt-desc" placeholder="Official audio for my latest track. Produced in DIETER PRO.&#10;&#10;Follow me on social media..."></textarea>
            </div>
            <div class="grid-2" style="margin-bottom:6px">
              <div>
                <label>Visibility</label>
                <select id="yt-vis"><option>Public</option><option>Unlisted</option><option selected>Private (Draft)</option></select>
              </div>
              <div>
                <label>Category</label>
                <select id="yt-cat"><option>Music</option><option>Entertainment</option><option>Education</option></select>
              </div>
            </div>
            <div style="display:flex;gap:4px">
              <a href="https://studio.youtube.com/channel/UC/videos/upload" target="_blank" rel="noopener" class="btn btn-red" style="flex:1">${icon('upload', 14)} Open YouTube Studio</a>
              <a href="https://www.youtube.com/upload" target="_blank" rel="noopener" class="btn btn-ghost" style="flex:1">${icon('externalLink', 14)} YouTube Upload</a>
            </div>
            <div class="status-text" id="yt-status"></div>
          </div>

          <!-- QUICK SHARE -->
          <div class="panel">
            <div class="panel-header">${icon('send', 16)} Quick Share</div>
            <div style="margin-bottom:6px">
              <label>Select Track</label>
              <select id="share-track">
                ${lib.map(t => `<option value="${t.id}">${t.title} — ${t.genre} · ${t.bpm} BPM</option>`).join('')}
              </select>
            </div>
            <div style="margin-bottom:6px">
              <label>Caption</label>
              <textarea id="share-caption" placeholder="New music just dropped..."></textarea>
            </div>
            <div style="margin-bottom:6px">
              <label>Share To (${connectedPlatforms.size} connected)</label>
              <div class="pills" id="share-targets">
                ${[...connectedPlatforms].map(id => {
                  const p = PLATFORMS.find(x => x.id === id);
                  return p ? `<button class="pill active" data-share-to="${p.id}">${icon(p.id, 14)} ${p.name}</button>` : '';
                }).join('')}
              </div>
            </div>
            <button class="action-btn" id="btn-share-now">${icon('send', 16)} Share Now</button>
            <div class="status-text" id="share-status"></div>
          </div>
        </div>

        <div style="flex:0 0 280px">
          <!-- POST HISTORY -->
          <div class="panel">
            <div class="panel-header">${icon('clock', 16)} Post History <span class="panel-header-right">${scheduledPosts.length}</span></div>
            <div id="post-history" style="max-height:260px;overflow-y:auto"></div>
          </div>

          <!-- PLATFORM STATS -->
          <div class="panel">
            <div class="panel-header">${icon('trending', 16)} Platform Stats</div>
            <div id="social-stats">
              ${[...connectedPlatforms].slice(0, 6).map(id => {
                const p = PLATFORMS.find(x => x.id === id);
                if (!p) return '';
                const reach = Math.floor(Math.random() * 50000 + 1000);
                const eng = (Math.random() * 8 + 1).toFixed(1);
                return `
                  <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;padding:5px 7px;border:1px solid var(--border);border-radius:7px">
                    ${icon(p.id, 18)}
                    <div style="flex:1">
                      <div style="font-size:.6rem;font-weight:700">${p.name}</div>
                      <div style="font-size:.48rem;color:var(--dim)">Reach: ${reach.toLocaleString()} · Eng: ${eng}%</div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- QUICK ROUTES -->
          <div class="panel">
            <div class="panel-header">${icon('zap', 16)} Routes</div>
            <div style="display:flex;flex-direction:column;gap:3px">
              <button class="btn btn-primary btn-sm btn-full" data-goto="covers">${icon('disc', 13)} Album Covers</button>
              <button class="btn btn-orange btn-sm btn-full" data-goto="video">${icon('disc', 13)} Video Engine</button>
              <button class="btn btn-blue btn-sm btn-full" data-goto="mureka">${icon('zap', 13)} Mureka AI</button>
              <button class="btn btn-green btn-sm btn-full" data-goto="portals">${icon('globe', 13)} Distribution</button>
              <button class="btn btn-ghost btn-sm btn-full" data-goto="library">${icon('disc', 13)} Library</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function init() {
  document.querySelectorAll('.acct-toggle').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.acct;
      if (connectedPlatforms.has(id)) {
        connectedPlatforms.delete(id);
        state.log('Social', `Disconnected ${id}`);
      } else {
        connectedPlatforms.add(id);
        state.log('Social', `Connected ${id}`);
      }
      saveConnected();
      const page = document.getElementById('page-social');
      if (page) page._rendered = false;
      navigate('social');
    });
  });

  document.getElementById('btn-share-now')?.addEventListener('click', shareNow);

  document.querySelectorAll('[data-share-to]').forEach(el => {
    el.addEventListener('click', () => el.classList.toggle('active'));
  });

  document.querySelectorAll('[data-goto]').forEach(el => {
    el.addEventListener('click', () => navigate(el.dataset.goto));
  });

  renderPostHistory();
}

function shareNow() {
  const trackSelect = document.getElementById('share-track');
  const caption = document.getElementById('share-caption');
  const statusEl = document.getElementById('share-status');
  const btn = document.getElementById('btn-share-now');

  const activePills = document.querySelectorAll('[data-share-to].active');
  const targets = [...activePills].map(el => el.dataset.shareTo);

  if (!targets.length) {
    if (statusEl) statusEl.textContent = 'Select platforms to share to!';
    return;
  }

  if (btn) btn.disabled = true;
  if (statusEl) statusEl.textContent = `Sharing to ${targets.length} platforms...`;

  const trackTitle = trackSelect?.selectedOptions[0]?.textContent || 'Latest Track';
  const captionText = caption?.value || 'Check out my latest track!';

  setTimeout(() => {
    const post = {
      id: crypto.randomUUID(),
      track: trackTitle.split(' — ')[0],
      caption: captionText.slice(0, 80),
      platforms: targets,
      ts: Date.now(),
    };
    scheduledPosts.unshift(post);
    savePosts();
    renderPostHistory();
    if (btn) btn.disabled = false;
    if (statusEl) statusEl.textContent = `Shared to ${targets.map(t => t[0].toUpperCase() + t.slice(1)).join(', ')}!`;
    state.log('Social', `Shared "${post.track}" to ${targets.length} platforms`);
  }, 1200);
}

function renderPostHistory() {
  const el = document.getElementById('post-history');
  if (!el) return;
  if (!scheduledPosts.length) {
    el.innerHTML = '<div style="text-align:center;color:var(--dim);padding:14px;font-size:.66rem">No posts yet — share your first track!</div>';
    return;
  }
  el.innerHTML = scheduledPosts.slice(0, 15).map(p => `
    <div class="news-card" style="border-color:var(--green);padding:6px 8px;margin-bottom:3px">
      <div class="news-title" style="font-size:.64rem">${p.track}</div>
      <div style="font-size:.5rem;color:var(--dim)">${p.caption}</div>
      <div style="display:flex;gap:3px;margin-top:3px">${p.platforms.map(pid => icon(pid, 14)).join('')}</div>
      <div style="font-size:.46rem;color:var(--green);margin-top:2px">● ${new Date(p.ts).toLocaleString()}</div>
    </div>
  `).join('');
}
