import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

// In Docker the backend is reachable as http://backend:8000; when running
// `npm run dev` directly on the host it defaults to localhost.
const apiTarget = process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:8000'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    // Same-origin API calls: the browser talks only to Vite, which forwards
    // /api to FastAPI. Session cookies therefore work without CORS.
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
      // Uploaded images (served by FastAPI from the media volume).
      '/media': { target: apiTarget, changeOrigin: true },
    },
    // Bind-mounted source in Docker on macOS can miss file events; poll there.
    watch: process.env.VITE_USE_POLLING === '1' ? { usePolling: true, interval: 300 } : undefined,
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.spec.ts'],
    setupFiles: ['src/test/setup.ts'],
  },
})
