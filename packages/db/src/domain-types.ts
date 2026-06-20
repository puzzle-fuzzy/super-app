/**
 * 领域类型 — 附着到 JSONB 列的 TypeScript 接口（无运行时依赖）。
 *
 * 移植自 excuse 的 packages/db/src/domain-types.ts（仅 5a 所需子集）。
 * 这些类型由 Drizzle 的 $type<T>() 附着到 jsonb 列，提供编译期类型检查。
 */

/** 任务输入参数 — 结构随 task type 定义。 */
export interface TaskInput {
  [key: string]: unknown
}

/** 任务输出结果 — 结构随 task type 定义。 */
export interface TaskOutput {
  [key: string]: unknown
}

/** 结构化错误信息（区分 retriable vs permanent）。 */
export interface TaskErrorInfo {
  category: string
  retriable: boolean
  code?: string
  message: string
}

/** 生成输入参数 — 结构随 model/category 定义（prompt、参考图等）。 */
export interface GenerationInputParams {
  [key: string]: unknown
}

/** 生成输出结果 — 结构随 model/category 定义（URL、文本等）。 */
export interface OutputResult {
  [key: string]: unknown
}

/** 费用明细 — 5d billing 启用。 */
export interface CostDetail {
  totalPriceCents: number
  [key: string]: unknown
}
