/**
 * CORS for /api/audio/proxy so the same proxy works when API and static app
 * are on different origins (e.g. Render API + Vercel UI via absolute API URL).
 */
export function applyAudioProxyCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Accept');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
}
