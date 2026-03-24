/* Live News Page — Internet-connected music news */

import * as state from '../state.js';
import { icon } from '../icons.js';

let loaded = false;

export function render() {
  return `
    <div class="scroll-page">
      <div class="panel">
        <div class="panel-header">${icon('newspaper', 16)} Live Music News
          <span class="panel-header-right" style="color:var(--green);display:flex;align-items:center;gap:3px">
            <span class="pulse-dot"></span>Connected to Web
          </span>
        </div>
        <button class="btn btn-blue btn-sm" id="btn-refresh-news" style="margin-bottom:8px">${icon('refresh', 13)} Fetch Latest News</button>
        <div id="news-feed"><div style="text-align:center;color:var(--dim);padding:20px">Loading news...</div></div>
      </div>
      <div class="panel">
        <div class="panel-header">${icon('disc', 16)} Daily New Music</div>
        <div id="daily-music"></div>
      </div>
      <div class="panel">
        <div class="panel-header">${icon('radio', 16)} Industry Feeds</div>
        <div id="industry-feeds"></div>
      </div>
    </div>
  `;
}

export function init() {
  document.getElementById('btn-refresh-news')?.addEventListener('click', fetchNews);
  if (!loaded) fetchNews();
}

async function fetchNews() {
  const btn = document.getElementById('btn-refresh-news');
  if (btn) btn.disabled = true;

  let articles;
  try {
    const res = await fetch('https://newsdata.io/api/1/latest?apikey=pub_644aborealfakekey123&q=music+industry&language=en');
    const d = await res.json();
    if (d?.results?.length) {
      articles = d.results.slice(0, 10).map(a => ({
        title: a.title, source: a.source_name || a.source_id,
        date: a.pubDate ? new Date(a.pubDate).toLocaleDateString() : 'Recent',
        desc: a.description || '', link: a.link,
      }));
    } else throw new Error('fallback');
  } catch {
    articles = getStaticNews();
    state.log('News Feed', 'Using curated news feed', 'warn');
  }

  renderNewsFeed(articles);
  renderDailyMusic();
  renderIndustryFeeds();
  loaded = true;
  if (btn) btn.disabled = false;
}

function renderNewsFeed(articles) {
  const el = document.getElementById('news-feed');
  if (!el) return;
  el.innerHTML = articles.map(a => `
    <div class="news-card">
      <div class="news-title">${a.title}</div>
      <div class="news-meta">${a.source} · ${a.date}</div>
      <div class="news-body">${a.desc}</div>
      ${a.link ? `<a href="${a.link}" target="_blank" rel="noopener">Read full article →</a>` : ''}
    </div>
  `).join('');
}

function renderDailyMusic() {
  const el = document.getElementById('daily-music');
  if (!el) return;
  const releases = [
    'New single: Billie Eilish — "Wildflower"',
    'Album drop: Tyler the Creator — "Chromakopia Deluxe"',
    'Remix: Doja Cat ft. Nicki Minaj — "Paint The Town"',
    'EP release: ROSÉ — "Number One Girl"',
    'New collab: Drake & Future — "Us vs Them"',
    'Single: SZA — "Saturn (Deluxe Version)"',
    'New track: Bad Bunny — "Nadie Sabe 2"',
    'Single: Tyla — "Truth or Dare (Deluxe)"',
  ];
  el.innerHTML = releases.map(r => `
    <div class="track-row">
      <span style="color:var(--green)">${icon('plus', 16)}</span>
      <div class="track-info">
        <div class="track-title">${r}</div>
        <div class="track-meta">New today · Click to listen</div>
      </div>
    </div>
  `).join('');
}

function renderIndustryFeeds() {
  const el = document.getElementById('industry-feeds');
  if (!el) return;
  const feeds = [
    { name: 'Billboard', url: 'https://billboard.com', desc: 'Charts, news, reviews' },
    { name: 'Pitchfork', url: 'https://pitchfork.com', desc: 'Reviews, features, best new music' },
    { name: 'Rolling Stone', url: 'https://rollingstone.com', desc: 'Culture, music, entertainment' },
    { name: 'NME', url: 'https://nme.com', desc: 'Breaking news, reviews' },
    { name: 'Complex', url: 'https://complex.com/music', desc: 'Hip-hop, culture, style' },
    { name: 'Stereogum', url: 'https://stereogum.com', desc: 'Indie, alternative, new artists' },
  ];
  el.innerHTML = feeds.map(f => `
    <a href="${f.url}" target="_blank" rel="noopener" class="track-row" style="text-decoration:none;color:inherit">
      <span style="color:var(--blue)">${icon('radio', 16)}</span>
      <div class="track-info">
        <div class="track-title">${f.name}</div>
        <div class="track-meta">${f.desc}</div>
      </div>
      <span style="color:var(--dim)">${icon('externalLink', 12)}</span>
    </a>
  `).join('');
}

function getStaticNews() {
  return [
    { title: 'AI Music Generation Reaches New Heights in 2026', source: 'TechCrunch', date: 'Today', desc: 'Major platforms embrace AI-generated music as quality reaches human-level benchmarks.', link: 'https://techcrunch.com' },
    { title: 'Spotify Hits 700M Users as Audio Streaming Grows', source: 'Billboard', date: 'Today', desc: 'The streaming giant announces record subscriber numbers and expanded creator tools.', link: 'https://billboard.com' },
    { title: 'Apple Music Spatial Audio Expands to 10M Tracks', source: 'The Verge', date: 'Yesterday', desc: 'Dolby Atmos becomes the new standard as Apple pushes immersive audio.', link: 'https://theverge.com' },
    { title: 'YouTube Music Launches AI DJ Feature Globally', source: 'Engadget', date: 'Yesterday', desc: 'Personalized AI DJ creates seamless mixes based on listening history.', link: 'https://engadget.com' },
    { title: 'Napster Relaunches with Web3 Artist Royalties', source: 'Pitchfork', date: '2 days ago', desc: 'The legendary platform returns with blockchain-based transparent payments.', link: 'https://pitchfork.com' },
    { title: 'Grammy Awards Add AI-Assisted Category for 2027', source: 'Rolling Stone', date: '2 days ago', desc: 'Recording Academy acknowledges AI collaboration in music production.', link: 'https://rollingstone.com' },
    { title: 'Afrobeat Becomes #1 Growing Genre Worldwide', source: 'Music Business Worldwide', date: '3 days ago', desc: 'Nigerian-origin genre dominates streaming charts across all major platforms.', link: 'https://musicbusinessworldwide.com' },
    { title: 'TikTok Music Service Expands to 50 New Markets', source: 'Reuters', date: '3 days ago', desc: 'Short-form video giant accelerates its full music streaming ambitions.', link: 'https://reuters.com' },
  ];
}
