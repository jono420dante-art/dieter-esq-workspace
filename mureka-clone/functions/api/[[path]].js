/**
 * Cloudflare Pages Function — proxies same-origin /api/* to FastAPI.
 * Fixes: HTTP 404 "NOT_FOUND" / "cpt1::" when the static host has no API.
 *
 * Dashboard: Workers & Pages → ed-geerdes → Settings → Environment variables
 *   Production + Preview: DIETER_API_ORIGIN = https://your-service.up.railway.app
 * (no trailing slash; do not include /api — request path /api/health is appended)
 *
 * Alternative: set VITE_API_BASE=https://…/api at build time so the browser calls the API directly (CORS on FastAPI).
 */
export async function onRequest({ request, env }) {
  const raw = String(env.DIETER_API_ORIGIN || '')
    .trim()
    .replace(/\/$/, '')
  const origin = raw.replace(/\/api$/i, '')
  if (!origin) {
    return new Response(
      JSON.stringify({
        ok: false,
        error:
          'Cloudflare Pages: set DIETER_API_ORIGIN to your FastAPI host (e.g. https://xxx.up.railway.app). Or rebuild with VITE_API_BASE pointing at …/api. See docs/DEPLOY_CHANNELS_PERFORMANCE.md.',
      }),
      {
        status: 503,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
        },
      },
    )
  }

  const u = new URL(request.url)
  const target = `${origin}${u.pathname}${u.search}`

  try {
    return await fetch(new Request(target, request))
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return new Response(JSON.stringify({ ok: false, error: `Proxy fetch failed: ${msg}` }), {
      status: 502,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    })
  }
}
