import { serverEnv } from '@super-app/env/server'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import * as schema from './schema'

export const sql = postgres(serverEnv.DATABASE_URL, {
  max: 10,
})

export const db = drizzle(sql, { schema })

export type Db = typeof db
