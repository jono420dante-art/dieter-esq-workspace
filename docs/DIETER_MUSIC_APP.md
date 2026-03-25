# dieter-music.app — fork, free hosting, Stripe, roadmap

This repo powers **ED-GEERDES / Dieter Music**: React studio (`mureka-clone/`), FastAPI (`dieter-backend/`). The **marketplace shell** lives at **`/ed-geerdes-platform.html`** after build.

## 1. Stripe publishable key (`pk_live_…`)

- **Never** commit **secret** keys (`sk_live_…`) or webhook secrets.
- **Publishable** keys (`pk_live_…`) are safe to expose in the browser; they still must come from your [Stripe Dashboard](https://dashboard.stripe.com/apikeys).
- **Vercel:** Project → Settings → Environment Variables → add **`STRIPE_PUBLISHABLE_KEY`** = your full `pk_live_…` → redeploy. The Vite **`closeBundle`** hook injects it into `dist/ed-geerdes-platform.html`.
- **Netlify:** Site → Environment variables → same name → trigger deploy.
- **Local build:**  
  `set STRIPE_PUBLISHABLE_KEY=pk_live_...` (Windows) or `export STRIPE_PUBLISHABLE_KEY=pk_live_...` then `npm run build` inside `mureka-clone/`.

Checkout still requires a **server** (FastAPI/Edge function) to create **Checkout Sessions** — see [Stripe Checkout](https://stripe.com/docs/checkout).

## 2. Host free: Vercel / Netlify

| Platform   | Config |
|-----------|--------|
| **Vercel** | Import this GitHub repo. Root **`vercel.json`** builds `mureka-clone` → `dist`. Add **`STRIPE_PUBLISHABLE_KEY`**, **`VITE_API_BASE`**, **`VITE_SITE_URL`**. |
| **Netlify** | Use root **`netlify.toml`** (`base = mureka-clone`, `publish = dist`) or mirror those fields in the UI. Same env vars. |

## 3. Domain: `dieter-music.app`

1. Buy the domain from your registrar.
2. **Vercel:** Project → Settings → Domains → add `dieter-music.app` + `www` → follow DNS (usually A/CNAME to Vercel).
3. **Netlify:** Domain management → add custom domain → update DNS at registrar.
4. Set **`VITE_SITE_URL=https://dieter-music.app`** (and Preview if needed) so canonical / OG URLs match.

## 4. GitHub: fork + deploy

1. **Fork** this repository to your GitHub account (button **Fork** on the repo page).
2. Connect **Vercel** or **Netlify** to **your fork** (not upstream, unless you have rights).
3. Deploy **`main`**; turn on **auto-deploy** on push.
4. Optional: copy **`.github/workflows/vercel-production.yml`** and add `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `VERCEL_TOKEN` for CI deploys.

## 5. GitHub integrations (roadmap)

Curated **WAM** table (community plugins, pedalboard, Open Studio DAW, Sequencer Party): **[WAM_ECOSYSTEM.md](./WAM_ECOSYSTEM.md)**.

Planned / optional wiring — not all are embedded in this repo yet:

```
GitHub integrations (roadmap)
├── Open Studio / Sequencer.Party / PedalBoard → see WAM_ECOSYSTEM.md
├── Web Audio Modules org → https://github.com/webaudiomodules
├── TensorFlow.js / Magenta → www.tensorflow.org/js (heavy; prefer server stems when possible)
└── Stripe → stripe.com/docs; publishable key in env; Checkout Session on backend
```

- **WAM hosts:** load SDK + community `plugins.json`; connect to your mixer bus later.
- **MusicVAE / stems:** prefer **server-side** stems (`/api/mix/suno-mureka/render`, Mureka) until you host a model you control.
- **Stripe:** marketplace **Buy** must call your API to create a **Session** with **price_** IDs from Stripe Dashboard.

## Related files

- `mureka-clone/public/ed-geerdes-platform.html` — marketplace UI shell.
- `mureka-clone/vite.config.js` — `injectStripePublishableKey` plugin.
- `vercel.json` — Vercel build/output.
- `netlify.toml` — Netlify build/output.
- `DEPLOY_VERCEL_RAILWAY.md` — API + CORS when UI and FastAPI are split.
