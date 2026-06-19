import path from 'node:path'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  envDir: path.resolve(__dirname, '../..'),
  envPrefix: 'SUPER_PUBLIC_',
  base: '/assets/',
  build: {
    assetsDir: '_assets',
  },
  server: {
    port: 5105,
  },
})
