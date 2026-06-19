import base from './base.mjs'

export default [
  ...base,
  {
    languageOptions: {
      globals: {
        Bun: 'readonly',
        console: 'readonly',
      },
    },
  },
]
