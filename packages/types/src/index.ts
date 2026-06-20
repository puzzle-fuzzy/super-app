/**
 * @super-app/types — 裸 TS 业务类型单一真源
 *
 * L1 类型层。只导出 interface/type，不含运行时值。
 * 单向依赖 @super-app/contracts（派生 wire 层类型或 re-export 被引用的领域类型）。
 * contracts 不得依赖本包。
 */
// ── 领域模块（domain-types.ts 拆解）─────────────────────────
export * from './domain/canvas-layout'
export * from './domain/task'
export * from './domain/generation'
export * from './domain/notification'
export * from './domain/subtitle'
export * from './domain/provider-health'
export * from './domain/audit'
export * from './domain/dialogue'

// ── 顶层 DTO（按业务域）──────────────────────────────────
export * from './notifications'
export * from './asset-tags'
export * from './assets'
export * from './auth'
export * from './upload'
export * from './admin'
export * from './api-keys'
export * from './billing'
export * from './user-tasks'
