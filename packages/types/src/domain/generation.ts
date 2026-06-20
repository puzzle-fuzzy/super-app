// ===== Generation 领域类型 =====
// 生成任务输入参数信封 + 费用明细 + 输出结果联合 + Worker→NOTIFY 负载。
// 纯数据接口，无运行时依赖。

import type { SubtitleSentence } from './subtitle'
// CostDetail 真源在 @super-app/contracts/billing（被 wire 层引用，铁律：被 contracts
// 引用的类型定义在 contracts）。本文件 import 引入名字供 GenerationNotifyPayload.cost 使用；
// 对外 re-export 由 src/index.ts 统一处理。
import type { CostDetail } from '@super-app/contracts/billing'

/**
 * 生成任务输入参数信封 — 存储在 generation_records.inputParams JSONB 中
 *
 * 平坦结构：模型参数（prompt, n, duration, resolution 等）与信封字段
 * （source, projectId, shotId, referenceFileIds）在同一层级。
 * DB JSONB 无法按模型区分参数结构，故用 index signature 兼容动态键。
 *
 * 业务代码应通过 ValidatedModelParameters（@super-app/provider）访问模型参数，
 * 不应直接索引此信封的 unknown 字段。
 */
export interface GenerationInputParams {
  /** 来源标记：'canvas' = Canvas 流水线，'gateway' = OpenAI 兼容网关 */
  source?: 'canvas' | 'gateway'
  /** Canvas 项目 ID（仅 canvas 来源时存在） */
  projectId?: string
  /** Canvas 镜头 ID（仅 canvas 来源时存在） */
  shotId?: string
  /** 用户传入的原始模型名（仅 gateway 来源时存在，如 gpt-4o-mini），用于 usage 列表展示 */
  requestedModel?: string
  /** 参考文件 ID 列表（用户上传参考图时存在） */
  referenceFileIds?: string[]
  /**
   * 模型参数 — 动态键，由 ModelConfig.parameters 声明决定。
   * DB JSONB 存储边界：无法静态枚举所有模型的参数组合。
   * 服务层应通过 ValidatedModelParameters 访问，此处仅存储。
   */
  [key: string]: unknown
}

/** 文本输出 */
export interface TextOutputResult {
  type: 'text'
  text: string
}

/** 图片输出 */
export interface ImageOutputResult {
  type: 'image'
  savedUrls: string[]
  urls?: string[]
}

/** 视频输出 */
export interface VideoOutputResult {
  type: 'video'
  savedUrls: string[]
  originalUrl?: string
  /** @deprecated 使用 originalUrl。保留以兼容 DashScope 旧数据 */
  video_url?: string
}

/** 处理中状态（异步任务尚未完成） */
export interface ProcessingOutputResult {
  type: 'processing'
  taskId?: string
  status?: string
}

/** 字幕输出（ASR 转录结果） */
export interface SubtitleOutputResult {
  type: 'subtitle'
  /** 提取后的句子列表 */
  sentences: SubtitleSentence[]
  /** ASR 转录结果下载 URL（24 小时过期） */
  transcriptionUrl?: string
}

/** outputResult 的所有可能形态（可辨识联合，通过 type 字段区分） */
export type OutputResult
  = | TextOutputResult
    | ImageOutputResult
    | VideoOutputResult
    | ProcessingOutputResult
    | SubtitleOutputResult

/**
 * Worker → PostgreSQL NOTIFY 的负载
 *
 * Worker 在更新 DB 后通过 pgClient.notify() 发送，
 * Server 端通过 LISTEN 接收并映射为 SSE 事件推送到前端。
 *
 * status / category 使用字符串字面量而非 pgEnum 推断类型，
 * 因为 domain 类型层不依赖 schema 层。
 */
export interface GenerationNotifyPayload {
  accountId: string
  recordId: string
  status: 'pending' | 'submitting' | 'processing' | 'saving_output' | 'succeeded' | 'failed' | 'cancelled'
  category: 'text' | 'image' | 'video' | 'subtitle'
  model: string
  /** 异步任务 ID（可为 null：未提交到 provider 的任务如用户取消 pending 状态） */
  taskId: string | null
  traceId?: string | null
  outputResult?: OutputResult
  errorMessage?: string
  cost?: CostDetail
  /** Canvas pipeline 元数据（仅当 source === 'canvas' 时存在） */
  canvasMeta?: {
    projectId: string
    shotId: string
    /** 当本次 shot 更新让视频阶段进入终态时携带最新项目状态 */
    projectStatus?: 'completed' | 'partial_failed'
  }
}
