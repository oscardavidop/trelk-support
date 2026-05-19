import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_API_URL || 'https://localhost:8443'
  const isProd = mode === 'production'

  return {
    plugins: [react(), tailwindcss()],

    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },

    server: {
      allowedHosts: ['trelk.site', 'api.trelk.site', 'support.trelkbot.com'],
      port: 5175,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
        },
        '/socket.io': {
          target: apiTarget,
          ws: true,
          changeOrigin: true,
          secure: false,
        },
        '/webchat-socket': {
          target: apiTarget,
          ws: true,
          changeOrigin: true,
          secure: false,
        },
      },
    },

    build: {
      minify: 'esbuild',
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return
            if (id.includes('react-dom') || id.includes('react-router')) return 'vendor-react'
            if (id.includes('reactflow') || id.includes('@reactflow')) return 'vendor-flow'
            if (id.includes('socket.io')) return 'vendor-socket'
            if (id.includes('recharts')) return 'vendor-charts'
            if (id.includes('lucide')) return 'vendor-icons'
            return 'vendor'
          },
        },
      },
    },

    esbuild: {
      // Strip console.* and debugger in production builds
      drop: isProd ? ['console', 'debugger'] : [],
    },
  }
})
