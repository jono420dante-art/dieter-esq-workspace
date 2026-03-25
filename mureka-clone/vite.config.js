import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
