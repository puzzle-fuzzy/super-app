// ===== API 响应 DTO 类型 =====
// 新增或重构的路由不再手写零散 response shape，使用这些共享 DTO。

/**
 * 简单 mutation 成功响应 — 无实体的确认型操作（删除、取消、标记已读等）
 *
 * 使用场景：DELETE /records/:id, POST /records/:id/cancel, POST /notifications/:id/read
 * 前端只需知道操作成功，不需要实体数据。
 */
export interface MutationOkResponse {
  success: true
}

/**
 * 实体响应 — 成功时返回单个实体数据
 *
 * 使用场景：GET /records/:id, PATCH /canvas/projects/:projectId
 * data 字段携带完整实体序列化结果。
 */
export interface EntityResponse<T> {
  success: true
  data: T
}

/**
 * 列表响应 — 成功时返回实体数组 + 总数
 *
 * 使用场景：GET /records, GET /canvas/projects, GET /notifications
 * items 字段携带序列化后的实体数组，total 为当前查询条件下的总数。
 */
export interface ListResponse<T> {
  success: true
  items: T[]
  total: number
}

/**
 * 带实体的创建/更新响应 — 成功时返回新创建或更新后的实体
 *
 * 使用场景：POST /generate（创建记录 + 觔回结果）,
 * POST /records/:id/retry（重置 + 返回更新记录）,
 * POST /api-keys（创建 key + 返回原始值）
 *
 * record 字段是业务实体（GenerationRecord、ApiKey 等）。
 * 此类型适用于"创建后需要完整实体"的场景，
 * 简单确认型操作应使用 MutationOkResponse。
 */
export interface RecordResponse<T> {
  success: true
  record: T
}

/**
 * API 错误响应 — 所有业务错误统一格式
 *
 * 使用场景：4xx 错误（校验失败、权限不足、资源不存在）
 * success: false + error 消息。HTTP status code 由 route 设置。
 * 不把业务失败包装成 HTTP 200。
 */
export interface ApiErrorResponse {
  success: false
  error: string
}

/**
 * 错误分类 — 用户可理解的高层归类，决定展示语气与下一步建议。
 */
export type ProductErrorCategory =
  | 'validation'
  | 'billing'
  | 'provider'
  | 'storage'
  | 'rate_limit'
  | 'content_policy'
  | 'auth'
  | 'system'

/**
 * 用户可执行的下一次动作 — 驱动 UI 上的恢复按钮/提示。
 */
export type ProductErrorUserAction =
  | 'edit_input'
  | 'retry'
  | 'recharge'
  | 'wait'
  | 'contact_support'
  | 'login'
  | 'none'

/**
 * 产品化错误明细 — 附在 ApiErrorResponse.errorDetail 上，供前端展示
 * 统一的错误分类、是否可重试、下一步动作与排障码。
 *
 * 设计约束：ApiErrorResponse.error 仍为人类可读字符串（向后兼容旧客户端），
 * errorDetail 是可选的结构化补充。
 */
export interface ProductErrorDetail {
  /** 高层分类，驱动 UI 展示语气 */
  category: ProductErrorCategory
  /** 稳定错误码（机器可读），如 insufficient_balance、model_not_found */
  code: string
  /** 是否值得用户/客户端自动重试 */
  retryable: boolean
  /** 建议的下一步动作 */
  userAction: ProductErrorUserAction
  /** 排障码 — 用户报障时提供，管理员据此定位日志 */
  supportCode: string
}

/**
 * 扩展错误响应 — 在 ApiErrorResponse 基础上附带结构化错误明细。
 * errorDetail 缺失时，客户端回退到读取 error 字符串。
 */
export interface ProductErrorResponse extends ApiErrorResponse {
  errorDetail?: ProductErrorDetail
}

/**
 * 限流错误响应 — 在统一错误体基础上附带重试建议秒数。
 */
export interface RateLimitErrorResponse extends ProductErrorResponse {
  retryAfter: number
}
