/**
 * Studio identity — overridable in Vercel / local via VITE_STUDIO_NAME.
 */
export const STUDIO_NAME = (import.meta.env.VITE_STUDIO_NAME || 'ED-GEERDES').trim()

/** Short line for downloads / filenames (ASCII, no spaces). */
export const STUDIO_SLUG = (import.meta.env.VITE_STUDIO_SLUG || 'ed-geerdes').trim().toLowerCase()
