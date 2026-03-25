/**
 * Same behavior as mureka-clone/middleware.js (repo-root Vercel projects).
 * Requires @vercel/edge at the directory where `npm ci` runs (see root package.json + vercel.json).
 */
import { next } from '@vercel/edge'

export const config = {
  matcher: ['/api', '/api/:path*'],
}

export default async function middleware(request) {
  const { pathname, search } = new URL(request.url)

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
