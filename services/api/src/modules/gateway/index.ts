/**
 * OpenAI 兼容网关路由 — 将 OpenAI 格式请求转发至 DashScope
 *
 * POST /v1/chat/completions — 文本生成（stream + non-stream）
 * GET  /v1/models           — 可用模型列表
 */
import type { OpenAIChatRequest } from '@super-app/gateway'
import {
  GATEWAY_TEXT_MODELS,
  buildDashScopeTextRequest,
  createChatCompletionResponse,
  createModelsResponse,
  createStreamChunk,
  extractGatewayBillingParams,
  isTextModelSupported,
  missingUserMessageError,
  modelNotFoundError,
  normalizeChatRequest,
  serializeSSEChunk,
  SSE_DONE,
  insufficientBalanceError,
  generationFailedError,
  messagesTooLongError,
} from '@super-app/gateway'
import { getModelPricing } from '@super-app/billing'
import { Elysia, t } from 'elysia'

import { authPlugin, getRequiredUser, requireUser } from '../../plugins/auth'
import {
  setupGatewayCall,
  settleGatewaySuccess,
  settleGatewayFailure,
} from '../../services/gateway-service'
import { dashScopeChatCompletion, dashScopeChatCompletionStream } from '../../services/dashscope-text'

const MAX_MESSAGE_CHARS = 100_000

export const gatewayModule = new Elysia({ name: 'gateway', detail: { tags: ['网关'] } })
  .use(authPlugin)
  .guard({ beforeHandle: requireUser }, (guarded) =>
    guarded
      .post(
    '/v1/chat/completions',
    async ({ user, body, set }) => {
      const owner = getRequiredUser(user)

      // 1. 校验模型（必须使用 DashScope 真实模型名）
      if (!isTextModelSupported(body.model)) {
        throw modelNotFoundError(body.model)
      }
      const pricing = getModelPricing(body.model)
      if (!pricing || pricing.unit !== 'token') {
        throw modelNotFoundError(body.model)
      }

      // 2. 归一化 + 验证
      const normalized = normalizeChatRequest(body as OpenAIChatRequest, body.model)
      if (normalized.messages.every((m: { role: string; content: string }) => m.role !== 'user')) {
        throw missingUserMessageError()
      }

      // 消息长度检查
      const totalChars = normalized.messages.reduce(
        (sum: number, m: { role: string; content: string }) => sum + m.content.length,
        0
      )
      if (totalChars > MAX_MESSAGE_CHARS) {
        throw messagesTooLongError(MAX_MESSAGE_CHARS)
      }

      // 3. 构建 DashScope 请求
      const dsParams = buildDashScopeTextRequest(normalized)
      const billing = extractGatewayBillingParams(normalized, pricing)

      // 4. 计费前置：预估 → 创建记录 → 冻结
      const setup = await setupGatewayCall({
        ownerId: owner.id,
        params: dsParams,
        billing,
      })

      if (!setup.ok) {
        throw insufficientBalanceError(setup.error.message)
      }

      const { recordId, estimatedCost } = setup.result

      // 5. 分岔：stream vs non-stream
      if (body.stream) {
        // ---- Streaming ----
        set.headers['Content-Type'] = 'text/event-stream'
        set.headers['Cache-Control'] = 'no-cache'
        set.headers['Connection'] = 'keep-alive'

        const stream = dashScopeChatCompletionStream(dsParams)

        const readable = new ReadableStream({
          async start(controller) {
            let fullText = ''
            let lastUsage: { inputTokens: number; outputTokens: number } | undefined

            try {
              for await (const chunk of stream) {
                fullText += chunk.delta

                const sseChunk = createStreamChunk(recordId, body.model, chunk)
                controller.enqueue(new TextEncoder().encode(serializeSSEChunk(sseChunk)))

                if (chunk.usage) lastUsage = chunk.usage

                if (chunk.done) {
                  // 结算
                  await settleGatewaySuccess({
                    ownerId: owner.id,
                    recordId,
                    estimatedCost,
                    result: {
                      id: recordId,
                      model: body.model,
                      text: fullText,
                      usage: lastUsage,
                    },
                    billing,
                  }).catch((err) => {
                    console.error('[gateway] settle stream failed:', err)
                  })
                  controller.enqueue(new TextEncoder().encode(SSE_DONE))
                }
              }
            } catch (err) {
              const msg = err instanceof Error ? err.message : 'Stream error'
              await settleGatewayFailure({ ownerId: owner.id, recordId, errorMessage: msg }).catch(
                () => {}
              )
              const errResp = { error: { message: msg, type: 'server_error', code: 'generation_failed' } }
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(errResp)}\n\n`))
              controller.enqueue(new TextEncoder().encode(SSE_DONE))
            } finally {
              controller.close()
            }
          },
        })

        return readable
      }

      // ---- Non-streaming ----
      try {
        const result = await dashScopeChatCompletion(dsParams)

        await settleGatewaySuccess({
          ownerId: owner.id,
          recordId,
          estimatedCost,
          result,
          billing,
        })

        return createChatCompletionResponse(result, body.model)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Generation failed'
        await settleGatewayFailure({ ownerId: owner.id, recordId, errorMessage: msg }).catch(() => {})

        throw generationFailedError(msg)
      }
    },
    {
      body: t.Object({
        model: t.String(),
        messages: t.Array(
          t.Object({
            role: t.String(),
            content: t.String(),
            name: t.Optional(t.String()),
          })
        ),
        max_tokens: t.Optional(t.Number()),
        temperature: t.Optional(t.Number()),
        top_p: t.Optional(t.Number()),
        stop: t.Optional(t.Union([t.String(), t.Array(t.String())])),
        frequency_penalty: t.Optional(t.Number()),
        presence_penalty: t.Optional(t.Number()),
        stream: t.Optional(t.Boolean()),
        n: t.Optional(t.Number()),
      }),
      detail: { summary: '聊天补全（OpenAI 兼容）', tags: ['网关'] },
    }
  )
      .get('/v1/models', async () => {
        return createModelsResponse(GATEWAY_TEXT_MODELS)
      }, {
        detail: { summary: '获取模型列表（OpenAI 兼容）', tags: ['网关'] },
      })
  )
