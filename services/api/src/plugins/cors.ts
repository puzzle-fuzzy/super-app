import { cors } from '@elysia/cors'
import { serverEnv } from '@super-app/env/server'
import { Elysia } from 'elysia'

const allowedOrigins = [
  serverEnv.SUPER_PUBLIC_SITE_URL,
  serverEnv.SUPER_PUBLIC_DOCS_URL,
  serverEnv.SUPER_PUBLIC_AUTH_APP_URL,
  serverEnv.SUPER_PUBLIC_WORKSPACE_APP_URL,
  serverEnv.SUPER_PUBLIC_CANVAS_APP_URL,
  serverEnv.SUPER_PUBLIC_ASSETS_APP_URL,
  serverEnv.SUPER_PUBLIC_TRANSFER_APP_URL,
  serverEnv.SUPER_PUBLIC_CONSOLE_APP_URL,
].map((value) => new URL(value).origin)

export const corsPlugin = new Elysia({ name: 'cors' }).use(
  cors({
    credentials: true,
    origin: allowedOrigins,
  })
)
