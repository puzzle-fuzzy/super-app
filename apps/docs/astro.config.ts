import mdx from '@astrojs/mdx'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'

export default defineConfig({
  base: '/docs/',
  integrations: [mdx()],
  vite: {
    plugins: [tailwindcss()],
  },
})
