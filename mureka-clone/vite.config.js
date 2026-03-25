import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * After `public/ed-geerdes-platform.html` is copied to `dist/`, inject Stripe **publishable** key
 * from env (never commit secret keys). Vercel / Netlify: set `STRIPE_PUBLISHABLE_KEY` = `pk_live_…`
 */
function injectStripePublishableKey() {
  return {
    name: 'inject-stripe-publishable-key',
    closeBundle() {
      const pk =
        process.env.STRIPE_PUBLISHABLE_KEY?.trim() ||
        process.env.VITE_STRIPE_PUBLISHABLE_KEY?.trim() ||
        ''
      const file = path.join(__dirname, 'dist', 'ed-geerdes-platform.html')
      if (!fs.existsSync(file)) return
      let html = fs.readFileSync(file, 'utf8')
      const safe = pk.replace(/"/g, '').replace(/</g, '')
      const value =
        safe ||
        'pk_live_YOUR_FULL_PUBLISHABLE_KEY_SET_STRIPE_PUBLISHABLE_KEY_IN_HOSTING'
      html = html.replace(/data-stripe-pk="[^"]*"/, `data-stripe-pk="${value}"`)
      fs.writeFileSync(file, html)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), injectStripePublishableKey()],
  server: {
    proxy: {
      '/api': {
        // Default matches common dev: `uvicorn app.main:app --reload --port 8787` in dieter-backend.
        // Override: `set API_PROXY_TARGET=http://127.0.0.1:8000` then `npm run dev` (Windows cmd).
        target: process.env.API_PROXY_TARGET || 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
      '/trpc': {
        target: 'http://127.0.0.1:8790',
        changeOrigin: true,
      },
    },
  },
})
