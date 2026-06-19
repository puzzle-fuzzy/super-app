import { defineConfig } from 'drizzle-kit'

import { serverEnv } from '@super-app/env/server'

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: serverEnv.DATABASE_URL,
  },
  strict: true,
  verbose: true,
})
