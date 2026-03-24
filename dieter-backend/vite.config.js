import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        // Match `uvicorn app.main:app --port 8000` in dieter-backend. Override: set env API_PROXY_TARGET.
        target: process.env.API_PROXY_TARGET || 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/trpc': {
        target: 'http://127.0.0.1:8790',
        changeOrigin: true,
      },
    },
  },
})
