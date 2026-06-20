import { z, type ZodType } from 'zod'
import type { ApiError as ApiErrorPayload, ApiResponse } from '@super-app/contracts/api'
import { ApiFailureSchema } from '@super-app/contracts/api'
import { ApiKeyDtoSchema, CreateApiKeyDataSchema, type ApiKeyDto, type CreateApiKeyData } from '@super-app/contracts/api-keys'
import type {
  AssetDto,
  AssetKind,
  AssetListData,
  AssetShareLinkDto,
  AssetTransferSessionDto,
} from '@super-app/contracts/assets'
import {
  AssetDtoSchema,
  AssetListDataSchema,
  AssetShareLinkDtoSchema,
  AssetTransferSessionDtoSchema,
} from '@super-app/contracts/assets'
import type {
  CreateSubjectAssetRequest,
  SubjectAssetDetailDto,
  UpdateSubjectAssetRequest,
} from '@super-app/contracts/subject-assets'
import { SubjectAssetDetailDtoSchema } from '@super-app/contracts/subject-assets'
import type {
  CreateTemplateAssetRequest,
  TemplateAssetDetailDto,
  UpdateTemplateAssetRequest,
} from '@super-app/contracts/template-assets'
import { TemplateAssetDetailDtoSchema } from '@super-app/contracts/template-assets'
import type {
  CreateStyleAssetRequest,
  StyleAssetDetailDto,
  UpdateStyleAssetRequest,
} from '@super-app/contracts/style-assets'
import { StyleAssetDetailDtoSchema } from '@super-app/contracts/style-assets'
import type {
  CreateTextAssetRequest,
  TextAssetDetailDto,
  UpdateTextAssetRequest,
} from '@super-app/contracts/text-assets'
import { TextAssetDetailDtoSchema } from '@super-app/contracts/text-assets'
import type {
  CanvasGenerateImageRequest,
  CanvasGenerateImageData,
  CanvasProjectDetailDto,
  CanvasProjectListData,
  CreateCanvasProjectRequest,
  UpdateCanvasProjectRequest,
} from '@super-app/contracts/canvas'
import {
  CanvasGenerateImageDataSchema,
  CanvasProjectDetailDtoSchema,
  CanvasProjectListDataSchema,
} from '@super-app/contracts/canvas'
import type { CurrentUser, LoginRequest, RegisterRequest } from '@super-app/contracts/auth'
import { CurrentUserSchema } from '@super-app/contracts/auth'
import type {
  PipelineCancelData,
  PipelineCharacterDto,
  PipelineLocationDto,
  PipelineProjectDto,
  PipelineProjectListData,
  PipelineProjectSummary,
  PipelineRunDto,
  PipelineShotDto,
  PipelineTriggerPhaseData,
} from '@super-app/contracts/pipeline'
import {
  PipelineCancelDataSchema,
  PipelineCharacterDtoSchema,
  PipelineLocationDtoSchema,
  PipelineProjectDtoSchema,
  PipelineProjectListDataSchema,
  PipelineProjectSummarySchema,
  PipelineRunDtoSchema,
  PipelineShotDtoSchema,
  PipelineTriggerPhaseDataSchema,
} from '@super-app/contracts/pipeline'
import { redirectToLogin } from '@super-app/auth-client'
import { clientEnv } from '@super-app/env/client'

export { SSEClient } from './sse-client'
export type { TaskStatusEvent } from './sse-client'
export type { PipelineProjectSummary } from '@super-app/contracts/pipeline'

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

const DeletedDataSchema = z.object({ deleted: z.literal(true) })
const LoggedOutDataSchema = z.object({ loggedOut: z.literal(true) })
const MessageDataSchema = z.object({ message: z.string() })
const ApiKeyListDataSchema = z.object({ items: z.array(ApiKeyDtoSchema) })
const ApiSuccessHeaderSchema = z.object({ success: z.literal(true) })
const PipelineRetryDataSchema = z.union([PipelineTriggerPhaseDataSchema, z.null()])

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
  dataSchema: ZodType<T>
): Promise<T> {
  const { redirectOnUnauthorized = true, ...requestOptions } = options
  const response = await fetch(`${clientEnv.SUPER_PUBLIC_API_BASE_URL}${path}`, {
    ...requestOptions,
    credentials: 'include',
    headers: mergeHeaders(requestOptions.headers, requestOptions.body),
  })

  const payload = await parseApiResponse<T>(response, dataSchema)

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
    }, CurrentUserSchema)
  },

  login(input: LoginRequest) {
    return apiFetch<CurrentUser>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    }, CurrentUserSchema)
  },

  register(input: RegisterRequest) {
    return apiFetch<CurrentUser>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    }, CurrentUserSchema)
  },

  async logout() {
    await apiFetch<{ loggedOut: true }>('/auth/logout', {
      method: 'POST',
      redirectOnUnauthorized: false,
    }, LoggedOutDataSchema)
  },
}

export const assetsApi = {
  upload(file: File) {
    const form = new FormData()
    form.append('file', file)
    return apiFetch<AssetDto>('/assets/upload', {
      method: 'POST',
      body: form,
    }, AssetDtoSchema)
  },

  list(params?: { kind?: AssetKind; limit?: number; cursor?: string }) {
    const qs = new URLSearchParams()
    if (params?.kind) qs.set('kind', params.kind)
    if (params?.limit) qs.set('limit', String(params.limit))
    if (params?.cursor) qs.set('cursor', params.cursor)
    const query = qs.toString()
    return apiFetch<AssetListData>(`/assets/${query ? `?${query}` : ''}`, {}, AssetListDataSchema)
  },

  get(id: string) {
    return apiFetch<AssetDto>(`/assets/${id}`, {}, AssetDtoSchema)
  },

  remove(id: string) {
    return apiFetch<{ deleted: true }>(`/assets/${id}`, { method: 'DELETE' }, DeletedDataSchema)
  },

  createShareLink(id: string) {
    return apiFetch<AssetShareLinkDto>(`/assets/${id}/share-link`, { method: 'POST' }, AssetShareLinkDtoSchema)
  },

  createTransferSession(id: string) {
    return apiFetch<AssetTransferSessionDto>(
      `/assets/${id}/transfer-session`,
      { method: 'POST' },
      AssetTransferSessionDtoSchema
    )
  },
}

export const textsApi = {
  create(input: CreateTextAssetRequest) {
    return apiFetch<TextAssetDetailDto>('/assets/texts/', {
      method: 'POST',
      body: JSON.stringify(input),
    }, TextAssetDetailDtoSchema)
  },

  get(id: string) {
    return apiFetch<TextAssetDetailDto>(`/assets/texts/${id}`, {}, TextAssetDetailDtoSchema)
  },

  update(id: string, input: UpdateTextAssetRequest) {
    return apiFetch<TextAssetDetailDto>(`/assets/texts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }, TextAssetDetailDtoSchema)
  },

  remove(id: string) {
    return apiFetch<{ deleted: true }>(`/assets/texts/${id}`, { method: 'DELETE' }, DeletedDataSchema)
  },
}

export const subjectsApi = {
  create(input: CreateSubjectAssetRequest) {
    return apiFetch<SubjectAssetDetailDto>('/assets/subjects/', {
      method: 'POST',
      body: JSON.stringify(input),
    }, SubjectAssetDetailDtoSchema)
  },

  get(id: string) {
    return apiFetch<SubjectAssetDetailDto>(`/assets/subjects/${id}`, {}, SubjectAssetDetailDtoSchema)
  },

  update(id: string, input: UpdateSubjectAssetRequest) {
    return apiFetch<SubjectAssetDetailDto>(`/assets/subjects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }, SubjectAssetDetailDtoSchema)
  },

  remove(id: string) {
    return apiFetch<{ deleted: true }>(`/assets/subjects/${id}`, { method: 'DELETE' }, DeletedDataSchema)
  },
}

export const stylesApi = {
  create(input: CreateStyleAssetRequest) {
    return apiFetch<StyleAssetDetailDto>('/assets/styles/', {
      method: 'POST',
      body: JSON.stringify(input),
    }, StyleAssetDetailDtoSchema)
  },

  get(id: string) {
    return apiFetch<StyleAssetDetailDto>(`/assets/styles/${id}`, {}, StyleAssetDetailDtoSchema)
  },

  update(id: string, input: UpdateStyleAssetRequest) {
    return apiFetch<StyleAssetDetailDto>(`/assets/styles/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }, StyleAssetDetailDtoSchema)
  },

  remove(id: string) {
    return apiFetch<{ deleted: true }>(`/assets/styles/${id}`, { method: 'DELETE' }, DeletedDataSchema)
  },
}

export const templatesApi = {
  create(input: CreateTemplateAssetRequest) {
    return apiFetch<TemplateAssetDetailDto>('/assets/templates/', {
      method: 'POST',
      body: JSON.stringify(input),
    }, TemplateAssetDetailDtoSchema)
  },

  get(id: string) {
    return apiFetch<TemplateAssetDetailDto>(`/assets/templates/${id}`, {}, TemplateAssetDetailDtoSchema)
  },

  update(id: string, input: UpdateTemplateAssetRequest) {
    return apiFetch<TemplateAssetDetailDto>(`/assets/templates/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }, TemplateAssetDetailDtoSchema)
  },

  remove(id: string) {
    return apiFetch<{ deleted: true }>(`/assets/templates/${id}`, { method: 'DELETE' }, DeletedDataSchema)
  },
}

export const canvasApi = {
  generateImage(input: CanvasGenerateImageRequest) {
    return apiFetch<CanvasGenerateImageData>('/canvas/generate-image', {
      method: 'POST',
      body: JSON.stringify(input),
    }, CanvasGenerateImageDataSchema)
  },

  create(input: CreateCanvasProjectRequest) {
    return apiFetch<CanvasProjectDetailDto>('/canvas/projects/', {
      method: 'POST',
      body: JSON.stringify(input),
    }, CanvasProjectDetailDtoSchema)
  },

  list(params?: { limit?: number; cursor?: string }) {
    const qs = new URLSearchParams()
    if (params?.limit) qs.set('limit', String(params.limit))
    if (params?.cursor) qs.set('cursor', params.cursor)
    const query = qs.toString()
    return apiFetch<CanvasProjectListData>(
      `/canvas/projects/${query ? `?${query}` : ''}`,
      {},
      CanvasProjectListDataSchema
    )
  },

  get(id: string) {
    return apiFetch<CanvasProjectDetailDto>(`/canvas/projects/${id}`, {}, CanvasProjectDetailDtoSchema)
  },

  update(id: string, input: UpdateCanvasProjectRequest) {
    return apiFetch<CanvasProjectDetailDto>(`/canvas/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }, CanvasProjectDetailDtoSchema)
  },

  remove(id: string) {
    return apiFetch<{ deleted: true }>(`/canvas/projects/${id}`, { method: 'DELETE' }, DeletedDataSchema)
  },
}

// ── Pipeline API ───────────────────────────────────────────────

export type PipelineProjectListResponse = PipelineProjectListData
export type TriggerPhaseResult = PipelineTriggerPhaseData
export type PipelineRunDTO = PipelineRunDto
export type CancelPipelineResult = PipelineCancelData

export const pipelineApi = {
  // Project CRUD
  list(params?: { search?: string; status?: string; limit?: number; offset?: number }) {
    const qs = new URLSearchParams()
    if (params?.search) qs.set('search', params.search)
    if (params?.status) qs.set('status', params.status)
    if (params?.limit) qs.set('limit', String(params.limit))
    if (params?.offset) qs.set('offset', String(params.offset))
    const query = qs.toString()
    return apiFetch<PipelineProjectListResponse>(
      `/pipeline/projects${query ? `?${query}` : ''}`,
      {},
      PipelineProjectListDataSchema
    )
  },

  create(input: { name: string; storyText: string }) {
    return apiFetch<PipelineProjectSummary>('/pipeline/projects', {
      method: 'POST',
      body: JSON.stringify(input),
    }, PipelineProjectSummarySchema)
  },

  get(id: string) {
    return apiFetch<PipelineProjectDto>(`/pipeline/projects/${id}`, {}, PipelineProjectDtoSchema)
  },

  delete(id: string) {
    return apiFetch<{ message: string }>(`/pipeline/projects/${id}`, { method: 'DELETE' }, MessageDataSchema)
  },

  update(id: string, input: { title?: string; storyText?: string }) {
    return apiFetch<PipelineProjectSummary>(`/pipeline/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }, PipelineProjectSummarySchema)
  },

  // Phase triggers — 每个阶段一个 POST
  analyze(id: string) {
    return apiFetch<TriggerPhaseResult>(
      `/pipeline/projects/${id}/analyze`,
      { method: 'POST' },
      PipelineTriggerPhaseDataSchema
    )
  },
  characters(id: string) {
    return apiFetch<TriggerPhaseResult>(
      `/pipeline/projects/${id}/characters`,
      { method: 'POST' },
      PipelineTriggerPhaseDataSchema
    )
  },
  locations(id: string) {
    return apiFetch<TriggerPhaseResult>(
      `/pipeline/projects/${id}/locations`,
      { method: 'POST' },
      PipelineTriggerPhaseDataSchema
    )
  },
  characterRefs(id: string) {
    return apiFetch<TriggerPhaseResult>(
      `/pipeline/projects/${id}/character-refs`,
      { method: 'POST' },
      PipelineTriggerPhaseDataSchema
    )
  },
  locationRefs(id: string) {
    return apiFetch<TriggerPhaseResult>(
      `/pipeline/projects/${id}/location-refs`,
      { method: 'POST' },
      PipelineTriggerPhaseDataSchema
    )
  },
  storyboard(id: string) {
    return apiFetch<TriggerPhaseResult>(
      `/pipeline/projects/${id}/storyboard`,
      { method: 'POST' },
      PipelineTriggerPhaseDataSchema
    )
  },
  continuity(id: string) {
    return apiFetch<TriggerPhaseResult>(
      `/pipeline/projects/${id}/continuity`,
      { method: 'POST' },
      PipelineTriggerPhaseDataSchema
    )
  },
  rebuild(id: string) {
    return apiFetch<TriggerPhaseResult>(
      `/pipeline/projects/${id}/rebuild`,
      { method: 'POST' },
      PipelineTriggerPhaseDataSchema
    )
  },
  dialogue(id: string) {
    return apiFetch<TriggerPhaseResult>(
      `/pipeline/projects/${id}/dialogue`,
      { method: 'POST' },
      PipelineTriggerPhaseDataSchema
    )
  },
  videos(id: string) {
    return apiFetch<TriggerPhaseResult>(
      `/pipeline/projects/${id}/videos`,
      { method: 'POST' },
      PipelineTriggerPhaseDataSchema
    )
  },
  bgm(id: string) {
    return apiFetch<TriggerPhaseResult>(
      `/pipeline/projects/${id}/bgm`,
      { method: 'POST' },
      PipelineTriggerPhaseDataSchema
    )
  },
  assemble(id: string) {
    return apiFetch<TriggerPhaseResult>(
      `/pipeline/projects/${id}/assemble`,
      { method: 'POST' },
      PipelineTriggerPhaseDataSchema
    )
  },

  // Control
  cancel(id: string) {
    return apiFetch<CancelPipelineResult>(
      `/pipeline/projects/${id}/cancel`,
      { method: 'POST' },
      PipelineCancelDataSchema
    )
  },
  retry(id: string) {
    return apiFetch<TriggerPhaseResult | null>(
      `/pipeline/projects/${id}/retry`,
      { method: 'POST' },
      PipelineRetryDataSchema
    )
  },
  getRuns(id: string) {
    return apiFetch<PipelineRunDTO[]>(`/pipeline/projects/${id}/runs`, {}, z.array(PipelineRunDtoSchema))
  },

  // Resources
  updateCharacter(projectId: string, characterId: string, data: Record<string, unknown>) {
    return apiFetch<PipelineCharacterDto>(`/pipeline/projects/${projectId}/characters/${characterId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }, PipelineCharacterDtoSchema)
  },
  updateLocation(projectId: string, locationId: string, data: Record<string, unknown>) {
    return apiFetch<PipelineLocationDto>(`/pipeline/projects/${projectId}/locations/${locationId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }, PipelineLocationDtoSchema)
  },
  updateShot(projectId: string, shotId: string, data: Record<string, unknown>) {
    return apiFetch<PipelineShotDto>(`/pipeline/projects/${projectId}/shots/${shotId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }, PipelineShotDtoSchema)
  },
}

export const apiKeysApi = {
  create(name: string) {
    return apiFetch<CreateApiKeyData>('/api-keys/', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }, CreateApiKeyDataSchema)
  },

  list() {
    return apiFetch<{ items: ApiKeyDto[] }>('/api-keys/', {}, ApiKeyListDataSchema)
  },

  revoke(id: string) {
    return apiFetch<{ deleted: true }>(`/api-keys/${id}`, { method: 'DELETE' }, DeletedDataSchema)
  },
}

async function parseApiResponse<T>(
  response: Response,
  dataSchema: ZodType<T>
): Promise<ApiResponse<T>> {
  const rawPayload = await response.json().catch(() => null)
  const failurePayload = ApiFailureSchema.safeParse(rawPayload)

  if (failurePayload.success) {
    return failurePayload.data
  }

  const successHeader = ApiSuccessHeaderSchema.safeParse(rawPayload)

  if (successHeader.success) {
    const successData = dataSchema.safeParse(rawPayload.data)

    if (!successData.success) {
      return invalidApiResponse(response)
    }

    return {
      success: true,
      data: successData.data,
    }
  }

  return invalidApiResponse(response)
}

function invalidApiResponse<T>(response: Response): ApiResponse<T> {
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
