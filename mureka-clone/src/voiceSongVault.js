/** Browser-local library for Voice studio exports (no server). */

export const VOICE_VAULT_KEY = 'dieter_voice_saved_songs'
export const VOICE_VAULT_MAX = 40

export function loadVoiceVault() {
  try {
    const raw = localStorage.getItem(VOICE_VAULT_KEY)
    const list = JSON.parse(raw || '[]')
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

export function pushVoiceVault(entry) {
  const prev = loadVoiceVault()
  const id =
    entry.id ||
    `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  const row = { ...entry, id, savedAt: entry.savedAt ?? Date.now() }
  const next = [row, ...prev.filter((x) => x && x.id !== id)].slice(0, VOICE_VAULT_MAX)
  try {
    localStorage.setItem(VOICE_VAULT_KEY, JSON.stringify(next))
  } catch {
    /* quota */
  }
  return next
}

export function replaceVoiceVault(list) {
  try {
    localStorage.setItem(VOICE_VAULT_KEY, JSON.stringify(list.slice(0, VOICE_VAULT_MAX)))
  } catch {
    /* ignore */
  }
}
