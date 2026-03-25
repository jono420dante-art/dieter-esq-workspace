/**
 * Cross-app handoff to mureka.ai / platform (same draft key as dieter-platform create flow).
 */

export const MUREKA_PORTAL_DRAFT_KEY = 'dp-mureka-draft'

/**
 * @param {{ title?: string, style?: string, lyrics?: string, vocal?: string, instrumental?: boolean }} draft
 */
export function syncMurekaPortalDraft(draft) {
  try {
    sessionStorage.setItem(
      MUREKA_PORTAL_DRAFT_KEY,
      JSON.stringify({
        title: draft.title || '',
        style: draft.style || '',
        lyrics: draft.lyrics || '',
        vocal: draft.vocal === 'male' ? 'male' : 'female',
        instrumental: Boolean(draft.instrumental),
      }),
    )
  } catch {
    /* quota / private mode */
  }
}

export function openMurekaCreate() {
  window.open(
    'https://www.mureka.ai/create?source=dieter-studio&ref=voice-portal',
    '_blank',
    'noopener,noreferrer',
  )
}

export function openMurekaLibrary() {
  window.open('https://www.mureka.ai/library?source=dieter-studio', '_blank', 'noopener,noreferrer')
}

export function openMurekaPlatformDocs() {
  window.open('https://platform.mureka.ai/docs/en/quickstart.html', '_blank', 'noopener,noreferrer')
}
