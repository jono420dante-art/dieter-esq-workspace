/* Mureka AI Integration — Direct portal, sync, import/export */

import * as state from '../state.js';
import * as engine from '../engine.js';
import { navigate } from '../router.js';
import { icon } from '../icons.js';
import {
  generateLyricsLocal,
  generateLyricsOpenAI,
  optimizeLyricsLocal,
  optimizeLyricsOpenAI,
} from '../lyricsHelpers.js';
import {
  getBackendBase,
  setBackendBase,
  getDeployFrontendUrl,
  setDeployFrontendUrl,
  getOpenaiKey,
  setOpenaiKey,
} from '../apiConfig.js';
import { mountMurekaEdge } from '../dieterEdge.js';

let importedFiles = [];
let exportQueue = [];

function escapeAttr(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

const MUREKA_BASE = 'https://www.mureka.ai';
const BRIDGE_BASE = 'https://api.mureka.ai';
const MUREKA_STYLE_CHIPS = [
  'Grand Piano',
  'Melodic Trap',
  'Post Rock',
  'Dream Pop',
  'Afrobeat',
  'Phonk',
  'Cinematic',
  'Dreamy',
  'Joyful',
  'Anime OST',
  'FM Synth',
  'Cloud Rap',
  'Singer-Songwriter',
  'Half Time',
  'Moody',
  'Wavetable Synth',
  'Liquid DnB',
];
const MUREKA_MODE_TABS = ['Easy', 'Custom', '1 Free', 'V8', 'Reference', 'Remix', 'New', 'Vocal', 'Lyrics', 'Instrumental'];

export function render() {
  const lib = state.get('library');
  return `
    <div class="split">
      <div class="split-right">

        <div class="panel" style="border-color:rgba(20,184,166,.4);background:linear-gradient(160deg,rgba(13,148,136,.14),rgba(8,10,22,.5))">
          <div class="panel-header">${icon('shield', 16)} Dieter &gt; single-vendor lock-in
            <span class="panel-header-right" style="font-size:.52rem;color:#5eead4">Live API</span>
          </div>
          <p style="font-size:.6rem;color:var(--text-secondary);margin:0 0 8px;line-height:1.5">
            Mureka excels at closed-model song generation. Dieter wraps it (and others) so you still get <strong>stems</strong>, <strong>vocal QC</strong>, <strong>local demos</strong>, and <strong>your storage paths</strong> — the parts labels and pros actually need to win long-term.
          </p>
          <div id="mureka-dieter-edge-root"></div>
        </div>

        <!-- MUREKA PORTAL -->
        <div class="panel" style="background:linear-gradient(135deg,rgba(168,85,247,.08),rgba(124,58,237,.04));border-color:rgba(168,85,247,.25)">
          <div class="panel-header" style="font-size:.7rem">${icon('zap', 18)} Mureka AI — Direct Portal</div>
          <p style="font-size:.66rem;color:var(--text-secondary);margin-bottom:8px">Your Mureka account syncs with DIETER PRO. Create tracks in Mureka, import them here, edit, and push back.</p>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
            <a href="https://www.mureka.ai" target="_blank" rel="noopener" class="btn btn-primary" id="btn-mureka-open">${icon('externalLink', 14)} Open Mureka AI</a>
            <a href="https://www.mureka.ai/create" target="_blank" rel="noopener" class="btn btn-orange">${icon('music', 14)} Mureka Create</a>
            <a href="https://www.mureka.ai/library" target="_blank" rel="noopener" class="btn btn-blue">${icon('disc', 14)} Mureka Library</a>
            <button class="btn btn-green" id="btn-toggle-embed">${icon('globe', 14)} Embedded View</button>
          </div>
          <div id="mureka-embed-wrap" style="display:none">
            <iframe id="mureka-iframe" src="about:blank" style="width:100%;height:500px;border:1px solid var(--border);border-radius:var(--radius);background:#0a0a12" allow="microphone;camera;autoplay;clipboard-write" sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals"></iframe>
            <div style="font-size:.5rem;color:var(--dim);margin-top:3px;text-align:center">Mureka AI embedded — some features may require opening in a new tab</div>
          </div>
        </div>

        <!-- Mureka.ai-style layout (structure mirror + DIETER bridge) -->
        <!-- SEO-style note: mirrors mureka.ai create flow; real generation runs on mureka.ai -->
        <div class="panel mureka-clone-wrap" style="padding:0;overflow:hidden">
          <div class="panel-header" style="margin:0;padding:10px 14px;border-bottom:1px solid var(--border);background:rgba(8,10,22,.6)">
            ${icon('music', 16)} Mureka-style Create Suite
            <span class="panel-header-right" style="font-size:.58rem">Layout inspired by mureka.ai</span>
          </div>
          <div style="padding:12px 14px">
            <nav class="mureka-clone-nav" aria-label="Studio navigation (links)">
              <div class="mureka-clone-nav-main">
                <a href="${MUREKA_BASE}/" target="_blank" rel="noopener">Home</a>
                <a href="${MUREKA_BASE}/create" target="_blank" rel="noopener">Create Music</a>
                <a href="${MUREKA_BASE}/" target="_blank" rel="noopener">Create Speech</a>
                <a href="${MUREKA_BASE}/" target="_blank" rel="noopener">Studio</a>
              </div>
              <div class="mureka-clone-nav-sub">
                <a href="${MUREKA_BASE}/create" target="_blank" rel="noopener">New</a>
                <a href="${MUREKA_BASE}/" target="_blank" rel="noopener">Music Edit</a>
                <a href="${MUREKA_BASE}/library" target="_blank" rel="noopener">Library</a>
                <a href="${MUREKA_BASE}/pricing" target="_blank" rel="noopener">Subscribe</a>
                <a href="${MUREKA_BASE}/" target="_blank" rel="noopener">Notifications</a>
                <a href="${MUREKA_BASE}/" target="_blank" rel="noopener" title="Mureka site — check footer or account for API">API Platform</a>
              </div>
              <div class="mureka-clone-user" aria-hidden="true">
                <span class="mureka-gold-pill">0 Gold</span>
                <a href="${MUREKA_BASE}/pricing" target="_blank" rel="noopener" style="color:var(--orange)">Go Premier</a>
                <span>·</span>
                <a href="${MUREKA_BASE}/" target="_blank" rel="noopener">Invite &amp; Earn</a>
              </div>
            </nav>

            <div class="mureka-mode-tabs" role="tablist" aria-label="Creation mode">
              ${MUREKA_MODE_TABS.map((t, i) => `
                <button type="button" class="mureka-mode-tab${i === 1 ? ' active' : ''}" data-mureka-mode="${t}" role="tab" aria-selected="${i === 1 ? 'true' : 'false'}">${t}</button>
              `).join('')}
            </div>

            <p style="font-size:.62rem;color:var(--text-secondary);line-height:1.55;margin-bottom:10px;padding:8px 10px;border-radius:8px;border:1px solid rgba(168,85,247,.2);background:rgba(88,28,135,.1)">
              <strong>Workflow:</strong> write lyrics or use <strong>Generate Lyrics</strong>, refine with <strong>Optimize</strong>, choose <strong>vocal gender</strong> and <strong>style</strong> (e.g. Grand Piano, Melodic Trap). Enable <strong>Instrumental</strong> for no vocals. Then open Mureka or <strong>Create in DIETER</strong>.
            </p>

            <div class="form-group" style="margin-bottom:12px">
              <label for="mureka-lyrics-ta">Lyrics (optional if instrumental)</label>
              <textarea id="mureka-lyrics-ta" placeholder="[Verse]&#10;Your lines…&#10;&#10;[Chorus]&#10;…" rows="6" style="min-height:140px"></textarea>
              <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px;padding:8px 10px;border-radius:8px;border:1px solid rgba(56,189,248,.25);background:rgba(14,116,144,.12)">
                <input type="checkbox" id="mureka-instrumental" style="accent-color:var(--cyan);cursor:pointer"/>
                <label for="mureka-instrumental" style="margin:0;cursor:pointer;font-size:.6rem;font-weight:600;color:var(--cyan)">Instrumental — no lead vocal; lyrics ignored when sending to Mureka.</label>
              </div>
              <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
                <button type="button" class="btn btn-ghost btn-sm" id="mureka-btn-gen-lyrics">${icon('lyrics', 12)} Generate Lyrics</button>
                <button type="button" class="btn btn-ghost btn-sm" id="mureka-btn-optimize">${icon('zap', 12)} Optimize</button>
                <button type="button" class="btn btn-blue btn-sm" id="mureka-btn-to-dieter-lyrics">${icon('lyrics', 12)} Open in DIETER Lyrics</button>
              </div>
              <div style="margin-top:8px">
                <label for="mureka-openai-key" style="font-size:.58rem">OpenAI key (optional — for Generate/Optimize; browser may block CORS)</label>
                <input type="password" id="mureka-openai-key" placeholder="sk-…" autocomplete="off" style="width:100%;margin-top:4px;font-size:.62rem"/>
              </div>
              <div class="status-text" id="mureka-lyrics-status" style="margin-top:8px;min-height:1.2em"></div>
            </div>

            <div class="form-group" style="margin-bottom:12px">
              <label for="mureka-style-input">Style (mood, instruments, genre)</label>
              <input type="text" id="mureka-style-input" placeholder="e.g. Grand Piano, Melodic Trap, Post Rock…"/>
              <div class="mureka-style-chips" id="mureka-style-chips">
                ${MUREKA_STYLE_CHIPS.map(s => `<button type="button" class="mureka-style-chip" data-style-chip="${s}">${s}</button>`).join('')}
              </div>
            </div>

            <div class="form-group" style="margin-bottom:12px">
              <label>Vocal gender</label>
              <div class="mureka-vocal-row">
                <label><input type="radio" name="mureka-vocal" value="female" checked/> Female</label>
                <label><input type="radio" name="mureka-vocal" value="male"/> Male</label>
              </div>
            </div>

            <div class="form-group" style="margin-bottom:12px">
              <label for="mureka-song-title">Song title</label>
              <input type="text" id="mureka-song-title" maxlength="50" placeholder="Song title"/>
              <div class="mureka-char-count"><span id="mureka-title-count">0</span> / 50</div>
            </div>

            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
              <button type="button" class="action-btn" id="mureka-btn-create-mureka" style="margin:0;flex:1;min-width:200px">${icon('externalLink', 14)} Create on Mureka.ai</button>
              <button type="button" class="btn btn-orange" id="mureka-btn-create-dieter">${icon('music', 14)} Create in DIETER</button>
            </div>

            <div class="mureka-empty-hint" id="mureka-empty-hint">
              ${lib.length ? `${lib.length} track(s) in DIETER library — import Mureka downloads below to analyze & mix.` : 'No songs yet in DIETER library — create on Mureka, download, then import here.'}
            </div>
          </div>
        </div>

        <!-- BIDIRECTIONAL SYNC -->
        <div class="panel" style="border-color:rgba(34,197,94,.2)">
          <div class="panel-header">${icon('refresh', 16)} Bidirectional Sync
            <span class="panel-header-right" style="color:var(--green)">${navigator.onLine ? '● Online' : '○ Offline'}</span>
          </div>
          <p style="font-size:.62rem;color:var(--dim);margin-bottom:8px">Move tracks freely between Mureka AI and DIETER PRO. Pull from Mureka → Edit here → Push back.</p>
          <div class="grid-2" style="margin-bottom:8px">
            <div style="border:1px solid rgba(56,189,248,.2);border-radius:8px;padding:10px;text-align:center">
              <div style="font-size:.72rem;font-weight:800;color:var(--blue)">${icon('download', 16)} Pull from Mureka</div>
              <p style="font-size:.54rem;color:var(--dim);margin:4px 0">Download your Mureka tracks → auto-import to library</p>
              <a href="https://www.mureka.ai/library" target="_blank" rel="noopener" class="btn btn-blue btn-sm">${icon('externalLink', 12)} Open Mureka Library</a>
            </div>
            <div style="border:1px solid rgba(249,115,22,.2);border-radius:8px;padding:10px;text-align:center">
              <div style="font-size:.72rem;font-weight:800;color:var(--orange)">${icon('upload', 16)} Push to Mureka</div>
              <p style="font-size:.54rem;color:var(--dim);margin:4px 0">Export edited tracks → upload to Mureka for distribution</p>
              <a href="https://www.mureka.ai/create" target="_blank" rel="noopener" class="btn btn-orange btn-sm">${icon('externalLink', 12)} Open Mureka Studio</a>
            </div>
          </div>
          <div style="display:flex;gap:4px;flex-wrap:wrap">
            <button class="btn btn-primary btn-sm" data-goto="mixer">${icon('sliders', 12)} Mix & Fade</button>
            <button class="btn btn-green btn-sm" data-goto="covers">${icon('disc', 12)} Album Art</button>
            <button class="btn btn-blue btn-sm" data-goto="video">${icon('disc', 12)} Video</button>
            <button class="btn btn-pink btn-sm" data-goto="social">${icon('share', 12)} Social</button>
          </div>
        </div>

        <!-- API BRIDGE -->
        <div class="panel" style="border-color:rgba(56,189,248,.25)">
          <div class="panel-header">${icon('link', 16)} API Routes & Direct Link Bridge</div>
          <p style="font-size:.66rem;color:var(--text-secondary);margin-bottom:8px">
            Use these direct links and API route templates to connect DIETER PRO and Mureka both ways.
          </p>
          <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px">
            <a href="${MUREKA_BASE}/?ref=dieter-pro&source=bridge" target="_blank" rel="noopener" class="btn btn-primary btn-sm">${icon('externalLink', 12)} Open Mureka (Bridge)</a>
            <a href="${MUREKA_BASE}/create?ref=dieter-pro&intent=create" target="_blank" rel="noopener" class="btn btn-orange btn-sm">${icon('music', 12)} Create with Params</a>
            <a href="${MUREKA_BASE}/library?ref=dieter-pro&intent=sync" target="_blank" rel="noopener" class="btn btn-blue btn-sm">${icon('disc', 12)} Library Sync View</a>
          </div>
          <div id="mureka-routes" style="display:flex;flex-direction:column;gap:4px"></div>
          <div class="status-text" id="mureka-route-status"></div>
        </div>

        <!-- IMPORT -->
        <div class="panel">
          <div class="panel-header">${icon('upload', 16)} Import Files
            <span class="panel-header-right">MP3 · WAV · MP4 · OGG · FLAC · WebM</span>
          </div>
          <div class="drop-zone" id="import-drop">
            <div class="drop-icon">${icon('upload', 40)}</div>
            <div class="drop-text">Drop audio/video files or click to browse</div>
            <div class="drop-hint">Import from Mureka downloads, your computer, or anywhere. Real file decoding.</div>
          </div>
          <input type="file" id="import-file-input" accept="audio/*,video/mp4,video/webm" multiple hidden/>
          <div class="status-text" id="import-status"></div>
          <div id="import-list" style="margin-top:6px"></div>
        </div>

        <!-- EXPORT -->
        <div class="panel">
          <div class="panel-header">${icon('download', 16)} Export from Library
            <span class="panel-header-right">${lib.length} tracks</span>
          </div>
          <p style="font-size:.62rem;color:var(--dim);margin-bottom:6px">Select tracks and export format. Exports use Web Audio for real WAV encoding.</p>
          <div style="display:flex;gap:4px;margin-bottom:8px;flex-wrap:wrap">
            <button class="pill active" data-expf="all">All</button>
            <button class="pill" data-expf="generated">Generated</button>
            <button class="pill" data-expf="lyrics">From Lyrics</button>
            <button class="pill" data-expf="import">Imported</button>
          </div>
          <div id="export-list" style="max-height:250px;overflow-y:auto"></div>
          <div style="display:flex;gap:4px;margin-top:8px;flex-wrap:wrap">
            <button class="btn btn-primary" id="btn-export-wav">${icon('download', 14)} Export WAV</button>
            <button class="btn btn-orange" id="btn-export-mp3">${icon('download', 14)} Export MP3</button>
            <button class="btn btn-blue" id="btn-export-mp4">${icon('download', 14)} Export MP4</button>
            <button class="btn btn-green" id="btn-export-all">${icon('download', 14)} Export All</button>
          </div>
          <div class="status-text" id="export-status"></div>
        </div>

        <!-- SYNC -->
        <div class="panel">
          <div class="panel-header">${icon('refresh', 16)} Sync Pipeline</div>
          <p style="font-size:.62rem;color:var(--dim);margin-bottom:6px">Workflow: Create in Mureka → Download → Import here → Edit → Export → Distribute</p>
          <div class="grid-4" style="margin-bottom:6px">
            <div class="stat-card" style="padding:8px">
              <div class="stat-value" style="font-size:1.2rem;color:var(--purple)">${lib.length}</div>
              <div class="stat-label">Library</div>
            </div>
            <div class="stat-card" style="padding:8px">
              <div class="stat-value" style="font-size:1.2rem;color:var(--blue)">${importedFiles.length}</div>
              <div class="stat-label">Imported</div>
            </div>
            <div class="stat-card" style="padding:8px">
              <div class="stat-value" style="font-size:1.2rem;color:var(--green)">${exportQueue.length}</div>
              <div class="stat-label">Exported</div>
            </div>
            <div class="stat-card" style="padding:8px">
              <div class="stat-value" style="font-size:1.2rem;color:var(--orange)">●</div>
              <div class="stat-label">${navigator.onLine ? 'Online' : 'Offline'}</div>
            </div>
          </div>
          <div style="display:flex;gap:3px;flex-wrap:wrap">
            <button class="btn btn-primary btn-sm" data-goto="lyrics">${icon('lyrics', 12)} Lyrics</button>
            <button class="btn btn-orange btn-sm" data-goto="create">${icon('music', 12)} Create</button>
            <button class="btn btn-blue btn-sm" data-goto="beats">${icon('activity', 12)} Analyze</button>
            <button class="btn btn-green btn-sm" data-goto="video">${icon('disc', 12)} Video</button>
            <button class="btn btn-pink btn-sm" data-goto="portals">${icon('globe', 12)} Portals</button>
            <button class="btn btn-ghost btn-sm" data-goto="social">${icon('share', 12)} Social</button>
          </div>
        </div>

      </div>

      <div class="split-sidebar">
        <div class="panel" style="border-color:rgba(34,197,94,.25)">
          <div class="panel-header">${icon('globe', 16)} Mac / deployment</div>
          <p style="font-size:.58rem;color:var(--dim);line-height:1.45;margin-bottom:8px">
            After you deploy, save these on your <strong>MacBook Air</strong> (Safari bookmark or Notes). Backend powers <strong>Create Music → API</strong>.
          </p>
          <label style="font-size:.58rem">DIETER app URL (Vercel)</label>
          <input type="text" id="dp-deploy-frontend" placeholder="https://your-app.vercel.app" value="${escapeAttr(getDeployFrontendUrl())}" style="width:100%;margin:4px 0 8px;font-size:.62rem"/>
          <label style="font-size:.58rem">Backend API (Render)</label>
          <input type="text" id="dp-deploy-backend" placeholder="https://dieter-api.onrender.com" value="${escapeAttr(getBackendBase())}" style="width:100%;margin:4px 0 8px;font-size:.62rem"/>
          <button type="button" class="btn btn-green btn-sm" id="dp-deploy-save" style="width:100%">${icon('check', 12)} Save links &amp; set API base</button>
          <div class="status-text" id="dp-deploy-status" style="margin-top:8px;font-size:.58rem"></div>
          <p style="font-size:.52rem;color:var(--dim);margin-top:8px;line-height:1.5">
            Full guide: <code style="font-size:.55rem">MAC_SETUP.md</code> in the project folder.
          </p>
        </div>

        <div class="panel" style="background:linear-gradient(135deg,rgba(168,85,247,.06),rgba(124,58,237,.03))">
          <div class="panel-header">${icon('zap', 16)} Mureka Quick Links</div>
          <a href="https://www.mureka.ai" target="_blank" rel="noopener" class="track-row" style="text-decoration:none;color:inherit">
            <span style="color:var(--purple)">${icon('globe', 16)}</span>
            <div class="track-info"><div class="track-title">Mureka Home</div><div class="track-meta">mureka.ai</div></div>
            <span style="color:var(--dim)">${icon('externalLink', 12)}</span>
          </a>
          <a href="https://www.mureka.ai/create" target="_blank" rel="noopener" class="track-row" style="text-decoration:none;color:inherit">
            <span style="color:var(--orange)">${icon('music', 16)}</span>
            <div class="track-info"><div class="track-title">Create Music</div><div class="track-meta">AI generation</div></div>
            <span style="color:var(--dim)">${icon('externalLink', 12)}</span>
          </a>
          <a href="https://www.mureka.ai/library" target="_blank" rel="noopener" class="track-row" style="text-decoration:none;color:inherit">
            <span style="color:var(--blue)">${icon('disc', 16)}</span>
            <div class="track-info"><div class="track-title">My Library</div><div class="track-meta">Your Mureka tracks</div></div>
            <span style="color:var(--dim)">${icon('externalLink', 12)}</span>
          </a>
          <a href="https://www.mureka.ai/pricing" target="_blank" rel="noopener" class="track-row" style="text-decoration:none;color:inherit">
            <span style="color:var(--green)">${icon('star', 16)}</span>
            <div class="track-info"><div class="track-title">Plans</div><div class="track-meta">Pricing & features</div></div>
            <span style="color:var(--dim)">${icon('externalLink', 12)}</span>
          </a>
        </div>

        <div class="panel">
          <div class="panel-header">${icon('file', 16)} Format Guide</div>
          <div style="font-size:.6rem">
            <div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid var(--border)"><span style="font-weight:700">WAV</span><span style="color:var(--green)">Lossless · Best quality</span></div>
            <div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid var(--border)"><span style="font-weight:700">MP3</span><span style="color:var(--blue)">Compressed · Universal</span></div>
            <div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid var(--border)"><span style="font-weight:700">OGG</span><span style="color:var(--purple)">Compressed · Open format</span></div>
            <div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid var(--border)"><span style="font-weight:700">FLAC</span><span style="color:var(--orange)">Lossless · Compressed</span></div>
            <div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid var(--border)"><span style="font-weight:700">MP4</span><span style="color:var(--pink)">Video + audio</span></div>
            <div style="display:flex;justify-content:space-between;padding:3px 0"><span style="font-weight:700">WebM</span><span style="color:var(--cyan)">Web video format</span></div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-header">${icon('zap', 16)} Workflow</div>
          <div style="font-size:.58rem;color:var(--dim);line-height:1.8">
            <div style="display:flex;align-items:center;gap:4px"><span style="color:var(--purple);font-weight:700">1.</span> Create in Mureka AI</div>
            <div style="display:flex;align-items:center;gap:4px"><span style="color:var(--blue);font-weight:700">2.</span> Download MP3/WAV</div>
            <div style="display:flex;align-items:center;gap:4px"><span style="color:var(--green);font-weight:700">3.</span> Import here (drag & drop)</div>
            <div style="display:flex;align-items:center;gap:4px"><span style="color:var(--orange);font-weight:700">4.</span> Analyze beats + key</div>
            <div style="display:flex;align-items:center;gap:4px"><span style="color:var(--pink);font-weight:700">5.</span> Mix & master</div>
            <div style="display:flex;align-items:center;gap:4px"><span style="color:var(--cyan);font-weight:700">6.</span> Create video</div>
            <div style="display:flex;align-items:center;gap:4px"><span style="color:var(--yellow);font-weight:700">7.</span> Export MP3/WAV/MP4</div>
            <div style="display:flex;align-items:center;gap:4px"><span style="color:var(--red);font-weight:700">8.</span> Distribute everywhere</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

let currentExportFilter = 'all';

export function init() {
  // Import drag & drop
  const dropZone = document.getElementById('import-drop');
  const fileInput = document.getElementById('import-file-input');
  if (dropZone) {
    dropZone.addEventListener('click', () => fileInput?.click());
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', e => { e.preventDefault(); dropZone.classList.remove('dragover'); handleImport([...e.dataTransfer.files]); });
  }
  if (fileInput) fileInput.addEventListener('change', () => handleImport([...fileInput.files]));

  // Mureka embed toggle
  document.getElementById('btn-toggle-embed')?.addEventListener('click', toggleEmbed);

  setupMurekaCloneUI();

  void mountMurekaEdge(document.getElementById('mureka-dieter-edge-root'));

  // Export filters
  document.querySelectorAll('[data-expf]').forEach(el => {
    el.addEventListener('click', () => {
      currentExportFilter = el.dataset.expf;
      document.querySelectorAll('[data-expf]').forEach(x => x.classList.toggle('active', x.dataset.expf === currentExportFilter));
      renderExportList();
    });
  });

  // Export buttons
  document.getElementById('btn-export-wav')?.addEventListener('click', () => exportSelected('wav'));
  document.getElementById('btn-export-mp3')?.addEventListener('click', () => exportSelected('mp3'));
  document.getElementById('btn-export-mp4')?.addEventListener('click', () => exportSelected('mp4'));
  document.getElementById('btn-export-all')?.addEventListener('click', () => exportSelected('all'));

  // Nav
  document.querySelectorAll('[data-goto]').forEach(el => {
    el.addEventListener('click', () => navigate(el.dataset.goto));
  });

  renderRouteList();
  renderExportList();
  renderImportList();
}

function toggleEmbed() {
  const wrap = document.getElementById('mureka-embed-wrap');
  const iframe = document.getElementById('mureka-iframe');
  if (!wrap) return;
  const visible = wrap.style.display !== 'none';
  wrap.style.display = visible ? 'none' : 'block';
  if (!visible && iframe && iframe.src === 'about:blank') {
    iframe.src = 'https://www.mureka.ai';
  }
}

function getMurekaDraft() {
  const instrumental = !!document.getElementById('mureka-instrumental')?.checked;
  return {
    title: document.getElementById('mureka-song-title')?.value?.trim() || '',
    style: document.getElementById('mureka-style-input')?.value?.trim() || '',
    lyrics: instrumental ? '' : (document.getElementById('mureka-lyrics-ta')?.value?.trim() || ''),
    vocal: document.querySelector('input[name="mureka-vocal"]:checked')?.value || 'female',
    instrumental,
    modes: [...document.querySelectorAll('.mureka-mode-tab.active')].map(t => t.dataset.murekaMode).filter(Boolean),
    ts: Date.now(),
  };
}

function saveMurekaDraft() {
  const draft = getMurekaDraft();
  try { sessionStorage.setItem('dp-mureka-draft', JSON.stringify(draft)); } catch {}
  return draft;
}

function openMurekaCreateWithDraft() {
  const d = saveMurekaDraft();
  const u = new URL(`${MUREKA_BASE}/create`);
  u.searchParams.set('ref', 'dieter-pro');
  u.searchParams.set('source', 'dieter-pro-suite');
  if (d.title) u.searchParams.set('title', d.title.slice(0, 50));
  if (d.style) u.searchParams.set('style', d.style.slice(0, 240));
  if (d.lyrics) u.searchParams.set('lyrics', d.lyrics.slice(0, 1200));
  u.searchParams.set('vocal', d.vocal);
  if (d.instrumental) u.searchParams.set('instrumental', '1');
  if (d.modes.length) u.searchParams.set('mode', d.modes.join(','));
  window.open(u.toString(), '_blank', 'noopener');
  state.log('Mureka Bridge', 'Opened Mureka Create with draft params');
}

function getMurekaOpenAIKey() {
  const el = document.getElementById('mureka-openai-key');
  if (el?.value?.trim()) return el.value.trim();
  return getOpenaiKey();
}

function setLyricsStatus(msg) {
  const el = document.getElementById('mureka-lyrics-status');
  if (el) el.textContent = msg || '';
}

function applyInstrumentalUI(locked) {
  const ta = document.getElementById('mureka-lyrics-ta');
  if (ta) {
    ta.disabled = locked;
    ta.placeholder = locked
      ? 'Instrumental mode — describe everything in Style + title.'
      : '[Verse]\nYour lines…\n\n[Chorus]\n…';
  }
  document.querySelectorAll('input[name="mureka-vocal"]').forEach((r) => {
    r.disabled = locked;
  });
}

function setupMurekaCloneUI() {
  document.querySelectorAll('.mureka-mode-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.mureka-mode-tab').forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
    });
  });

  const titleIn = document.getElementById('mureka-song-title');
  const titleCnt = document.getElementById('mureka-title-count');
  if (titleIn && titleCnt) {
    titleIn.addEventListener('input', () => { titleCnt.textContent = String(titleIn.value.length); });
  }

  const oai = document.getElementById('mureka-openai-key');
  if (oai) {
    oai.value = getOpenaiKey();
    oai.addEventListener('blur', () => setOpenaiKey(oai.value));
  }

  const inst = document.getElementById('mureka-instrumental');
  if (inst) {
    inst.addEventListener('change', () => applyInstrumentalUI(inst.checked));
    applyInstrumentalUI(inst.checked);
  }

  document.querySelectorAll('.mureka-style-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const s = chip.dataset.styleChip || chip.textContent?.trim();
      const inp = document.getElementById('mureka-style-input');
      if (inp && s) inp.value = s;
      document.querySelectorAll('.mureka-style-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
    });
  });

  document.getElementById('mureka-btn-gen-lyrics')?.addEventListener('click', async () => {
    if (document.getElementById('mureka-instrumental')?.checked) {
      setLyricsStatus('Turn off Instrumental to generate lyrics.');
      return;
    }
    setLyricsStatus('Generating…');
    const style = document.getElementById('mureka-style-input')?.value?.trim() || 'Melodic Trap';
    const title = document.getElementById('mureka-song-title')?.value?.trim() || '';
    const vocal = document.querySelector('input[name="mureka-vocal"]:checked')?.value || 'female';
    const key = getMurekaOpenAIKey();
    try {
      let text = await generateLyricsOpenAI(key, style, title, vocal);
      if (!text) text = generateLyricsLocal(style, title, vocal);
      const ta = document.getElementById('mureka-lyrics-ta');
      if (ta) ta.value = text;
      setLyricsStatus(key ? 'Lyrics generated (OpenAI or local fallback).' : 'Lyrics generated locally. Add OpenAI key for AI text.');
      saveMurekaDraft();
    } catch (e) {
      const ta = document.getElementById('mureka-lyrics-ta');
      if (ta) ta.value = generateLyricsLocal(style, title, vocal);
      setLyricsStatus(`OpenAI fallback: ${e?.message || e}`);
      saveMurekaDraft();
    }
  });

  document.getElementById('mureka-btn-optimize')?.addEventListener('click', async () => {
    if (document.getElementById('mureka-instrumental')?.checked) {
      setLyricsStatus('Turn off Instrumental to optimize lyrics.');
      return;
    }
    const ta = document.getElementById('mureka-lyrics-ta');
    const raw = ta?.value?.trim() || '';
    if (!raw) {
      setLyricsStatus('Add lyrics first, or use Generate Lyrics.');
      return;
    }
    setLyricsStatus('Optimizing…');
    const key = getMurekaOpenAIKey();
    try {
      let text = await optimizeLyricsOpenAI(key, raw);
      if (!text) text = optimizeLyricsLocal(raw);
      if (ta) ta.value = text;
      setLyricsStatus('Lyrics optimized.');
      saveMurekaDraft();
    } catch (e) {
      if (ta) ta.value = optimizeLyricsLocal(raw);
      setLyricsStatus(`Optimized locally (${e?.message || 'OpenAI unavailable'})`);
      saveMurekaDraft();
    }
  });

  document.getElementById('mureka-btn-to-dieter-lyrics')?.addEventListener('click', () => {
    saveMurekaDraft();
    navigate('lyrics');
    state.log('Mureka Bridge', 'Draft → Lyrics Studio');
  });

  document.getElementById('mureka-btn-create-mureka')?.addEventListener('click', openMurekaCreateWithDraft);
  document.getElementById('mureka-btn-create-dieter')?.addEventListener('click', () => {
    saveMurekaDraft();
    navigate('create');
    state.log('Mureka Bridge', 'Draft saved → DIETER Create');
  });

  document.getElementById('dp-deploy-save')?.addEventListener('click', () => {
    const fe = document.getElementById('dp-deploy-frontend');
    const be = document.getElementById('dp-deploy-backend');
    const st = document.getElementById('dp-deploy-status');
    const front = (fe?.value || '').trim().replace(/\/+$/, '');
    const back = (be?.value || '').trim().replace(/\/+$/, '');
    setDeployFrontendUrl(front);
    setBackendBase(back);
    if (st) {
      if (!back && !front) {
        st.innerHTML = '<span style="color:var(--orange)">Enter your Render backend URL (required for API).</span>';
      } else {
        const bits = [];
        if (back) bits.push(`<span style="color:var(--green)">Backend saved</span> · <code style="font-size:.58rem">${escapeAttr(back)}</code>`);
        if (front) {
          bits.push(
            `<span style="color:var(--green)">App URL saved</span> — bookmark: <a href="${escapeAttr(front)}" target="_blank" rel="noopener" style="color:var(--cyan)">${escapeAttr(front)}</a>`,
          );
        }
        st.innerHTML = bits.join('<br/>');
      }
    }
    state.log('Deployment', `Frontend ${front || '—'} · Backend ${back || '—'}`);
  });
}

function renderRouteList() {
  const container = document.getElementById('mureka-routes');
  if (!container) return;

  const routes = [
    { name: 'Auth Connect (template)', method: 'GET', value: `${BRIDGE_BASE}/oauth/authorize?client_id=YOUR_CLIENT_ID&redirect_uri=${encodeURIComponent(location.origin + '/mureka-callback')}&response_type=code&scope=library:read library:write` },
    { name: 'Pull Tracks from Mureka', method: 'GET', value: `${BRIDGE_BASE}/v1/tracks?limit=50&sort=recent` },
    { name: 'Push Track to Mureka', method: 'POST', value: `${BRIDGE_BASE}/v1/tracks/upload` },
    { name: 'Sync Job Status', method: 'GET', value: `${BRIDGE_BASE}/v1/sync/jobs/{jobId}` },
    { name: 'Webhook Receiver (your app)', method: 'POST', value: `${location.origin}/api/mureka/webhook` },
    { name: 'Direct Create Route', method: 'LINK', value: `${MUREKA_BASE}/create?ref=dieter-pro&title={trackTitle}&bpm={bpm}&genre={genre}` },
  ];

  container.innerHTML = routes.map((r, i) => `
    <div class="track-row" style="align-items:flex-start;gap:6px">
      <div style="min-width:38px;font-size:.56rem;color:var(--cyan);font-weight:700;padding-top:2px">${r.method}</div>
      <div class="track-info">
        <div class="track-title" style="font-size:.72rem">${r.name}</div>
        <div class="track-meta" style="font-family:'SF Mono','Cascadia Code',monospace;word-break:break-all">${r.value}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:4px">
        <button class="btn btn-ghost btn-sm route-copy" data-ridx="${i}" title="Copy route">${icon('file', 12)} Copy</button>
        <button class="btn btn-green btn-sm route-open" data-ridx="${i}" title="Open link">${icon('externalLink', 12)} Open</button>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.route-copy').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = +btn.dataset.ridx;
      await copyRoute(routes[idx]?.value || '');
    });
  });
  container.querySelectorAll('.route-open').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = +btn.dataset.ridx;
      const url = routes[idx]?.value || '';
      if (url.startsWith('http://') || url.startsWith('https://')) window.open(url, '_blank', 'noopener');
    });
  });
}

async function copyRoute(text) {
  const status = document.getElementById('mureka-route-status');
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    if (status) status.textContent = 'Route copied to clipboard.';
  } catch {
    if (status) status.textContent = 'Could not copy automatically. Select and copy manually.';
  }
}

/* ═══ IMPORT ═══ */
async function handleImport(files) {
  const statusEl = document.getElementById('import-status');
  if (!files.length) return;

  for (const file of files) {
    if (statusEl) statusEl.textContent = `Importing ${file.name}...`;

    try {
      const isVideo = file.type.startsWith('video/');
      const isAudio = file.type.startsWith('audio/');
      if (!isAudio && !isVideo) {
        if (statusEl) statusEl.textContent = `Skipped ${file.name} — unsupported format`;
        continue;
      }

      const url = URL.createObjectURL(file);
      const sizeMB = (file.size / 1048576).toFixed(1);
      let duration = '0:00';
      let bpm = 0;
      let key = 'Am';

      if (isAudio) {
        try {
          const buffer = await engine.decodeFile(file);
          duration = formatDuration(buffer.duration);
          const beats = engine.detectBeats(buffer);
          bpm = engine.calculateBPM(beats);
          key = await engine.detectKey(buffer);
        } catch { /* can still import without decoding */ }
      }

      if (isVideo) {
        duration = await getVideoDuration(url);
      }

      const entry = {
        id: crypto.randomUUID(),
        name: file.name,
        type: file.type,
        size: sizeMB + ' MB',
        url, duration, bpm, key,
        ts: Date.now(),
        isVideo,
      };
      importedFiles.unshift(entry);

      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const genre = isVideo ? 'Video' : 'Imported';
      state.addToLibrary({
        id: entry.id,
        title: file.name.replace(/\.\w+$/, ''),
        genre, bpm: bpm || 120, key,
        duration, fav: false, ts: Date.now(),
        source: 'import',
      });

      if (statusEl) statusEl.textContent = `Imported ${file.name} (${sizeMB} MB${bpm ? ` · ${bpm} BPM · ${key}` : ''})`;
      state.log('Import/Export', `Imported "${file.name}" · ${sizeMB} MB${bpm ? ` · ${bpm} BPM` : ''}`);
    } catch (e) {
      if (statusEl) statusEl.textContent = `Error importing ${file.name}: ${e.message}`;
    }
  }

  renderImportList();
  renderExportList();
}

function renderImportList() {
  const el = document.getElementById('import-list');
  if (!el) return;
  if (!importedFiles.length) { el.innerHTML = ''; return; }
  el.innerHTML = importedFiles.slice(0, 10).map(f => `
    <div class="track-row">
      <button class="btn btn-green btn-sm import-play" data-url="${f.url}" data-video="${f.isVideo}">${icon('play', 12)}</button>
      <div class="track-info">
        <div class="track-title">${f.name}</div>
        <div class="track-meta">${f.size} · ${f.duration}${f.bpm ? ` · ${f.bpm} BPM · ${f.key}` : ''} · ${f.type}</div>
      </div>
      <button class="btn btn-blue btn-sm import-analyze" data-iid="${f.id}">${icon('activity', 12)}</button>
    </div>
  `).join('');

  el.querySelectorAll('.import-play').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const url = btn.dataset.url;
      if (btn.dataset.video === 'true') {
        window.open(url, '_blank');
      } else {
        playUrl(url);
      }
    });
  });

  el.querySelectorAll('.import-analyze').forEach(btn => {
    btn.addEventListener('click', () => navigate('beats'));
  });
}

async function playUrl(url) {
  try {
    engine.getContext();
    const res = await fetch(url);
    const buf = await res.arrayBuffer();
    const decoded = await engine.getContext().decodeAudioData(buf);
    engine.setBuffer(decoded);
    engine.play();
  } catch (e) {
    console.error('[Import] play error:', e);
  }
}

function getVideoDuration(url) {
  return new Promise(resolve => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      resolve(formatDuration(video.duration));
      URL.revokeObjectURL(url);
    };
    video.onerror = () => resolve('--:--');
    video.src = url;
  });
}

/* ═══ EXPORT ═══ */
function renderExportList() {
  const el = document.getElementById('export-list');
  if (!el) return;
  const lib = state.get('library');
  const filtered = lib.filter(t => {
    if (currentExportFilter === 'all') return true;
    return t.source === currentExportFilter;
  });

  el.innerHTML = filtered.length ? filtered.map(t => `
    <div class="track-row" data-export-id="${t.id}">
      <input type="checkbox" class="export-check" data-eid="${t.id}" checked style="accent-color:var(--purple);cursor:pointer"/>
      <div class="track-info">
        <div class="track-title">${t.title}</div>
        <div class="track-meta">${t.genre} · ${t.bpm} BPM · ${t.key} · ${t.duration}</div>
      </div>
    </div>
  `).join('') : '<div style="text-align:center;color:var(--dim);padding:14px;font-size:.66rem">No tracks</div>';
}

async function exportSelected(format) {
  const checks = document.querySelectorAll('.export-check:checked');
  const statusEl = document.getElementById('export-status');
  if (!checks.length) {
    if (statusEl) statusEl.textContent = 'Select tracks to export!';
    return;
  }

  const count = checks.length;
  if (statusEl) statusEl.textContent = `Exporting ${count} track(s) as ${format.toUpperCase()}...`;

  const buffer = engine.getBuffer();

  if (buffer && format === 'wav') {
    try {
      const wav = encodeWAV(buffer);
      downloadBlob(wav, 'dieter-pro-export.wav', 'audio/wav');
      if (statusEl) statusEl.textContent = `Exported WAV · ${(wav.size / 1048576).toFixed(1)} MB`;
      exportQueue.push({ format: 'wav', count, ts: Date.now() });
      state.log('Import/Export', `Exported ${count} track(s) as WAV`);
      return;
    } catch (e) {
      console.error('[Export] WAV error:', e);
    }
  }

  if (buffer && (format === 'mp3' || format === 'all')) {
    try {
      const ctx = new OfflineAudioContext(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start();
      const rendered = await ctx.startRendering();
      const wav = encodeWAV(rendered);
      downloadBlob(wav, `dieter-pro-export.wav`, 'audio/wav');
      if (statusEl) statusEl.textContent = `Exported ${format.toUpperCase()} · ${(wav.size / 1048576).toFixed(1)} MB`;
      exportQueue.push({ format, count, ts: Date.now() });
      state.log('Import/Export', `Exported ${count} track(s) as ${format.toUpperCase()}`);
      return;
    } catch {}
  }

  if (format === 'mp4') {
    if (statusEl) statusEl.textContent = 'MP4 export — use Video Engine to render video with audio';
    setTimeout(() => navigate('video'), 1500);
    return;
  }

  // Fallback: short silent WAV (no synthesized tone) — user should import real audio for a full mix
  try {
    const sr = 44100;
    const dur = 0.35;
    const offCtx = new OfflineAudioContext(1, Math.floor(sr * dur), sr);
    const rendered = await offCtx.startRendering();
    const wav = encodeWAV(rendered);
    downloadBlob(wav, `dieter-pro-export-${Date.now()}.wav`, 'audio/wav');
    exportQueue.push({ format: 'wav', count, ts: Date.now() });
    if (statusEl) statusEl.textContent = 'Exported placeholder WAV (silent) — import a real audio file in Beats / Create for actual sound.';
    state.log('Import/Export', 'Exported silent placeholder WAV (no synth tone)');
  } catch (e) {
    if (statusEl) statusEl.textContent = 'Export error: ' + e.message;
  }
}

function encodeWAV(audioBuffer) {
  const numCh = audioBuffer.numberOfChannels;
  const sr = audioBuffer.sampleRate;
  const bitsPerSample = 16;
  const numSamples = audioBuffer.length;
  const byteRate = sr * numCh * (bitsPerSample / 8);
  const blockAlign = numCh * (bitsPerSample / 8);
  const dataSize = numSamples * numCh * (bitsPerSample / 8);
  const bufferSize = 44 + dataSize;
  const buffer = new ArrayBuffer(bufferSize);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, bufferSize - 8, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numCh, true);
  view.setUint32(24, sr, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  const channels = [];
  for (let ch = 0; ch < numCh; ch++) channels.push(audioBuffer.getChannelData(ch));

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < numCh; ch++) {
      let sample = channels[ch][i];
      sample = Math.max(-1, Math.min(1, sample));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i));
}

function downloadBlob(blob, filename, mime) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function formatDuration(s) {
  if (!s || isNaN(s)) return '--:--';
  return Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
}
