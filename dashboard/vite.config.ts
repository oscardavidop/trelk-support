import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    allowedHosts: ['trelk.site', 's.trelk.site'],
    port: 5173,
    proxy: {
      '/api': {
        target: 'https://localhost:8443',
        changeOrigin: true,
        secure: false,
      },
      '/uploads': {
        target: 'https://localhost:8443',
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: 'https://localhost:8443',
        ws: true,
        changeOrigin: true,
        secure: false,
      },
      '/webchat-socket': {
        target: 'https://localhost:8443',
        ws: true,
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
