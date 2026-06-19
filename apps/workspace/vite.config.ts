import path from 'node:path'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  envDir: path.resolve(__dirname, '../..'),
  envPrefix: 'SUPER_PUBLIC_',
  base: '/workspace/',
  build: {
    assetsDir: '_assets',
  },
  server: {
    port: 5103,
  },
})
