/**
 * Studio identity — overridable in Vercel / local via VITE_STUDIO_NAME.
 */
export const STUDIO_NAME = (import.meta.env.VITE_STUDIO_NAME || 'ED-GEERDES').trim()

/** Short line for downloads / filenames (ASCII, no spaces). */
export const STUDIO_SLUG = (import.meta.env.VITE_STUDIO_SLUG || 'ed-geerdes').trim().toLowerCase()

/**
 * Product line for this Vite app (mureka-clone). Shown in sidebar + Create hero.
 * Override: VITE_MUREKA_CLONE_LABEL=…
 */
export const MUREKA_CLONE_LABEL = (import.meta.env.VITE_MUREKA_CLONE_LABEL || 'Mureka Clone V2').trim()
