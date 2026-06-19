import type { ApiError as ApiErrorPayload, ApiResponse } from '@super-app/contracts/api'
import type { ApiKeyDto, CreateApiKeyResponse } from '@super-app/contracts/api-keys'
import type {
  AssetDto,
  AssetKind,
  AssetListResponse,
  AssetShareLinkDto,
  AssetTransferSessionDto,
} from '@super-app/contracts/assets'
import type {
  CreateSubjectAssetRequest,
  SubjectAssetDetailDto,
  UpdateSubjectAssetRequest,
} from '@super-app/contracts/subject-assets'
import type {
  CreateTextAssetRequest,
  TextAssetDetailDto,
  UpdateTextAssetRequest,
} from '@super-app/contracts/text-assets'
import type {
  CanvasProjectDetailDto,
  CanvasProjectListResponse,
  CreateCanvasProjectRequest,
  UpdateCanvasProjectRequest,
} from '@super-app/contracts/canvas'
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
    headers: mergeHeaders(requestOptions.headers, requestOptions.body),
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

export const assetsApi = {
  upload(file: File) {
    const form = new FormData()
    form.append('file', file)
    return apiFetch<AssetDto>('/assets/upload', {
      method: 'POST',
      body: form,
    })
  },

  list(params?: { kind?: AssetKind; limit?: number; cursor?: string }) {
    const qs = new URLSearchParams()
    if (params?.kind) qs.set('kind', params.kind)
    if (params?.limit) qs.set('limit', String(params.limit))
    if (params?.cursor) qs.set('cursor', params.cursor)
    const query = qs.toString()
    return apiFetch<AssetListResponse>(`/assets/${query ? `?${query}` : ''}`)
  },

  get(id: string) {
    return apiFetch<AssetDto>(`/assets/${id}`)
  },

  remove(id: string) {
    return apiFetch<{ deleted: true }>(`/assets/${id}`, { method: 'DELETE' })
  },

  createShareLink(id: string) {
    return apiFetch<AssetShareLinkDto>(`/assets/${id}/share-link`, { method: 'POST' })
  },

  createTransferSession(id: string) {
    return apiFetch<AssetTransferSessionDto>(`/assets/${id}/transfer-session`, { method: 'POST' })
  },
}

export const textsApi = {
  create(input: CreateTextAssetRequest) {
    return apiFetch<TextAssetDetailDto>('/assets/texts/', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  get(id: string) {
    return apiFetch<TextAssetDetailDto>(`/assets/texts/${id}`)
  },

  update(id: string, input: UpdateTextAssetRequest) {
    return apiFetch<TextAssetDetailDto>(`/assets/texts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    })
  },

  remove(id: string) {
    return apiFetch<{ deleted: true }>(`/assets/texts/${id}`, { method: 'DELETE' })
  },
}

export const subjectsApi = {
  create(input: CreateSubjectAssetRequest) {
    return apiFetch<SubjectAssetDetailDto>('/assets/subjects/', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  get(id: string) {
    return apiFetch<SubjectAssetDetailDto>(`/assets/subjects/${id}`)
  },

  update(id: string, input: UpdateSubjectAssetRequest) {
    return apiFetch<SubjectAssetDetailDto>(`/assets/subjects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    })
  },

  remove(id: string) {
    return apiFetch<{ deleted: true }>(`/assets/subjects/${id}`, { method: 'DELETE' })
  },
}

export const canvasApi = {
  create(input: CreateCanvasProjectRequest) {
    return apiFetch<CanvasProjectDetailDto>('/canvas/projects/', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  list(params?: { limit?: number; cursor?: string }) {
    const qs = new URLSearchParams()
    if (params?.limit) qs.set('limit', String(params.limit))
    if (params?.cursor) qs.set('cursor', params.cursor)
    const query = qs.toString()
    return apiFetch<CanvasProjectListResponse>(`/canvas/projects/${query ? `?${query}` : ''}`)
  },

  get(id: string) {
    return apiFetch<CanvasProjectDetailDto>(`/canvas/projects/${id}`)
  },

  update(id: string, input: UpdateCanvasProjectRequest) {
    return apiFetch<CanvasProjectDetailDto>(`/canvas/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    })
  },

  remove(id: string) {
    return apiFetch<{ deleted: true }>(`/canvas/projects/${id}`, { method: 'DELETE' })
  },
}

export const apiKeysApi = {
  create(name: string) {
    return apiFetch<CreateApiKeyResponse>('/api-keys/', {
      method: 'POST',
      body: JSON.stringify({ name }),
    })
  },

  list() {
    return apiFetch<{ items: ApiKeyDto[] }>('/api-keys/')
  },

  revoke(id: string) {
    return apiFetch<{ deleted: true }>(`/api-keys/${id}`, { method: 'DELETE' })
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

function mergeHeaders(headers: HeadersInit | undefined, body?: BodyInit | null) {
  const base: Record<string, string> = {}
  // For FormData uploads the browser must set the multipart Content-Type with its
  // boundary; do not force application/json in that case.
  if (!(body instanceof FormData)) {
    base['Content-Type'] = 'application/json'
  }
  return {
    ...base,
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
