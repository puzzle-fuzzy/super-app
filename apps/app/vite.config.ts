import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const appDir = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss()],
  envDir: path.resolve(appDir, '../..'),
  envPrefix: 'SUPER_PUBLIC_',
  // dev: 直接从 / 提供资源；prod: 构建到 /app/_assets/，由 nginx 路由
  base: command === 'serve' ? '/' : '/app/',
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
}))
