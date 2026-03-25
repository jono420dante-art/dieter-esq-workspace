/**
 * Same as mureka-clone/middleware.js — use this when Vercel "Root Directory" is the repo root
 * (vercel.json at repository root with outputDirectory mureka-clone/dist).
 */
export const config = {
  matcher: ['/api', '/api/:path*'],
}

export default async function middleware(request) {
  const origin = (process.env.DIETER_API_ORIGIN || '').trim().replace(/\/$/, '')
  const { pathname, search } = new URL(request.url)

  if (!origin) {
    return new Response(
      JSON.stringify({
        ok: false,
        error:
          'Vercel proxy disabled: set DIETER_API_ORIGIN to your API host (e.g. https://xxx.up.railway.app), or set VITE_API_BASE on build to call the API directly.',
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

  const target = `${origin}${pathname}${search}`
  try {
    return await fetch(new Request(target, request))
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return new Response(
      JSON.stringify({ ok: false, error: `Proxy fetch failed: ${msg}` }),
      {
        status: 502,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      },
    )
  }
}
