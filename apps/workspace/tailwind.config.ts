import type { Config } from 'tailwindcss'

import { preset } from '@super-app/tailwind-config'

export default {
  presets: [preset],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
} satisfies Config
