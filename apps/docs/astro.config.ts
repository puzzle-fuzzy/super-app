import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'

export default defineConfig({
  base: '/docs/',
  vite: {
    plugins: [tailwindcss()],
  },
})
