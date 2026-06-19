import type { ApiError as ApiErrorPayload, ApiResponse } from '@super-app/contracts/api'
import type { CurrentUser, LoginRequest, RegisterRequest } from '@super-app/contracts/auth'
import { redirectToLogin } from '@super-app/auth-client'
import { clientEnv } from '@super-app/env/client'

export interface ApiFetchOptions extends RequestInit {
  redirectOnUnauthorized?: boolean
}

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly payload: ApiErrorPayload
  ) {
    super(payload.message)
    this.name = 'ApiClientError'
  }
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { redirectOnUnauthorized = true, ...requestOptions } = options
  const response = await fetch(`${clientEnv.SUPER_PUBLIC_API_BASE_URL}${path}`, {
    ...requestOptions,
    credentials: 'include',
    headers: mergeHeaders(requestOptions.headers),
  })

  const payload = await parseApiResponse<T>(response)

  if (!payload.success) {
    if (response.status === 401 && redirectOnUnauthorized) {
      redirectToLogin()
    }

    throw new ApiClientError(response.status, payload.error)
  }

  return payload.data
}

export const authApi = {
  me() {
    return apiFetch<CurrentUser>('/auth/me', {
      redirectOnUnauthorized: false,
    })
  },

  login(input: LoginRequest) {
    return apiFetch<CurrentUser>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  register(input: RegisterRequest) {
    return apiFetch<CurrentUser>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  async logout() {
    await apiFetch<{ loggedOut: true }>('/auth/logout', {
      method: 'POST',
      redirectOnUnauthorized: false,
    })
  },
}

async function parseApiResponse<T>(response: Response): Promise<ApiResponse<T>> {
  const payload = (await response.json().catch(() => null)) as ApiResponse<T> | null

  if (payload) {
    return payload
  }

  return {
    success: false,
    error: {
      code: response.status === 401 ? 'UNAUTHORIZED' : 'INTERNAL_ERROR',
      message: `Invalid API response: ${response.status}`,
    },
  }
}

function mergeHeaders(headers: HeadersInit | undefined) {
  return {
    'Content-Type': 'application/json',
    ...headersToObject(headers),
  }
}

function headersToObject(headers: HeadersInit | undefined): Record<string, string> {
  if (!headers) {
    return {}
  }

  if (headers instanceof Headers) {
    return Object.fromEntries(headers.entries())
  }

  if (Array.isArray(headers)) {
    return Object.fromEntries(headers)
  }

  return headers
}
