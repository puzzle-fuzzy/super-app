/**
 * DashScope 文本生成客户端 — chat completion (non-streaming + streaming SSE)
 */
import type { DashScopeTextParams, GatewayStreamChunk, GatewayTextResult } from '@super-app/gateway'
import { serverEnv } from '@super-app/env/server'

const DEFAULT_BASE_URL = 'https://dashscope.aliyuncs.com/api/v1'

function baseUrl(): string {
  return (
    process.env.DASHSCOPE_BASE_URL || serverEnv.DASHSCOPE_BASE_URL || DEFAULT_BASE_URL
  ).replace(/\/+$/, '')
}

function apiKey(): string {
  return process.env.DASHSCOPE_API_KEY || serverEnv.DASHSCOPE_API_KEY || ''
}

// ---- Non-streaming ----

interface DashScopeTextResponse {
  request_id?: string
  code?: string
  message?: string
  output?: {
    choices?: Array<{ message?: { role?: string; content?: string } }>
    usage?: {
      input_tokens?: number
      output_tokens?: number
      total_tokens?: number
    }
  }
}

export async function dashScopeChatCompletion(
  params: DashScopeTextParams
): Promise<GatewayTextResult> {
  const url = `${baseUrl()}/services/aigc/text-generation/generation`
  const key = apiKey()
  if (!key?.trim()) throw new Error('DASHSCOPE_API_KEY is not configured')

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  })

  const payload = (await response.json().catch(() => null)) as DashScopeTextResponse | null

  if (!response.ok || !payload) {
    throw new Error(
      payload?.message || payload?.code || `DashScope text generation failed (${response.status})`
    )
  }

  const choice = payload.output?.choices?.[0]
  const text = choice?.message?.content ?? ''
  const usage = payload.output?.usage

  return {
    id: payload.request_id ?? `ds-${Date.now()}`,
    model: params.model,
    text,
    raw: payload,
    usage: usage
      ? { inputTokens: usage.input_tokens ?? 0, outputTokens: usage.output_tokens ?? 0 }
      : undefined,
  }
}

// ---- Streaming (SSE via async generator) ----

interface DashScopeSSEEvent {
  request_id?: string
  output?: {
    choices?: Array<{
      message?: { content?: string }
      finish_reason?: string
    }>
    usage?: {
      input_tokens?: number
      output_tokens?: number
    }
  }
}

export async function* dashScopeChatCompletionStream(
  params: DashScopeTextParams
): AsyncGenerator<GatewayStreamChunk> {
  const url = `${baseUrl()}/services/aigc/text-generation/generation`
  const key = apiKey()
  if (!key?.trim()) throw new Error('DASHSCOPE_API_KEY is not configured')

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'X-DashScope-SSE': 'enable',
    },
    body: JSON.stringify(params),
  })

  if (!response.ok) {
    const errBody = await response.text().catch(() => '')
    throw new Error(`DashScope stream failed (${response.status}): ${errBody.slice(0, 200)}`)
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error('DashScope stream returned no body')

  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data:')) continue

        const jsonStr = trimmed.slice(5).trim()
        if (jsonStr === '[DONE]') {
          return // stream complete
        }

        try {
          const event: DashScopeSSEEvent = JSON.parse(jsonStr)
          const choice = event.output?.choices?.[0]
          const delta = choice?.message?.content ?? ''
          const finishReason = choice?.finish_reason
          const done = !!finishReason && finishReason !== 'null'

          yield {
            delta,
            done,
            finishReason: finishReason ?? undefined,
            usage: event.output?.usage
              ? {
                  inputTokens: event.output.usage.input_tokens ?? 0,
                  outputTokens: event.output.usage.output_tokens ?? 0,
                }
              : undefined,
          }

        } catch {
          // skip unparseable lines
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}
