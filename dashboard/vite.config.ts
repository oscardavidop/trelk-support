import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { visualizer } from "rollup-plugin-visualizer";
// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), visualizer({ open: true })],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    allowedHosts: ['trelk.site', 'api.trelk.site'],
    port: 5173,
    proxy: {
      // '/api': {
      //   target: 'https://api.trelk.site', // <-- Tu nuevo dominio para el backend
      //   changeOrigin: true,
      //   secure: false, // Ponlo en true si el certificado SSL de tu API es estricto/válido
        
      //   // ATENCIÓN A ESTA LÍNEA:
      //   // Si tu nuevo backend espera rutas como "api.trelk.site/users" (sin la palabra /api),
      //   // descomenta la siguiente línea para que Vite la borre antes de enviar la petición:
        
      //   // rewrite: (path) => path.replace(/^\/api/, '') 
      // },
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
  build: {
    rollupOptions: {
      // output: {
      //   manualChunks(id) {
      //     if (id.includes('node_modules')) {
      //       // Separa las librerías grandes en sus propios archivos
      //       if (id.includes('react')) return 'vendor-react';
      //       if (id.includes('lucide')) return 'vendor-icons';
      //       if (id.includes('chart.js')) return 'vendor-charts';
      //       return 'vendor-others'; // El resto de librerías
      //     }
      //   },
      // },
    },
  }
})
