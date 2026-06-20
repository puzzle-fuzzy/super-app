import { z } from 'zod'

import { publicEnvSchema } from './public'

const booleanString = z.enum(['true', 'false']).transform((value) => value === 'true')

const numberString = z.coerce.number().int().positive()

export const serverEnvSchema = publicEnvSchema.extend({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_ENV: z.string().default('local'),

  SITE_URL: z.string().url(),
  DOCS_URL: z.string().url(),
  AUTH_APP_URL: z.string().url(),
  WORKSPACE_APP_URL: z.string().url(),
  CANVAS_APP_URL: z.string().url(),
  ASSETS_APP_URL: z.string().url(),
  TRANSFER_APP_URL: z.string().url(),
  CONSOLE_APP_URL: z.string().url(),
  API_BASE_URL: z.string().url(),
  API_PORT: numberString.default(5200),

  COOKIE_SECURE: booleanString.default('false'),
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  SESSION_COOKIE_NAME: z.string().min(1),
  SESSION_SECRET: z.string().min(16),
  SESSION_TTL_SECONDS: numberString,

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().optional(),

  STORAGE_DRIVER: z.enum(['local', 'oss']).default('local'),
  STORAGE_DIR: z.string().min(1).default('./storage'),
  OSS_ENDPOINT: z.string().url().optional(),
  OSS_REGION: z.string().min(1).optional(),
  OSS_ACCESS_KEY_ID: z.string().min(1).optional(),
  OSS_ACCESS_KEY_SECRET: z.string().min(1).optional(),
  OSS_BUCKET: z.string().min(1).optional(),
  OSS_PREFIX: z.string().optional(),

  ASSETS_MAX_UPLOAD_SIZE_MB: numberString,
  ASSETS_ALLOWED_MIME_TYPES: z.string().min(1),

  TRANSFER_ROOM_TTL_SECONDS: numberString,
  SIGNALING_PORT: numberString,
  WORKER_CONCURRENCY: numberString,

  API_KEY_PREFIX: z.string().min(1),
  API_DEFAULT_RATE_LIMIT_PER_MINUTE: numberString,

  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GLM_API_KEY: z.string().optional(),
  DASHSCOPE_API_KEY: z.string().optional(),
  DASHSCOPE_BASE_URL: z.string().url().optional(),

  FEATURE_SIGNUP_ENABLED: booleanString.default('true'),
  FEATURE_OAUTH_ENABLED: booleanString.default('false'),
  FEATURE_ASSET_UPLOAD_ENABLED: booleanString.default('true'),
  FEATURE_CANVAS_ENABLED: booleanString.default('true'),
  FEATURE_TRANSFER_ENABLED: booleanString.default('false'),
  FEATURE_API_CONSOLE_ENABLED: booleanString.default('false'),

  ADMIN_USER_IDS: z.string().optional(),
}).superRefine((env, ctx) => {
  if (env.STORAGE_DRIVER !== 'oss') {
    return
  }

  const requiredOssKeys = [
    'OSS_REGION',
    'OSS_ACCESS_KEY_ID',
    'OSS_ACCESS_KEY_SECRET',
    'OSS_BUCKET',
  ] as const

  for (const key of requiredOssKeys) {
    if (!env[key]) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message: `${key} is required when STORAGE_DRIVER=oss`,
      })
    }
  }
})

export type ServerEnv = z.infer<typeof serverEnvSchema>

type GlobalWithRuntimeEnv = typeof globalThis & {
  Bun?: { env?: Record<string, string | undefined> }
  process?: { env?: Record<string, string | undefined> }
}

const runtime = globalThis as GlobalWithRuntimeEnv
const envSource = {
  ...runtime.process?.env,
  ...runtime.Bun?.env,
}

export const serverEnv = serverEnvSchema.parse(envSource)
