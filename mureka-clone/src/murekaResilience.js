/**
 * Retries and backoff for Dieter → FastAPI → Mureka (gateway path).
 * Never put API keys in source — use Connections, .env.local, or server MUREKA_API_KEY.
 */

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** True when the error string looks like a retryable gateway / network / rate-limit issue. */
export function isTransientMurekaError(message) {
  const s = String(message || '')
  return (
    /HTTP (408|425|429|502|503|504)\b/.test(s) ||
    /\b502\b|\b503\b|\b504\b|\b429\b|\b408\b/.test(s) ||
    /rate|throttl|timeout|unavailable|ECONNRESET|ETIMEDOUT|network|Failed to fetch|Load failed|fetch/i.test(s) ||
    /mureka_upstream_unavailable|gateway/i.test(s)
  )
}

/**
 * Run async fn with retries (exponential-ish backoff + jitter).
 * @template T
 * @param {() => Promise<T>} fn
 * @param {{ attempts?: number, baseMs?: number, label?: string }} [opts]
 */
export async function withMurekaRetries(fn, opts = {}) {
  const attempts = Math.max(1, opts.attempts ?? 4)
  const baseMs = opts.baseMs ?? 750
  let lastErr
  for (let a = 0; a < attempts; a++) {
    try {
      return await fn()
    } catch (e) {
      lastErr = e
      const msg = String(e?.message || e)
      if (!isTransientMurekaError(msg) || a === attempts - 1) {
        throw e
      }
      const delay = baseMs * (a + 1) + Math.random() * 450
      await sleep(delay)
    }
  }
  throw lastErr
}
