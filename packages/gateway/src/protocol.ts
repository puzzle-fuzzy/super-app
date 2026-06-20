// ===== OpenAI → DashScope 协议转换 =====

import type { ModelPricing } from '@super-app/types'

// ---- OpenAI 输入类型 ----

export interface OpenAIChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
  name?: string
}

export interface OpenAIChatRequest {
  model: string
  messages: OpenAIChatMessage[]
  max_tokens?: number
  temperature?: number
  top_p?: number
  stop?: string | string[]
  frequency_penalty?: number
  presence_penalty?: number
  stream?: boolean
  n?: number
}

// ---- 归一化内部类型 ----

export interface NormalizedChatRequest {
  model: string
  messages: { role: string; content: string }[]
  maxTokens?: number
  temperature?: number
  topP?: number
  stop?: string | string[]
  stream: boolean
}

export interface DashScopeTextParams {
  model: string
  input: { messages: { role: string; content: string }[] }
  parameters: {
    result_format: 'message'
    max_tokens?: number
    temperature?: number
    top_p?: number
    stop?: string | string[]
    frequency_penalty?: number
    presence_penalty?: number
  }
}

// ---- OpenAI 输出类型 ----

export interface OpenAIChatChoice {
  index: number
  message: { role: string; content: string }
  finish_reason: 'stop' | 'length' | 'content_filter' | null
}

export interface OpenAIChatUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

export interface OpenAIChatResponse {
  id: string
  object: 'chat.completion'
  created: number
  model: string
  choices: OpenAIChatChoice[]
  usage?: OpenAIChatUsage
}

export interface OpenAIChatCompletionChunk {
  id: string
  object: 'chat.completion.chunk'
  created: number
  model: string
  choices: Array<{
    index: number
    delta: { role?: string; content?: string }
    finish_reason: 'stop' | 'length' | null
  }>
  usage?: OpenAIChatUsage
}

export interface OpenAIErrorResponse {
  error: {
    message: string
    type: string
    code: string
    hint?: string
  }
}

export interface OpenAIModelsResponse {
  object: 'list'
  data: Array<{ id: string; object: string; owned_by: string }>
}

// ---- Gateway 内部结果 ----

export interface GatewayTextResult {
  id: string
  model: string
  text: string
  usage?: { inputTokens: number; outputTokens: number }
  raw?: unknown
}

export interface GatewayStreamChunk {
  delta: string
  done: boolean
  usage?: { inputTokens: number; outputTokens: number }
  finishReason?: string
}

// ---- 请求归一化 ----

export function normalizeChatRequest(
  req: OpenAIChatRequest,
  resolvedModel: string
): NormalizedChatRequest {
  const messages = req.messages.map((m) => ({
    role: m.role,
    content: typeof m.content === 'string' ? m.content : String(m.content ?? ''),
  }))

  return {
    model: resolvedModel,
    messages,
    maxTokens: req.max_tokens ?? req.max_tokens,
    temperature: req.temperature,
    topP: req.top_p,
    stop: req.stop,
    stream: req.stream === true,
  }
}

// ---- DashScope 请求构建 ----

export function buildDashScopeTextRequest(
  normalized: NormalizedChatRequest
): DashScopeTextParams {
  return {
    model: normalized.model,
    input: { messages: normalized.messages },
    parameters: {
      result_format: 'message',
      ...(normalized.maxTokens != null ? { max_tokens: normalized.maxTokens } : {}),
      ...(normalized.temperature != null ? { temperature: normalized.temperature } : {}),
      ...(normalized.topP != null ? { top_p: normalized.topP } : {}),
      ...(normalized.stop != null ? { stop: normalized.stop } : {}),
    },
  }
}

// ---- OpenAI 响应构建 ----

export function createChatCompletionResponse(
  result: GatewayTextResult,
  model: string
): OpenAIChatResponse {
  return {
    id: result.id,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: result.text },
        finish_reason: 'stop',
      },
    ],
    usage: result.usage
      ? {
          prompt_tokens: result.usage.inputTokens,
          completion_tokens: result.usage.outputTokens,
          total_tokens: result.usage.inputTokens + result.usage.outputTokens,
        }
      : undefined,
  }
}

export function createStreamChunk(
  id: string,
  model: string,
  chunk: GatewayStreamChunk
): OpenAIChatCompletionChunk {
  return {
    id,
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        delta: chunk.done ? {} : { content: chunk.delta },
        finish_reason: chunk.done ? (chunk.finishReason as 'stop' | 'length') ?? 'stop' : null,
      },
    ],
    usage: chunk.usage
      ? {
          prompt_tokens: chunk.usage.inputTokens,
          completion_tokens: chunk.usage.outputTokens,
          total_tokens: chunk.usage.inputTokens + chunk.usage.outputTokens,
        }
      : undefined,
  }
}

/** 序列化 SSE chunk → "data: {...}\n\n" */
export function serializeSSEChunk(chunk: OpenAIChatCompletionChunk): string {
  return `data: ${JSON.stringify(chunk)}\n\n`
}

/** SSE 终止标记 */
export const SSE_DONE = 'data: [DONE]\n\n'

/** 序列化 OpenAI 错误为 SSE 格式 */
export function serializeSSEError(err: OpenAIErrorResponse): string {
  return `data: ${JSON.stringify(err)}\n\n`
}

export function createModelsResponse(
  models: Array<{ id: string; object: string; owned_by: string }>
): OpenAIModelsResponse {
  return { object: 'list', data: models }
}

// ---- 计费参数提取 ----

export interface GatewayBillingParams {
  model: string
  pricing: ModelPricing
  stream: boolean
  n?: number
}

/** 从归一化请求 + 模型信息构建计费参数 */
export function extractGatewayBillingParams(
  normalized: NormalizedChatRequest,
  pricing: ModelPricing
): GatewayBillingParams {
  return {
    model: normalized.model,
    pricing,
    stream: normalized.stream,
    n: 1,
  }
}
