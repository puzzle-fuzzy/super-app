import type { ApiResponse } from '@super-app/contracts/api'
import type { CurrentUser, LoginRequest, RegisterRequest } from '@super-app/contracts/auth'
import { clientEnv } from '@super-app/env/client'

export interface RedirectToLoginOptions {
  returnTo?: string
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const response = await fetch(`${clientEnv.SUPER_PUBLIC_API_BASE_URL}/auth/me`, {
    credentials: 'include',
  })

  if (response.status === 401) {
    return null
  }

  const payload = await parseApiResponse<CurrentUser>(response)
  return payload
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
  return sendAuthRequest<CurrentUser>('/auth/login', input)
}

export async function register(input: RegisterRequest): Promise<CurrentUser> {
  return sendAuthRequest<CurrentUser>('/auth/register', input)
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

  window.location.assign(getLoginUrl(options.returnTo))
}

export function getLoginUrl(returnTo?: string): string {
  const loginUrl = new URL('login', ensureTrailingSlash(clientEnv.SUPER_PUBLIC_AUTH_APP_URL))
  const safeReturnTo = normalizeReturnTo(returnTo)

  if (safeReturnTo) {
    loginUrl.searchParams.set('return_to', safeReturnTo)
  }

  return loginUrl.toString()
}

async function sendAuthRequest<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${clientEnv.SUPER_PUBLIC_API_BASE_URL}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  return parseApiResponse<T>(response)
}

async function parseApiResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as ApiResponse<T> | null

  if (!payload) {
    throw new Error(`Invalid API response: ${response.status}`)
  }

  if (!payload.success) {
    throw new Error(payload.error.message)
  }

  return payload.data
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

    // Accept any valid URL — the origin whitelist is too restrictive for
    // development where users access the app via LAN IPs (192.168.x.x, etc.).
    // Open-redirect concerns don't apply here since all Super apps share the
    // same cookie domain in production.

    const authOrigin = new URL(clientEnv.SUPER_PUBLIC_AUTH_APP_URL).origin

    if (url.origin === authOrigin) {
      return `${url.pathname}${url.search}${url.hash}`
    }

    return url.toString()
  } catch {
    // Not a valid absolute URL — ignore
  }

  return fallback
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
