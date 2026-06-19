import { z } from 'zod'

export const CurrentUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().optional(),
  avatarUrl: z.string().url().optional(),
  roles: z.array(z.string()),
})

export type CurrentUser = z.infer<typeof CurrentUserSchema>

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  returnTo: z.string().optional(),
})

export type LoginRequest = z.infer<typeof LoginRequestSchema>

export const RegisterRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).optional(),
  returnTo: z.string().optional(),
})

export type RegisterRequest = z.infer<typeof RegisterRequestSchema>
