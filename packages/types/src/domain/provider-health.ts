// ===== Provider Model Health 领域类型 =====

/**
 * Provider 模型健康状态 — 断路器降级策略的状态机值。
 *
 * healthy：模型可用，新任务正常派发。
 * degraded：模型连续失败达到阈值，进入冷却窗口，新任务在窗口内快速失败。
 *
 * 注意：`status` 是「最后一次设置」的快照值；是否真正阻断调用由
 * `isDegraded(record, now)`（status==='degraded' 且仍在 degradedUntil 之前）判定，
 * 冷却窗口过期后即使列值仍为 degraded 也视为半开（half-open）可探测。
 */
export type ProviderModelHealthStatus = 'healthy' | 'degraded'

/**
 * Provider 模型健康记录 — 跨进程（server + worker）共享的降级状态。
 *
 * 时间字段统一使用 epoch 毫秒（与 pure policy 的 `now: number` 对齐），
 * DB 层在 timestamptz 与 number 之间转换。`provider_model_health` 表按 model 唯一。
 */
export interface ProviderModelHealth {
  model: string
  status: ProviderModelHealthStatus
  /** 连续失败次数；任一成功清零 */
  consecutiveFailures: number
  /** 累计失败次数（只增，用于 admin 诊断） */
  totalFailures: number
  /** 累计成功次数（只增） */
  totalSuccesses: number
  /** 降级冷却截止 epoch ms；status!=='degraded' 时为 null */
  degradedUntil: number | null
  lastFailureAt: number | null
  lastSuccessAt: number | null
  /** 最近一次失败的错误摘要（observer 上报） */
  lastErrorMessage: string | null
  /** 触发降级的原因摘要 */
  degradedReason: string | null
  updatedAt: number
}

/** 管理员恢复模型健康 / 模型自动降级时的审计 detail */
export interface ProviderHealthDetail {
  model: string
  action: 'degrade' | 'restore'
  /** 恢复操作来源：admin 手动 / outcome 自动（仅 restore 记录 manual） */
  source?: 'manual' | 'auto'
  reason?: string
  previousStatus?: ProviderModelHealthStatus
}
