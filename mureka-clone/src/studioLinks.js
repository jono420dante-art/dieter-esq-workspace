/**
 * Outbound studio / e-commerce / social links for the footer.
 *
 * VITE_STUDIO_LINKS: JSON array, e.g.
 *   [{"label":"Licensing","href":"https://your-store.com"},{"label":"Instagram","href":"https://instagram.com/..."}]
 *
 * Or set individual URLs (optional):
 *   VITE_STUDIO_SHOP_URL, VITE_STUDIO_LICENSING_URL, VITE_STUDIO_INSTAGRAM_URL, VITE_STUDIO_YOUTUBE_URL
 */

function trimUrl(u) {
  const s = (u || '').trim()
  return s || null
}

export function getStudioOutboundLinks() {
  const raw = import.meta.env.VITE_STUDIO_LINKS?.trim()
  if (raw) {
    try {
      const j = JSON.parse(raw)
      if (Array.isArray(j)) {
        return j
          .filter((x) => x && typeof x.href === 'string' && typeof x.label === 'string')
          .map((x) => ({ label: x.label.trim(), href: x.href.trim() }))
          .filter((x) => x.href.startsWith('http'))
      }
    } catch {
      /* ignore invalid JSON */
    }
  }

  const singles = [
    ['Licensing / shop', trimUrl(import.meta.env.VITE_STUDIO_SHOP_URL)],
    ['Rent or buy', trimUrl(import.meta.env.VITE_STUDIO_LICENSING_URL)],
    ['Instagram', trimUrl(import.meta.env.VITE_STUDIO_INSTAGRAM_URL)],
    ['YouTube', trimUrl(import.meta.env.VITE_STUDIO_YOUTUBE_URL)],
    ['X / Twitter', trimUrl(import.meta.env.VITE_STUDIO_X_URL)],
  ]
  return singles.filter(([, href]) => href).map(([label, href]) => ({ label, href }))
}
