import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 4911,
    proxy: {
      '/api': {
        target: 'http://localhost:4912',
        changeOrigin: true,
      },
      '/mcp': {
        target: 'http://localhost:4912',
        changeOrigin: true,
      },
    },
  },
})
