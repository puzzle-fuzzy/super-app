import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const appDir = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  plugins: [react(), tailwindcss()],
  envDir: path.resolve(appDir, '../..'),
  envPrefix: 'SUPER_PUBLIC_',
  base: '/app/',
  build: {
    assetsDir: '_assets',
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-xyflow': ['@xyflow/react'],
          'vendor-router': ['react-router-dom'],
          'vendor-zustand': ['zustand'],
        },
      },
    },
  },
  resolve: {
    alias: {
      '@app/workspace': path.resolve(appDir, '../workspace/src'),
      '@app/assets': path.resolve(appDir, '../assets/src'),
      '@app/canvas': path.resolve(appDir, '../canvas/src'),
      '@app/console': path.resolve(appDir, '../console/src'),
    },
  },
  server: {
    port: 5100,
    proxy: {
      '/api': {
        target: 'http://localhost:5200',
        changeOrigin: true,
      },
    },
  },
})
