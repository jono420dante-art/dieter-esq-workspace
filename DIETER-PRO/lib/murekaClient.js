/**
 * Helpers for Mureka task JSON (matches dieter-webapp / mureka_sync shapes).
 */

export function parseMurekaTaskId(data) {
  if (!data || typeof data !== 'object') return null;
  const d = data.data && typeof data.data === 'object' ? data.data : data;
  const tid = d.id ?? d.task_id ?? d.taskId;
  return tid != null && String(tid).length ? String(tid) : null;
}

export function extractMurekaAudioUrl(d) {
  if (!d || typeof d !== 'object') return null;
  for (const key of ['audio_url', 'mp3_url', 'url', 'download_url', 'file_url']) {
    const v = d[key];
    if (typeof v === 'string' && /^https?:\/\//i.test(v)) return v;
  }
  const nested = d.data;
  if (nested && typeof nested === 'object') {
    const u = extractMurekaAudioUrl(nested);
    if (u) return u;
  }
  const result = d.result;
  if (result && typeof result === 'object') {
    const u = extractMurekaAudioUrl(result);
    if (u) return u;
  }
  const choices = d.choices;
  if (Array.isArray(choices) && choices[0] && typeof choices[0] === 'object') {
    return extractMurekaAudioUrl(choices[0]);
  }
  return null;
}

export function murekaStatusLower(d) {
  if (!d || typeof d !== 'object') return '';
  const s =
    d.status ??
    d.data?.status ??
    d.result?.status ??
    (Array.isArray(d.choices) && d.choices[0]?.status);
  return String(s || '').toLowerCase();
}
