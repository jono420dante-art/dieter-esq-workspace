import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { getSiteUrl } from './siteUrl.js'
import { STUDIO_NAME } from './studioBrand.js'

const desc = `${STUDIO_NAME} — Lyrics to music: Mureka vocals, Teal Voices, beat lab, stems, release SEO & social tools.`

function ensureMeta(attr, key, val) {
  if (!val || typeof document === 'undefined') return
  let el = document.querySelector(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', val)
}

if (typeof document !== 'undefined') {
  document.title = `${STUDIO_NAME} · Music studio`
  const meta = document.querySelector('meta[name="description"]')
  if (meta) meta.setAttribute('content', desc)
  ensureMeta('name', 'theme-color', '#0c0618')
  ensureMeta('property', 'og:type', 'website')
  ensureMeta('property', 'og:title', `${STUDIO_NAME} · AI music studio`)
  ensureMeta('property', 'og:description', desc)
  ensureMeta('name', 'twitter:card', 'summary_large_image')
  ensureMeta('name', 'twitter:title', `${STUDIO_NAME} · Music studio`)
  ensureMeta('name', 'twitter:description', desc)
}

const site = getSiteUrl()
if (site && typeof document !== 'undefined') {
  const href = `${site}/`
  const ogImage = `${site.replace(/\/$/, '')}/favicon.svg`
  let link = document.querySelector('link[rel="canonical"]')
  if (!link) {
    link = document.createElement('link')
    link.rel = 'canonical'
    document.head.appendChild(link)
  }
  link.href = href
  ensureMeta('property', 'og:url', href)
  ensureMeta('property', 'og:image', ogImage)
  ensureMeta('name', 'twitter:image', ogImage)
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
