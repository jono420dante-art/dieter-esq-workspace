/**
 * Proxies /api/* to DIETER_API_ORIGIN (FastAPI host, no trailing slash).
 * Netlify UI / env: DIETER_API_ORIGIN = https://your-service.up.railway.app
 */
export default async (request) => {
  const raw = (Deno.env.get('DIETER_API_ORIGIN') || '').trim().replace(/\/$/, '')
  if (!raw) {
    return new Response(
      JSON.stringify({
        ok: false,
        error:
          'Netlify Edge: set site env DIETER_API_ORIGIN to your FastAPI origin, or build with VITE_API_BASE pointing at /api on that host. See netlify.toml comments.',
      }),
      {
        status: 503,
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
      },
    )
  }
  const u = new URL(request.url)
  const target = `${raw}${u.pathname}${u.search}`
  try {
    return await fetch(new Request(target, request))
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 502,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    })
  }
}

export const config = { path: '/api/*' }
