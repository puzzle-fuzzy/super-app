/**
 * Worker 内部错误 — 简单的 Error 子类。
 *
 * task-engine 的 classifyTaskError 会按 error.name / message / code 分类。
 * 这里抛出的普通 Error 默认被分类为 system/retriable（除非是 TaskInputError）。
 * 上游网络错误（fetch ECONNRESET 等）的 code 会被 task-engine 的 ERROR_CODE_REGISTRY
 * 识别为 retriable。
 */
export class AppError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AppError'
  }
}
