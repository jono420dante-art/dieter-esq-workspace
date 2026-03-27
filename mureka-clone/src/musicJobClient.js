/**
 * Async music generation: POST /api/music/generate → poll GET /api/jobs/{jobId}.
 * Same-origin in Docker/Vite proxy; split UI: set VITE_API_BASE to full API origin + /api.
 */

/** Normalize GET /api/jobs/:id JSON into a flat playback object when succeeded. */
export function jobWithPlaybackUrls(job) {
  if (!job || job.status !== 'succeeded' || !job.output) return null
  const o = job.output
  return {
    jobId: job.jobId,
    status: job.status,
    wavUrl: o.wavUrl ?? o.mix?.wavUrl,
    wavUrlAbsolute: o.wavUrlAbsolute ?? o.mix?.wavUrlAbsolute,
    mix: o.mix,
    stems: o.stems,
    meta: o.meta,
    error: job.error,
  }
}

export async function pollJobUntilDone(jobId, { intervalMs = 800, maxWaitMs = 120000 } = {}) {
  const apiBase = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '') || ''
  const prefix = apiBase || ''
  const t0 = Date.now()
  while (Date.now() - t0 < maxWaitMs) {
    const res = await fetch(`${prefix}/api/jobs/${encodeURIComponent(jobId)}`)
    if (!res.ok) throw new Error(`job poll ${res.status}`)
    const job = await res.json()
    if (job.status === 'succeeded' || job.status === 'failed') return job
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  throw new Error('job poll timeout')
}

/**
 * @param {string} lyrics
 * @param {object} [opts]
 * @param {string} [opts.style] default Cinematic on server; this overrides request body
 * @param {number} [opts.durationSec]
 */
export async function generateFromLyrics(lyrics, opts = {}) {
  const apiBase = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '') || ''
  const prefix = apiBase || ''
  const body = {
    lyrics,
    style: opts.style ?? 'afrobeat',
    ...(opts.durationSec != null ? { durationSec: opts.durationSec } : {}),
  }
  const res = await fetch(`${prefix}/api/music/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`generate ${res.status}: ${err}`)
  }
  const { jobId } = await res.json()
  const job = await pollJobUntilDone(jobId)
  return jobWithPlaybackUrls(job)
}
