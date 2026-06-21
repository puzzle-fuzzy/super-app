import { defineConfig, devices } from '@playwright/test'

const loadLocalEnv = 'set -a; . ./.env.example; set +a;'

const isCI = !!process.env.CI

const localEnv = {
  ...(isCI ? {} : { DATABASE_URL: 'postgres://postgres:postgres@localhost:5432/super' }),
  NODE_ENV: 'development',
  APP_ENV: 'local',
  SUPER_PUBLIC_SITE_URL: 'http://localhost:5102',
  SUPER_PUBLIC_DOCS_URL: 'http://localhost:5102/docs/',
  SUPER_PUBLIC_AUTH_APP_URL: 'http://localhost:5173/auth/',
  SUPER_PUBLIC_WORKSPACE_APP_URL: 'http://localhost:5173/workspace/',
  SUPER_PUBLIC_CANVAS_APP_URL: 'http://localhost:5173/canvas/',
  SUPER_PUBLIC_ASSETS_APP_URL: 'http://localhost:5173/assets/',
  SUPER_PUBLIC_CONSOLE_APP_URL: 'http://localhost:5173/api-console/',
  SUPER_PUBLIC_API_BASE_URL: 'http://localhost:5200/api',
  SUPER_PUBLIC_STORAGE_BASE_URL: 'http://localhost:5200/storage',
  SITE_URL: 'http://localhost:5102',
  DOCS_URL: 'http://localhost:5102/docs/',
  AUTH_APP_URL: 'http://localhost:5173/auth/',
  WORKSPACE_APP_URL: 'http://localhost:5173/workspace/',
  CANVAS_APP_URL: 'http://localhost:5173/canvas/',
  ASSETS_APP_URL: 'http://localhost:5173/assets/',
  TRANSFER_APP_URL: 'http://localhost:5173/transfer/',
  CONSOLE_APP_URL: 'http://localhost:5173/api-console/',
  API_BASE_URL: 'http://localhost:5200/api',
  API_PORT: '5200',
  COOKIE_SECURE: 'false',
  COOKIE_SAME_SITE: 'lax',
  SESSION_COOKIE_NAME: 'super.sid',
  SESSION_SECRET: 'change-me-change-me',
  SESSION_TTL_SECONDS: '604800',
  REDIS_URL: 'redis://localhost:6379',
  S3_ENDPOINT: 'http://localhost:9000',
  S3_REGION: 'auto',
  S3_ACCESS_KEY_ID: 'minioadmin',
  S3_SECRET_ACCESS_KEY: 'minioadmin',
  S3_BUCKET: 'super-assets',
  S3_FORCE_PATH_STYLE: 'true',
  ASSETS_MAX_UPLOAD_SIZE_MB: '100',
  ASSETS_ALLOWED_MIME_TYPES:
    'image/png,image/jpeg,image/webp,video/mp4,audio/mpeg,text/plain,application/pdf',
  TRANSFER_ROOM_TTL_SECONDS: '3600',
  SIGNALING_PORT: '5201',
  WORKER_CONCURRENCY: '2',
  API_KEY_PREFIX: 'sk_super',
  API_DEFAULT_RATE_LIMIT_PER_MINUTE: '60',
  OPENAI_API_KEY: '',
  ANTHROPIC_API_KEY: '',
  GLM_API_KEY: '',
  FEATURE_SIGNUP_ENABLED: 'true',
  FEATURE_OAUTH_ENABLED: 'false',
  FEATURE_ASSET_UPLOAD_ENABLED: 'true',
  FEATURE_CANVAS_ENABLED: 'true',
  FEATURE_TRANSFER_ENABLED: 'false',
  FEATURE_API_CONSOLE_ENABLED: 'false',
}

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: isCI
        ? `cd packages/db && bun run db:migrate && cd ../../services/api && bun run dev`
        : `${loadLocalEnv} pnpm db:local:up && ${loadLocalEnv} pnpm db:migrate && ${loadLocalEnv} pnpm --filter @super-app/api dev`,
      env: localEnv,
      url: 'http://localhost:5200/api/health',
      reuseExistingServer: !isCI,
      timeout: 120_000,
    },
    {
      command: isCI
        ? `cd apps/app && bun run dev`
        : `${loadLocalEnv} pnpm --filter @super-app/app dev`,
      env: localEnv,
      url: 'http://localhost:5173/',
      reuseExistingServer: !isCI,
      timeout: 60_000,
    },
    {
      command: isCI
        ? `cd apps/docs && bun run dev`
        : `${loadLocalEnv} pnpm --filter @super-app/docs dev`,
      env: localEnv,
      url: 'http://localhost:5102/',
      reuseExistingServer: !isCI,
      timeout: 60_000,
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
