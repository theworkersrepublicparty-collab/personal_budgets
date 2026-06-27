import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The web app runs on 5173 and proxies /api to the local Express server on 3001.
// Everything stays on localhost — nothing leaves your machine.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
