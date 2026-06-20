export { resolveModelAlias, GATEWAY_TEXT_MODELS, MODEL_ALIASES } from './aliases'
export {
  OpenAIGatewayError,
  modelNotFoundError,
  invalidModelError,
  invalidParametersError,
  missingUserMessageError,
  insufficientBalanceError,
  generationFailedError,
  apiKeyScopeNotAllowedError,
  apiKeyQuotaExceededError,
  rateLimitedError,
  idempotencyConflictError,
  messagesTooLongError,
} from './errors'
export type { OpenAIGatewayErrorShape } from './errors'
export {
  normalizeChatRequest,
  buildDashScopeTextRequest,
  createChatCompletionResponse,
  createStreamChunk,
  serializeSSEChunk,
  serializeSSEError,
  createModelsResponse,
  extractGatewayBillingParams,
  SSE_DONE,
} from './protocol'
export type {
  OpenAIChatRequest,
  OpenAIChatMessage,
  OpenAIChatResponse,
  OpenAIChatCompletionChunk,
  OpenAIErrorResponse,
  OpenAIModelsResponse,
  NormalizedChatRequest,
  DashScopeTextParams,
  GatewayTextResult,
  GatewayStreamChunk,
  GatewayBillingParams,
} from './protocol'
