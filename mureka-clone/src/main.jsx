import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { getSiteUrl } from './siteUrl.js'
import { STUDIO_NAME } from './studioBrand.js'

if (typeof document !== 'undefined') {
  document.title = STUDIO_NAME
  const meta = document.querySelector('meta[name="description"]')
  if (meta) {
    meta.setAttribute(
      'content',
      `${STUDIO_NAME} — AI music studio: beat lab, local pipeline, voice tools, cloud create.`,
    )
  }
}

const site = getSiteUrl()
if (site && typeof document !== 'undefined') {
  const href = `${site}/`
  let link = document.querySelector('link[rel="canonical"]')
  if (!link) {
    link = document.createElement('link')
    link.rel = 'canonical'
    document.head.appendChild(link)
  }
  link.href = href
  let og = document.querySelector('meta[property="og:url"]')
  if (!og) {
    og = document.createElement('meta')
    og.setAttribute('property', 'og:url')
    document.head.appendChild(og)
  }
  og.setAttribute('content', href)
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
