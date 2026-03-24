/* Router — Hash-based SPA routing with smooth transitions */

import { set, get } from './state.js';

const pages = {};
let currentPage = null;
let isTransitioning = false;

export function register(name, module) {
  pages[name] = module;
}

export function navigate(page) {
  if (!page || (page === currentPage && !forceRerender(page)) || isTransitioning) return;

  isTransitioning = true;

  const prevEl = currentPage ? document.getElementById('page-' + currentPage) : null;
  const nextEl = document.getElementById('page-' + page);
  if (!nextEl) { console.warn('[Router] Unknown page:', page); isTransitioning = false; return; }

  if (prevEl && prevEl !== nextEl) {
    prevEl.classList.remove('active');
    if (pages[currentPage]?.destroy) {
      try { pages[currentPage].destroy(); } catch (e) { console.error('[Router] destroy error:', e); }
    }
  }

  document.querySelectorAll('.sb-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });

  const title = nextEl.dataset.title || page;
  const titleEl = document.getElementById('topbar-title');
  if (titleEl) titleEl.textContent = title;

  if (pages[page]?.render && !nextEl._rendered) {
    try {
      nextEl.innerHTML = pages[page].render();
      nextEl._rendered = true;
    } catch (e) {
      console.error('[Router] render error:', page, e);
      nextEl.innerHTML = `<div class="panel"><div class="panel-header">Error</div><p style="color:var(--red)">${e.message}</p></div>`;
    }
  }

  requestAnimationFrame(() => {
    nextEl.scrollTop = 0;
    nextEl.classList.add('active');
    if (pages[page]?.init) {
      try { pages[page].init(); } catch (e) { console.error('[Router] init error:', page, e); }
    }
    setTimeout(() => { isTransitioning = false; }, 260);
  });

  currentPage = page;
  set('currentPage', page);
  window.location.hash = '#/' + page;
}

function forceRerender(page) {
  const el = document.getElementById('page-' + page);
  return el && !el._rendered;
}

export function getCurrentPage() { return currentPage; }

export function init() {
  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#/', '') || 'home';
    if (hash !== currentPage) navigate(hash);
  });

  document.querySelectorAll('[data-page]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(el.dataset.page);
    });
  });

  const initial = window.location.hash.replace('#/', '') || get('currentPage') || 'home';
  navigate(initial);
}

export function rerender(page) {
  const el = document.getElementById('page-' + page);
  if (!el || !pages[page]?.render) return;
  try {
    el.innerHTML = pages[page].render();
    el._rendered = true;
    if (pages[page]?.init) pages[page].init();
  } catch (e) {
    console.error('[Router] rerender error:', page, e);
  }
}
