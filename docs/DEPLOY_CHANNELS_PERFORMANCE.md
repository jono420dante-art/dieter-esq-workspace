# ED-GEERDES — channels, CI, and performance-driven deploy

This doc ties **every surface** you ship to the same product: React studio, static showroom, FastAPI, Mureka handoff, and health checks. Use it as a **runbook** after `git push`.

## Channel map (all connected)

| Channel | Role | What connects |
|--------|------|----------------|
| **GitHub `main`** | Source of truth | Triggers Actions, Vercel/GitNetlify Git integrations |
| **GitHub Actions** | CI + Vercel prod | `.github/workflows/vercel-production.yml` — `npm ci` + `npm run build` in `mureka-clone`, then `vercel deploy --prod` (requires secrets) |
| **Vercel** | Primary static frontend | Root `vercel.json` → builds `mureka-clone`, SPA rewrites, **long-cache** `Cache-Control` on `/assets/*` |
| **Netlify** | Mirror / alt CDN | `netlify.toml` — same `mureka-clone` build + `publish = dist` |
| **Railway / Docker** | API (+ optional full stack) | `dieter-backend/Dockerfile` (repo root context) per `railway.toml` / `DEPLOY_VERCEL_RAILWAY.md` — `/api/*`, `/api/health` |
| **Custom domain** | e.g. `dieter-music.app` | Point DNS to Vercel (and/or Netlify); set `VITE_SITE_URL` for canonical/meta |
| **Mureka (external)** | Cloud generation | Keys: server `MUREKA_API_KEY` and/or client **Connections**; handoff: Portal → `murekaPortalSync` |

**In-app wiring:** **Sidebar → Portal & guide** (`/#portal`) pings **`GET {VITE_API_BASE}/health`** and **`GET .../local/capabilities`**. Static **`/ed-geerdes-platform.html`** pings **`/api/health`** on the same origin.

## Performance-driven checklist (do this every release)

1. **Local gate (same as CI)**  
   `cd mureka-clone && npm ci && npm run build` — must pass with zero errors.

2. **Push**  
   `git push origin main` — lets Actions + host Git hooks run the same build.

3. **API**  
   `curl -sS https://<api-host>/api/health` → JSON `{ "ok": true, ... }`.

4. **Browser**  
   - `https://<site>/` — open **Portal & guide**, **Refresh checks**.  
   - `https://<site>/ed-geerdes-platform.html` — **Refresh health**.  
   - If split deploy: confirm **`VITE_API_BASE`** and **`DIETER_CORS_ORIGINS`** match exactly (scheme + host, no trailing slash on origins list).

5. **Assets**  
   Vercel already sets **immutable** cache for hashed `/assets/*`. Avoid shipping huge binaries in `public/` without a CDN strategy.

6. **Stripe / showroom**  
   Production build injects **`STRIPE_PUBLISHABLE_KEY`** (or `VITE_STRIPE_PUBLISHABLE_KEY`) into `ed-geerdes-platform.html` via `mureka-clone/vite.config.js`.

## Environment quick reference (split UI + API)

| Where | Variable |
|-------|-----------|
| Vercel / Netlify | `VITE_API_BASE`, `VITE_SITE_URL`, `STRIPE_PUBLISHABLE_KEY` |
| API host | `DIETER_CORS_ORIGINS`, `MUREKA_API_KEY`, `OPENAI_API_KEY` |

Full tables: **[`DEPLOY_VERCEL_RAILWAY.md`](../DEPLOY_VERCEL_RAILWAY.md)**, product copy: **[`DIETER_MUSIC_APP.md`](./DIETER_MUSIC_APP.md)**.

## If something fails

| Symptom | Likely fix |
|---------|------------|
| Portal shows API unreachable | Wrong `VITE_API_BASE`, API down, or CORS |
| Static page health offline | Static host without API on same origin — use full Docker URL or accept “offline” until API is colocated |
| Vercel deploy fails in Actions | Missing `VERCEL_TOKEN` / `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` |
| Slow first paint | Check `dist` size; lazy-load heavy labs if needed; keep `npm run build` minification on (Vite default) |
