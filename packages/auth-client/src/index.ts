import type { ZodType } from 'zod'
import { z } from 'zod'
import { ApiFailureSchema } from '@super-app/contracts/api'
import type { CurrentUser, LoginRequest, RegisterRequest } from '@super-app/contracts/auth'
import { CurrentUserSchema } from '@super-app/contracts/auth'
import { clientEnv } from '@super-app/env/client'

const ApiSuccessHeaderSchema = z.object({ success: z.literal(true) })

export interface RedirectToLoginOptions {
  returnTo?: string
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    const response = await fetch(`${clientEnv.SUPER_PUBLIC_API_BASE_URL}/auth/me`, {
      credentials: 'include',
    })

    if (response.status === 401) {
      return null
    }

    const payload = await parseApiResponse<CurrentUser>(response, CurrentUserSchema)
    return payload
  } catch {
    // 网络错误或 CORS 失败 → 视为未认证，触发登录跳转
    return null
  }
}

export async function requireAuth(): Promise<CurrentUser> {
  const user = await getCurrentUser()

  if (!user) {
    redirectToLogin()
    throw new Error('Unauthorized')
  }

  return user
}

export async function login(input: LoginRequest): Promise<CurrentUser> {
  return sendAuthRequest<CurrentUser>('/auth/login', input, CurrentUserSchema)
}

export async function register(input: RegisterRequest): Promise<CurrentUser> {
  return sendAuthRequest<CurrentUser>('/auth/register', input, CurrentUserSchema)
}

export async function logout(): Promise<void> {
  await fetch(`${clientEnv.SUPER_PUBLIC_API_BASE_URL}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  })
}

export function redirectToLogin(options: RedirectToLoginOptions = {}): void {
  if (!isBrowser()) {
    return
  }

  try {
    window.location.assign(getLoginUrl(options.returnTo))
  } catch {
    // window.location.assign 极少情况会抛异常（无效 URL 等），
    // 回退到直接设置 href
    window.location.href = getLoginUrl(options.returnTo)
  }
}

export function getLoginUrl(returnTo?: string): string {
  const loginUrl = new URL('login', ensureTrailingSlash(clientEnv.SUPER_PUBLIC_AUTH_APP_URL))
  const safeReturnTo = normalizeReturnTo(returnTo)

  if (safeReturnTo) {
    loginUrl.searchParams.set('return_to', safeReturnTo)
  }

  return loginUrl.toString()
}

async function sendAuthRequest<T>(path: string, body: unknown, dataSchema: ZodType<T>): Promise<T> {
  const response = await fetch(`${clientEnv.SUPER_PUBLIC_API_BASE_URL}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  return parseApiResponse<T>(response, dataSchema)
}

async function parseApiResponse<T>(response: Response, dataSchema: ZodType<T>): Promise<T> {
  const rawPayload = await response.json().catch(() => null)
  const failurePayload = ApiFailureSchema.safeParse(rawPayload)

  if (failurePayload.success) {
    throw new Error(failurePayload.data.error.message)
  }

  const successHeader = ApiSuccessHeaderSchema.safeParse(rawPayload)

  if (!successHeader.success) {
    throw new Error(`Invalid API response: ${response.status}`)
  }

  const successData = dataSchema.safeParse(rawPayload.data)

  if (!successData.success) {
    throw new Error(`Invalid API response: ${response.status}`)
  }

  return successData.data
}

function normalizeReturnTo(returnTo?: string) {
  const fallback = getCurrentBrowserUrl()
  const value = returnTo ?? fallback

  if (!value) {
    return undefined
  }

  if (value.startsWith('/') && !value.startsWith('//')) {
    return value
  }

  try {
    const url = new URL(value)
    const allowedOrigins = getAllowedReturnOrigins()

    if (allowedOrigins.has(url.origin)) {
      const authOrigin = new URL(clientEnv.SUPER_PUBLIC_AUTH_APP_URL).origin

      if (url.origin === authOrigin) {
        return `${url.pathname}${url.search}${url.hash}`
      }

      return url.toString()
    }
  } catch {
    return fallback
  }

  return fallback
}

function getAllowedReturnOrigins() {
  const origins = new Set(
    [
      clientEnv.SUPER_PUBLIC_SITE_URL,
      clientEnv.SUPER_PUBLIC_DOCS_URL,
      clientEnv.SUPER_PUBLIC_AUTH_APP_URL,
      clientEnv.SUPER_PUBLIC_WORKSPACE_APP_URL,
      clientEnv.SUPER_PUBLIC_CANVAS_APP_URL,
      clientEnv.SUPER_PUBLIC_ASSETS_APP_URL,
      clientEnv.SUPER_PUBLIC_TRANSFER_APP_URL,
      clientEnv.SUPER_PUBLIC_CONSOLE_APP_URL,
    ].map((value) => new URL(value).origin)
  )

  // Also allow the current page's origin so that accessing via a LAN IP
  // (e.g. http://192.168.3.147:5103) does not silently drop the return_to.
  if (isBrowser()) {
    origins.add(window.location.origin)
  }

  return origins
}

function getCurrentBrowserUrl() {
  if (!isBrowser()) {
    return undefined
  }

  return window.location.href
}

function ensureTrailingSlash(value: string) {
  return value.endsWith('/') ? value : `${value}/`
}

function isBrowser() {
  return typeof window !== 'undefined'
}
