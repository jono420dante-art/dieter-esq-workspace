/**
 * Vercel Edge: proxy same-origin /api/* to FastAPI when DIETER_API_ORIGIN is set.
 * Stops the SPA fallback from returning index.html for /api/health (Invalid JSON).
 *
 * When DIETER_API_ORIGIN is unset, passes through so `api/**` Node routes (e.g. Mureka
 * serverless under api/mureka/) still run.
 *
 * Vercel env (Production): DIETER_API_ORIGIN=https://your-service.up.railway.app
 * (no trailing slash; do not include /api — paths like /api/health are appended as-is)
 *
 * Alternatively set VITE_API_BASE to the full API base URL and rebuild — the browser
 * will call Railway directly (configure CORS on the API).
 */
import { next } from '@vercel/edge'

export const config = {
  matcher: ['/api', '/api/:path*'],
}

export default async function middleware(request) {
  const { pathname, search } = new URL(request.url)

  /** Let Node serverless in `api/mureka/song/*` handle Mureka proxy (Vercel env key). */
  if (
    pathname === '/api/mureka/song/generate' ||
    pathname.startsWith('/api/mureka/song/query/')
  ) {
    return next()
  }

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
