import type { ApiErrorCode } from '@super-app/contracts/api'

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ApiErrorCode,
    message: string,
    public readonly details?: unknown
  ) {
    super(message)
    this.name = 'AppError'
  }
}
