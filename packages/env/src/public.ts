import { z } from 'zod'

export const publicEnvSchema = z.object({
  SUPER_PUBLIC_SITE_URL: z.string().url(),
  SUPER_PUBLIC_DOCS_URL: z.string().url(),
  SUPER_PUBLIC_AUTH_APP_URL: z.string().url(),
  SUPER_PUBLIC_WORKSPACE_APP_URL: z.string().url(),
  SUPER_PUBLIC_CANVAS_APP_URL: z.string().url(),
  SUPER_PUBLIC_ASSETS_APP_URL: z.string().url(),
  SUPER_PUBLIC_CONSOLE_APP_URL: z.string().url(),
  SUPER_PUBLIC_ADMIN_APP_URL: z.string().url(),
  SUPER_PUBLIC_API_BASE_URL: z.string().url(),
  SUPER_PUBLIC_STORAGE_BASE_URL: z.string().url(),
})

export type PublicEnv = z.infer<typeof publicEnvSchema>

export function parsePublicEnv(source: Record<string, string | undefined>): PublicEnv {
  return publicEnvSchema.parse(source)
}
