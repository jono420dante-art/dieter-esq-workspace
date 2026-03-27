/**
 * Vercel Edge: proxy same-origin /api/* to FastAPI when DIETER_API_ORIGIN is set.
 * Set Production env: DIETER_API_ORIGIN=https://your-service.up.railway.app (no trailing slash, no /api).
 *
 * Pair with vercel.json SPA rewrites that skip `/api/**` so this middleware runs first.
 */
import { next } from '@vercel/edge'

export const config = {
  matcher: ['/api', '/api/:path*'],
}

export default async function middleware(request) {
  const { pathname, search } = new URL(request.url)
  const origin = (process.env.DIETER_API_ORIGIN || '').trim().replace(/\/$/, '')

  if (!origin) {
    return next()
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
