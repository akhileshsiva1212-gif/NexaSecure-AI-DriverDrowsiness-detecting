import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The dashboard runs on 5173 in dev and talks to the edge backend on 8000.
// `/api` is proxied so the frontend code uses same-origin relative URLs. The realtime
// socket lives at `/api/v1/ws`, so the same proxy carries it with `ws: true`.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // expose on the LAN so a phone can reach the dev server
    proxy: {
      '/api': { target: 'http://localhost:8000', changeOrigin: true, ws: true },
    },
  },
})
