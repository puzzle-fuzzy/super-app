import type { CanvasAssetOutput } from '@super-app/types'
import type { CostDetail } from '@super-app/contracts/billing'
import type { NewCanvasPipelineAsset } from '../schema/canvas-pipeline-assets'
import { and, desc, eq, gte, inArray, isNull, lte, ne, sql } from 'drizzle-orm'
import { db } from '../client'
import { canvasPipelineAssets } from '../schema/canvas-pipeline-assets'

type CanvasAssetCategory = typeof canvasPipelineAssets.category.enumValues[number]
type CanvasAssetStatus = typeof canvasPipelineAssets.status.enumValues[number]

/** 创建 Canvas 资产记录 */
export async function createCanvasAsset(values: NewCanvasPipelineAsset) {
  const [asset] = await db.insert(canvasPipelineAssets).values(values).returning()
  return asset!
}

/** 按 ID 查询单条资产记录 */
export async function getCanvasAssetById(id: string) {
  const [asset] = await db
    .select()
    .from(canvasPipelineAssets)
    .where(eq(canvasPipelineAssets.id, id))
    .limit(1)
  return asset ?? null
}

/**
 * 按 ID + ownerId 查询单条 Canvas 资产 — 镜头参考资产归属校验用
 *
 * 用于服务端校验镜头参考资产时确认 assetId 属于当前用户。
 * 仓库层强制 ownerId 约束，调用方无需再判断归属。
 */
export async function getCanvasAssetByIdForOwner(id: string, ownerId: string) {
  const [asset] = await db
    .select()
    .from(canvasPipelineAssets)
    .where(and(eq(canvasPipelineAssets.id, id), eq(canvasPipelineAssets.ownerId, ownerId)))
    .limit(1)
  return asset ?? null
}

/**
 * 资产中心 — 按 owner 查询 Canvas 资产列表
 *
 * 用于 `/api/assets` 统一资产中心。按 ownerId 隔离权限（canvas_pipeline_assets.ownerId 已存在，
 * 不需要 join project）。支持按 status（多值）、category（多值，用于 kind 预筛）、projectId、
 * model、createdFrom/createdTo 过滤，默认按 createdAt desc。
 */
export async function listCanvasAssetsForLibrary(
  ownerId: string,
  filter: {
    statuses?: CanvasAssetStatus[]
    categories?: CanvasAssetCategory[]
    projectId?: string
    model?: string
    /** 关键词搜索（ilike model / category::text / inputJson::text / outputJson::text） */
    search?: string
    createdFrom?: Date
    createdTo?: Date
    /** 排除已隐藏的记录（资产中心默认排除） */
    excludeHidden?: boolean
    limit?: number
    offset?: number
  } = {},
) {
  const { statuses, categories, projectId, model, search, createdFrom, createdTo, excludeHidden, limit = 100, offset = 0 } = filter

  const conditions = [eq(canvasPipelineAssets.ownerId, ownerId), isNull(canvasPipelineAssets.deletedAt)]
  if (statuses && statuses.length > 0)
    conditions.push(inArray(canvasPipelineAssets.status, statuses))
  if (categories && categories.length > 0)
    conditions.push(inArray(canvasPipelineAssets.category, categories))
  if (projectId)
    conditions.push(eq(canvasPipelineAssets.projectId, projectId))
  if (model)
    conditions.push(eq(canvasPipelineAssets.model, model))
  // 关键词搜索：ilike model / category::text / inputJson::text / outputJson::text
  if (search) {
    const pattern = `%${search}%`
    conditions.push(sql`(
      ${canvasPipelineAssets.model} ILIKE ${pattern}
      OR ${canvasPipelineAssets.category}::text ILIKE ${pattern}
      OR ${canvasPipelineAssets.inputJson}::text ILIKE ${pattern}
      OR ${canvasPipelineAssets.outputJson}::text ILIKE ${pattern}
    )`)
  }
  if (createdFrom)
    conditions.push(gte(canvasPipelineAssets.createdAt, createdFrom))
  if (createdTo)
    conditions.push(lte(canvasPipelineAssets.createdAt, createdTo))
  // 资产中心默认排除已隐藏的记录
  if (excludeHidden)
    conditions.push(isNull(canvasPipelineAssets.hiddenAt))

  return db
    .select()
    .from(canvasPipelineAssets)
    .where(and(...conditions))
    .orderBy(desc(canvasPipelineAssets.createdAt))
    .limit(limit)
    .offset(offset)
}

/**
 * 查询项目下所有活跃资产（queued/running 状态）
 * — 用于资产轮询端点的 activeTasks / activeImageTaskIds / activeVideoTaskIds
 */
export async function listActiveCanvasAssetsByProject(projectId: string) {
  return db
    .select()
    .from(canvasPipelineAssets)
    .where(and(
      eq(canvasPipelineAssets.projectId, projectId),
      inArray(canvasPipelineAssets.status, ['queued', 'running']),
    ))
}

/**
 * 查询项目下所有终态资产（succeeded/failed/cancelled 状态）
 * — 用于成本汇总和资产历史展示
 */
export async function listTerminalCanvasAssetsByProject(projectId: string) {
  return db
    .select()
    .from(canvasPipelineAssets)
    .where(and(
      eq(canvasPipelineAssets.projectId, projectId),
      inArray(canvasPipelineAssets.status, ['succeeded', 'failed', 'cancelled']),
    ))
}

/**
 * 查询指定目标实体的活跃资产（用于资产选择和历史查看）
 *
 * @param targetEntityType 实体类型：project / character / location / shot
 * @param targetEntityId 实体 ID
 * @param category 可选：只查询特定类别的资产
 */
export async function listCanvasAssetsByTarget(
  targetEntityType: string,
  targetEntityId: string,
  category?: CanvasAssetCategory,
) {
  const conditions = [
    eq(canvasPipelineAssets.targetEntityType, targetEntityType),
    eq(canvasPipelineAssets.targetEntityId, targetEntityId),
  ]
  if (category) {
    conditions.push(eq(canvasPipelineAssets.category, category))
  }
  return db
    .select()
    .from(canvasPipelineAssets)
    .where(and(...conditions))
}

/**
 * 查询同一 pipeline run + 目标实体下已有的非失败资产。
 *
 * 用于 worker 重试幂等：如果 videos phase 在提交 provider 后崩溃，重试时应复用
 * 同一个 shotVideo asset，而不是为同一个 run/shot 再创建一个新版本。
 */
export async function findReusableCanvasAssetForPipelineTarget(opts: {
  pipelineRunId: string
  targetEntityType: string
  targetEntityId: string
  category: CanvasAssetCategory
}) {
  const [asset] = await db
    .select()
    .from(canvasPipelineAssets)
    .where(and(
      eq(canvasPipelineAssets.pipelineRunId, opts.pipelineRunId),
      eq(canvasPipelineAssets.targetEntityType, opts.targetEntityType),
      eq(canvasPipelineAssets.targetEntityId, opts.targetEntityId),
      eq(canvasPipelineAssets.category, opts.category),
      inArray(canvasPipelineAssets.status, ['queued', 'running', 'succeeded']),
    ))
    .orderBy(desc(canvasPipelineAssets.createdAt))
    .limit(1)
  return asset ?? null
}

/**
 * Mark asset as running — only succeeds if current status is 'queued' (append-only guard)
 */
export async function markCanvasAssetRunning(id: string, model?: string, inputJson?: Record<string, unknown>) {
  const [updated] = await db
    .update(canvasPipelineAssets)
    .set({
      status: 'running',
      ...(model && { model }),
      ...(inputJson && { inputJson }),
      updatedAt: new Date(),
    })
    .where(and(eq(canvasPipelineAssets.id, id), eq(canvasPipelineAssets.status, 'queued')))
    .returning()
  return updated ?? null
}

/** Mark asset as succeeded — only succeeds if current status is 'running' (append-only guard) */
export async function markCanvasAssetSucceeded(
  id: string,
  outputJson: CanvasAssetOutput,
  publicUrl?: string,
  storagePath?: string,
  providerUrl?: string,
  cost?: CostDetail,
) {
  const [updated] = await db
    .update(canvasPipelineAssets)
    .set({
      status: 'succeeded',
      outputJson,
      ...(publicUrl && { publicUrl }),
      ...(storagePath && { storagePath }),
      ...(providerUrl && { providerUrl }),
      ...(cost && { cost, totalPriceCents: cost.totalPriceCents }),
      updatedAt: new Date(),
    })
    .where(and(eq(canvasPipelineAssets.id, id), eq(canvasPipelineAssets.status, 'running')))
    .returning()
  return updated ?? null
}

/** Mark asset as failed — only succeeds if current status is 'running' (append-only guard) */
export async function markCanvasAssetFailed(id: string, errorMessage: string) {
  const [updated] = await db
    .update(canvasPipelineAssets)
    .set({
      status: 'failed',
      errorMessage,
      updatedAt: new Date(),
    })
    .where(and(eq(canvasPipelineAssets.id, id), eq(canvasPipelineAssets.status, 'running')))
    .returning()
  return updated ?? null
}

/**
 * 将指定资产标记为 isActive=true，同时将同 target 下其他同类别资产标记为 isActive=false
 *
 * 这实现了资产版本选择：同一角色可能有多次肖像生成，
 * setCanvasAssetActive 让最新成功的资产成为 "当前版本"，旧资产变为历史版本。
 */
export async function setCanvasAssetActive(id: string) {
  // 1. 获取目标资产信息
  const asset = await getCanvasAssetById(id)
  if (!asset)
    return null

  // 2. Deactivate 其他同 target 同 category 的资产
  await db
    .update(canvasPipelineAssets)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(
      eq(canvasPipelineAssets.targetEntityType, asset.targetEntityType),
      eq(canvasPipelineAssets.targetEntityId, asset.targetEntityId),
      eq(canvasPipelineAssets.category, asset.category),
      ne(canvasPipelineAssets.id, id),
      eq(canvasPipelineAssets.isActive, true),
    ))

  // 3. Activate 目标资产
  const [updated] = await db
    .update(canvasPipelineAssets)
    .set({ isActive: true, updatedAt: new Date() })
    .where(eq(canvasPipelineAssets.id, id))
    .returning()
  return updated ?? null
}

/**
 * 通过 taskId 查找 canvas_asset 并标记为 succeeded
 * — 用于 Worker 在视频生成完成后更新对应的 shotVideo 资产
 */
export async function markCanvasAssetSucceededByTaskId(
  taskId: string,
  outputJson: CanvasAssetOutput,
  publicUrl?: string,
  storagePath?: string,
  providerUrl?: string,
  cost?: CostDetail,
) {
  const [asset] = await db
    .select()
    .from(canvasPipelineAssets)
    .where(eq(canvasPipelineAssets.taskId, taskId))
    .limit(1)

  if (!asset)
    return null

  return markCanvasAssetSucceeded(asset.id, outputJson, publicUrl, storagePath, providerUrl, cost)
}

/** 将 provider taskId 绑定到 Canvas asset，用于异步 worker 回填结果 */
export async function bindCanvasAssetTaskId(id: string, taskId: string) {
  const [updated] = await db
    .update(canvasPipelineAssets)
    .set({ taskId, updatedAt: new Date() })
    .where(eq(canvasPipelineAssets.id, id))
    .returning()
  return updated ?? null
}

/**
 * 通过 taskId 查找 canvas_asset 并标记为 failed
 * — 用于 Worker 在视频生成失败时更新对应的 shotVideo 资产
 */
export async function markCanvasAssetFailedByTaskId(taskId: string, errorMessage: string) {
  const [asset] = await db
    .select()
    .from(canvasPipelineAssets)
    .where(eq(canvasPipelineAssets.taskId, taskId))
    .limit(1)

  if (!asset)
    return null

  return markCanvasAssetFailed(asset.id, errorMessage)
}

/**
 * 批量取消项目下所有活跃资产
 * — 用于项目级取消操作
 */
export async function cancelActiveCanvasAssetsByProject(projectId: string) {
  return db
    .update(canvasPipelineAssets)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(and(
      eq(canvasPipelineAssets.projectId, projectId),
      inArray(canvasPipelineAssets.status, ['queued', 'running']),
    ))
    .returning()
}

/**
 * 设置资产锁定状态 — 锁定后后续生成不会自动覆盖此版本
 */
export async function setCanvasAssetLocked(id: string, locked: boolean) {
  const [updated] = await db
    .update(canvasPipelineAssets)
    .set({ locked, updatedAt: new Date() })
    .where(eq(canvasPipelineAssets.id, id))
    .returning()
  return updated ?? null
}

/** 隐藏 Canvas 资产（从资产中心移除，不改变 isActive/locked/status） */
export async function hideCanvasAsset(id: string) {
  const [updated] = await db
    .update(canvasPipelineAssets)
    .set({ hiddenAt: new Date(), updatedAt: new Date() })
    .where(eq(canvasPipelineAssets.id, id))
    .returning()
  return updated ?? null
}

/** 恢复已隐藏的 Canvas 资产（repository 层，暂不做 UI） */
export async function unhideCanvasAsset(id: string) {
  const [updated] = await db
    .update(canvasPipelineAssets)
    .set({ hiddenAt: null, updatedAt: new Date() })
    .where(eq(canvasPipelineAssets.id, id))
    .returning()
  return updated ?? null
}
