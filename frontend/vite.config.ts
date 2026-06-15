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
  // Light IP hardening of the shipped bundle (see LICENSE). Note: client code can
  // never be made truly secret — this only raises the cost of copying.
  build: {
    sourcemap: false, // never ship source maps to the browser
    minify: 'esbuild', // minify + strip comments (Vite default, made explicit)
  },
  esbuild: {
    legalComments: 'none', // drop license/banner comments from the production bundle
  },
})
