// ===== OpenAI 兼容错误类型 =====

export interface OpenAIGatewayErrorShape {
  message: string
  type: string
  code: string
  hint?: string
}

export class OpenAIGatewayError extends Error {
  readonly type: string
  readonly code: string
  readonly hint: string | undefined
  readonly httpStatus: number

  constructor(
    message: string,
    type: string,
    code: string,
    httpStatus: number,
    hint?: string
  ) {
    super(message)
    this.name = 'OpenAIGatewayError'
    this.type = type
    this.code = code
    this.httpStatus = httpStatus
    this.hint = hint
  }

  toJSON(): OpenAIGatewayErrorShape {
    return {
      message: this.message,
      type: this.type,
      code: this.code,
      ...(this.hint ? { hint: this.hint } : {}),
    }
  }
}

// ---- 错误工厂 ----

export function modelNotFoundError(model: string): OpenAIGatewayError {
  return new OpenAIGatewayError(
    `Model '${model}' not found`,
    'invalid_request_error',
    'model_not_found',
    404
  )
}

export function invalidModelError(model: string): OpenAIGatewayError {
  return new OpenAIGatewayError(
    `Model '${model}' is not supported for chat completions`,
    'invalid_request_error',
    'invalid_model',
    400
  )
}

export function invalidParametersError(detail: string): OpenAIGatewayError {
  return new OpenAIGatewayError(
    detail,
    'invalid_request_error',
    'invalid_parameters',
    400
  )
}

export function missingUserMessageError(): OpenAIGatewayError {
  return new OpenAIGatewayError(
    'At least one user message is required',
    'invalid_request_error',
    'missing_user_message',
    400
  )
}

export function insufficientBalanceError(hint?: string): OpenAIGatewayError {
  return new OpenAIGatewayError(
    'Insufficient balance',
    'insufficient_balance',
    'insufficient_balance',
    402,
    hint
  )
}

export function generationFailedError(message: string): OpenAIGatewayError {
  return new OpenAIGatewayError(
    message,
    'server_error',
    'generation_failed',
    500
  )
}

export function apiKeyScopeNotAllowedError(): OpenAIGatewayError {
  return new OpenAIGatewayError(
    'API key scope does not allow gateway access',
    'invalid_request_error',
    'api_key_scope_not_allowed',
    403
  )
}

export function apiKeyQuotaExceededError(): OpenAIGatewayError {
  return new OpenAIGatewayError(
    'API key quota exceeded',
    'rate_limit_error',
    'api_key_quota_exceeded',
    429
  )
}

export function rateLimitedError(retryAfter?: number): OpenAIGatewayError {
  return new OpenAIGatewayError(
    'Rate limit exceeded',
    'rate_limit_error',
    'rate_limited',
    429,
    retryAfter ? `Retry after ${retryAfter} seconds` : undefined
  )
}

export function idempotencyConflictError(): OpenAIGatewayError {
  return new OpenAIGatewayError(
    'Duplicate request: same Idempotency-Key with different body',
    'invalid_request_error',
    'idempotency_conflict',
    409
  )
}

export function messagesTooLongError(maxChars: number): OpenAIGatewayError {
  return new OpenAIGatewayError(
    `Total characters in messages exceeds ${maxChars}`,
    'invalid_request_error',
    'messages_too_long',
    400
  )
}
