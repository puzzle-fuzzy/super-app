import type { NewUploadedFile } from '../schema/uploaded-files'
import { and, count, desc, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm'
import { db } from '../client'
import { generationRecords } from '../schema/generation-records'
import { subtitleProjects } from '../schema/subtitle-projects'
import { uploadedFiles } from '../schema/uploaded-files'

/**
 * 创建上传文件记录
 */
export async function createUploadedFile(values: NewUploadedFile) {
  const [record] = await db.insert(uploadedFiles).values(values).returning()
  return record!
}

/**
 * 按 ID 查询单条上传文件记录
 */
export async function getUploadedFileById(id: string) {
  const [record] = await db
    .select()
    .from(uploadedFiles)
    .where(eq(uploadedFiles.id, id))
    .limit(1)
  return record ?? null
}

/**
 * 按 ID + ownerId 查询单条上传文件 — 镜头参考资产归属校验用
 *
 * 用于服务端校验镜头参考资产时确认 assetId 属于当前用户。
 * 仓库层强制 ownerId 约束，调用方无需再判断归属。
 */
export async function getUploadedFileByIdForOwner(id: string, ownerId: string) {
  const [record] = await db
    .select()
    .from(uploadedFiles)
    .where(and(eq(uploadedFiles.id, id), eq(uploadedFiles.ownerId, ownerId)))
    .limit(1)
  return record ?? null
}

/**
 * 按 ID 列表批量查询上传文件记录
 */
export async function getUploadedFilesByIds(ids: string[]) {
  if (ids.length === 0)
    return []
  return db
    .select()
    .from(uploadedFiles)
    .where(inArray(uploadedFiles.id, ids))
}

/**
 * 按 ID 列表批量查询属于指定用户的上传文件记录
 */
export async function getUploadedFilesByIdsForOwner(ids: string[], ownerId: string) {
  if (ids.length === 0)
    return []
  return db
    .select()
    .from(uploadedFiles)
    .where(and(inArray(uploadedFiles.id, ids), eq(uploadedFiles.ownerId, ownerId)))
}

/**
 * 资产中心 — 按 owner 查询上传文件列表（分页，createdAt desc）
 *
 * 用于 `/api/assets` 统一资产中心。按 ownerId 隔离权限。
 * 上传文件无 model 列，因此只支持 createdFrom/createdTo 时间范围过滤（按模型筛选时
 * 路由层直接跳过 uploaded_files，不会走到这里）。
 */
export async function listUploadedFilesForOwner(
  ownerId: string,
  filter: { search?: string, createdFrom?: Date, createdTo?: Date, limit?: number, offset?: number } = {},
) {
  const { search, createdFrom, createdTo, limit = 100, offset = 0 } = filter
  const conditions = [eq(uploadedFiles.ownerId, ownerId), isNull(uploadedFiles.deletedAt)]
  // 关键词搜索：ilike fileName / mimeType / purpose::text / publicUrl
  if (search) {
    const pattern = `%${search}%`
    conditions.push(sql`(
      ${uploadedFiles.fileName} ILIKE ${pattern}
      OR ${uploadedFiles.mimeType} ILIKE ${pattern}
      OR ${uploadedFiles.purpose}::text ILIKE ${pattern}
      OR ${uploadedFiles.publicUrl} ILIKE ${pattern}
    )`)
  }
  if (createdFrom)
    conditions.push(gte(uploadedFiles.createdAt, createdFrom))
  if (createdTo)
    conditions.push(lte(uploadedFiles.createdAt, createdTo))
  return db
    .select()
    .from(uploadedFiles)
    .where(and(...conditions))
    .orderBy(desc(uploadedFiles.createdAt))
    .limit(limit)
    .offset(offset)
}

/** 编辑上传文件 patch — 仅允许 fileName / purpose */
export interface UploadedFilePatch {
  fileName?: string
  purpose?: string
}

/**
 * 编辑上传文件（重命名 / 用途） — 强制 ownerId 隔离
 *
 * 空 patch 直接 fallback 到 `getUploadedFileByIdForOwner`，避免无意义 UPDATE。
 * 越权访问（id 存在但属于其他用户）会被 WHERE 子句静默过滤，最终返回 null。
 */
export async function updateUploadedFile(
  id: string,
  ownerId: string,
  patch: UploadedFilePatch,
) {
  const set: Partial<typeof uploadedFiles.$inferInsert> = {}
  if (patch.fileName !== undefined)
    set.fileName = patch.fileName
  if (patch.purpose !== undefined)
    set.purpose = patch.purpose
  if (Object.keys(set).length === 0)
    return getUploadedFileByIdForOwner(id, ownerId)
  const [row] = await db
    .update(uploadedFiles)
    .set(set)
    .where(and(eq(uploadedFiles.id, id), eq(uploadedFiles.ownerId, ownerId)))
    .returning()
  return row ?? null
}

/** 按 ID 删除单个上传文件记录 */
export async function deleteUploadedFileById(id: string) {
  await db.delete(uploadedFiles).where(eq(uploadedFiles.id, id))
}

// ── 使用中保护 ────────────────────────────────────────────────────────────

/** 上传文件被引用的统计 — 决定是否允许安全删除 */
export interface UploadedFileUsage {
  /** subtitle_projects.videoFileId 引用数 */
  subtitleProjectCount: number
  /** generation_records.inputParams.referenceFileIds 引用数（JSONB containment 查询） */
  generationRecordCount: number
}

/**
 * 查询上传文件的使用引用数 — 删除前安全检查
 *
 * - subtitle_projects.videoFileId 是显式 FK，查询简单
 * - generation_records.inputParams.referenceFileIds 是 JSONB 内嵌数组，
 *   使用 PostgreSQL @> containment 运算符（`input_params @> '{"referenceFileIds":["<id>"]}'::jsonb`）
 *   查不到引用时才允许删除
 */
export async function getUploadedFileUsage(ownerId: string, fileId: string): Promise<UploadedFileUsage> {
  // subtitle_projects 外键引用计数
  const [subtitleRow] = await db
    .select({ count: count() })
    .from(subtitleProjects)
    .where(and(eq(subtitleProjects.ownerId, ownerId), eq(subtitleProjects.videoFileId, fileId)))
  const subtitleProjectCount = subtitleRow?.count ?? 0

  // generation_records JSONB containment 引用计数
  // inputParams 是 JSONB 列，referenceFileIds 是其内的 string[] 字段
  // PostgreSQL `@>` 运算符检查顶层 key 是否包含指定值
  const containmentFragment = sql`'{"referenceFileIds":["${sql.raw(fileId)}"]}'::jsonb`
  const [genRow] = await db
    .select({ count: count() })
    .from(generationRecords)
    .where(and(
      eq(generationRecords.ownerId, ownerId),
      sql`${generationRecords.inputParams} @> ${containmentFragment}`,
    ))
  const generationRecordCount = genRow?.count ?? 0

  return { subtitleProjectCount, generationRecordCount }
}
