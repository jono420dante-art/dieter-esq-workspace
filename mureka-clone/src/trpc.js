import { createTRPCClient, httpBatchLink } from '@trpc/client'

/** tRPC HTTP endpoint (Vite dev: proxy /trpc → DIETER_TRPC_PORT). */
export function getTrpcHttpUrl() {
  const u = import.meta.env.VITE_TRPC_URL
  if (u && String(u).trim()) {
    const s = String(u).trim().replace(/\/$/, '')
    return s.endsWith('/trpc') ? s : `${s}/trpc`
  }
  return '/trpc'
}

export const trpc = createTRPCClient({
  links: [
    httpBatchLink({
      url: getTrpcHttpUrl(),
    }),
  ],
})
