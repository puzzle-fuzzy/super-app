import mdx from '@astrojs/mdx'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'

export default defineConfig({
  base: '/',
  integrations: [mdx()],
  vite: {
    plugins: [tailwindcss()],
    envDir: '../..',
    envPrefix: 'SUPER_PUBLIC_',
  },
})
