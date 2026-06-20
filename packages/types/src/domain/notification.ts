// ===== Notification 领域类型 =====

/**
 * 模型类别字面量联合 — 与 @super-app/provider 的 ModelCategory 同构。
 *
 * 在此内联而非 import @super-app/provider，因为 types (L1) 不得依赖 provider (L2)。
 * 若 provider 的 MODEL_CATEGORIES 新增 id，需同步更新此联合（provider-health 类似处理）。
 */
export type ModelCategory = 'text' | 'image' | 'video' | 'audio' | 'subtitle'

/**
 * 通知定位元数据 — 携带结构化引用，供前端「点击定位」跳转到对应资源。
 *
 * 存储在 notifications.meta JSONB 列。不同通知类型携带不同字段：
 *   - task_completed / task_failed：
 *       - recordId + category（定位到工作台记录）
 *       - 如果来自 Canvas 链路：projectId + shotId（直接定位到 Canvas 镜头节点）
 *       - assetId 可选二级定位（v2 镜头资产锚点用）
 *   - canvas_completed：projectId（定位到画布项目）
 *   - balance_warning：category 可选（定位到计费页）
 */
export interface NotificationMeta {
  /** Canvas 项目 id — 点击定位到 /canvas/:projectId */
  projectId?: string
  /** 生成记录 id — 点击定位到工作台对应记录 */
  recordId?: string
  /** Canvas 镜头 id — 与 projectId 一起定位到 /canvas/:projectId?focus=shot:<shotId> */
  shotId?: string
  /** Canvas 资产 id（镜头视频等）— 可选二级定位（v2 用） */
  assetId?: string
  /** 生成类别，辅助前端选择定位目标与图标 */
  category?: ModelCategory
  /** API Key id — api_key_quota / api_key_expired 定位到 /api-keys */
  keyId?: string
  /** 模型 id — provider_anomaly 等系统风险定位辅助 */
  model?: string
  /** API Key 额度使用比例（0-1+）— api_key_quota 展示用 */
  percent?: number
}
