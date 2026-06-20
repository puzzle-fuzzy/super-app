// ===== Generation 运行时状态常量 =====
// 类型真源在 @super-app/types（GenerationStatus 等）。

/**
 * 进行中的 generation status（非终态）—— 用于去重检查、取消活跃记录等场景。
 *
 * 单一来源：db repo / api service 等消费者统一从此 import，消除历史上的本地副本漂移。
 */
export const ACTIVE_GENERATION_STATUSES = ['pending', 'submitting', 'processing', 'saving_output'] as const

