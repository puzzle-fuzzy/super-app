import type { CanvasPipelineCharacter, NewCanvasPipelineCharacter } from '../schema/canvas-pipeline-characters'
import type { CanvasPipelineContinuityReport } from '../schema/canvas-pipeline-continuity'
import type { CanvasPipelineLocation, NewCanvasPipelineLocation } from '../schema/canvas-pipeline-locations'
import type { CanvasPipelineProject, NewCanvasPipelineProject } from '../schema/canvas-pipeline-projects'
import type { CanvasPipelineShot, NewCanvasPipelineShot } from '../schema/canvas-pipeline-shots'
import { createLogger } from '@super-app/shared'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { db } from '../client'
import { canvasPipelineCharacters } from '../schema/canvas-pipeline-characters'
import { canvasPipelineContinuityReports } from '../schema/canvas-pipeline-continuity'
import { canvasPipelineLocations } from '../schema/canvas-pipeline-locations'
import { canvasPipelineProjects } from '../schema/canvas-pipeline-projects'
import { canvasPipelineShots } from '../schema/canvas-pipeline-shots'

const logger = createLogger('canvas-projects.repo')

/** 创建 Canvas 项目 — 初始状态为 draft */
export async function createCanvasProject(values: NewCanvasPipelineProject) {
  const [project] = await db.insert(canvasPipelineProjects).values(values).returning()
  return project!
}

/** 按 ID 查询项目（自动排除已软删除的记录） */
export async function getCanvasProjectById(id: string) {
  if (!id) {
    logger.error({ id, type: typeof id }, 'getCanvasProjectById called with empty id')
    return null
  }
  const [project] = await db
    .select()
    .from(canvasPipelineProjects)
    .where(and(eq(canvasPipelineProjects.id, id), eq(canvasPipelineProjects.isDeleted, false)))
    .limit(1)
  return project ?? null
}

/**
 * 按 ID + ownerId 查询项目，用于 owner 校验
 */
export async function getCanvasProjectByIdForOwner(id: string, ownerId: string) {
  const [project] = await db
    .select()
    .from(canvasPipelineProjects)
    .where(and(eq(canvasPipelineProjects.id, id), eq(canvasPipelineProjects.ownerId, ownerId), eq(canvasPipelineProjects.isDeleted, false)))
    .limit(1)
  return project ?? null
}

/** 查询用户所有未删除的项目，按创建时间倒序排列 */
export async function listCanvasProjectsByOwner(ownerId: string) {
  return db
    .select()
    .from(canvasPipelineProjects)
    .where(and(eq(canvasPipelineProjects.ownerId, ownerId), eq(canvasPipelineProjects.isDeleted, false)))
    .orderBy(desc(canvasPipelineProjects.createdAt))
}

/** 更新项目字段（自动刷新 updatedAt，排除 id/ownerId/时间戳等不可变字段） */
export async function updateCanvasProject(
  id: string,
  values: Partial<Omit<NewCanvasPipelineProject, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>>,
) {
  const [updated] = await db
    .update(canvasPipelineProjects)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(canvasPipelineProjects.id, id))
    .returning()
  return updated ?? null
}

/** 软删除项目 — 设置 isDeleted=true，记录不会出现在后续查询中 */
export async function softDeleteCanvasProject(id: string) {
  await db
    .update(canvasPipelineProjects)
    .set({ isDeleted: true, updatedAt: new Date() })
    .where(eq(canvasPipelineProjects.id, id))
}

/** 获取项目完整详情（含关联的角色、场景、分镜、最新连续性报告） */
export async function getCanvasProjectDetail(id: string) {
  const project = await getCanvasProjectById(id)
  if (!project)
    return null

  const [characters, locations, shots, continuityReports] = await Promise.all([
    db.select().from(canvasPipelineCharacters).where(eq(canvasPipelineCharacters.projectId, id)),
    db.select().from(canvasPipelineLocations).where(eq(canvasPipelineLocations.projectId, id)),
    db.select().from(canvasPipelineShots).where(eq(canvasPipelineShots.projectId, id)).orderBy(canvasPipelineShots.shotIndex),
    db
      .select()
      .from(canvasPipelineContinuityReports)
      .where(eq(canvasPipelineContinuityReports.projectId, id))
      .orderBy(desc(canvasPipelineContinuityReports.createdAt))
      .limit(1),
  ])

  return { project, characters, locations, shots, latestContinuity: continuityReports[0] ?? null }
}

/** 批量获取项目详情 — 5 条 SQL 替代 1+N*5 条 */
export async function batchGetProjectDetails(ownerId: string) {
  const projects = await listCanvasProjectsByOwner(ownerId)
  if (projects.length === 0)
    return []

  const projectIds = projects.map(p => p.id)

  const [characters, locations, shots, continuityReports] = await Promise.all([
    db.select().from(canvasPipelineCharacters).where(inArray(canvasPipelineCharacters.projectId, projectIds)),
    db.select().from(canvasPipelineLocations).where(inArray(canvasPipelineLocations.projectId, projectIds)),
    db.select().from(canvasPipelineShots).where(inArray(canvasPipelineShots.projectId, projectIds)).orderBy(canvasPipelineShots.shotIndex),
    db.select().from(canvasPipelineContinuityReports).where(inArray(canvasPipelineContinuityReports.projectId, projectIds)).orderBy(desc(canvasPipelineContinuityReports.createdAt)),
  ])

  const charMap = new Map<string, typeof characters>()
  for (const c of characters) {
    const arr = charMap.get(c.projectId) ?? []
    arr.push(c)
    charMap.set(c.projectId, arr)
  }

  const locMap = new Map<string, typeof locations>()
  for (const l of locations) {
    const arr = locMap.get(l.projectId) ?? []
    arr.push(l)
    locMap.set(l.projectId, arr)
  }

  const shotMap = new Map<string, typeof shots>()
  for (const s of shots) {
    const arr = shotMap.get(s.projectId) ?? []
    arr.push(s)
    shotMap.set(s.projectId, arr)
  }

  const contMap = new Map<string, CanvasPipelineContinuityReport>()
  for (const c of continuityReports) {
    if (!contMap.has(c.projectId))
      contMap.set(c.projectId, c)
  }

  return projects.map(p => ({
    project: p,
    characters: charMap.get(p.id) ?? [],
    locations: locMap.get(p.id) ?? [],
    shots: shotMap.get(p.id) ?? [],
    latestContinuity: contMap.get(p.id) ?? null,
  }))
}

// ===== 摘要/详情查询（大项目 Canvas 性能优化） =====

/** 摘要角色行 — 仅汇总画布节点渲染必需的字段 */
export interface CanvasCharacterSummaryRow {
  id: string
  projectId: string
  name: string
  role: string | null
  referenceImageUrl: string | null
  turnaroundSheetUrl: string | null
  locked: boolean
}

/** 摘要场景行 — 仅汇总画布节点渲染必需的字段 */
export interface CanvasLocationSummaryRow {
  id: string
  projectId: string
  name: string
  type: string
  referenceImageUrl: string | null
  locked: boolean
}

/** 摘要镜头行 — 仅汇总画布节点渲染必需的字段 */
export interface CanvasShotSummaryRow {
  id: string
  projectId: string
  shotIndex: number
  duration: number
  narrative: string
  videoUrl: string | null
  status: string
  errorMessage: string | null
  characterIdsJson: string[]
  locationId: string | null
}

/** 摘要查询返回值 — 与 getCanvasProjectDetail 结构对称但字段更少 */
export interface CanvasProjectSummaryResult {
  project: CanvasPipelineProject
  characterSummaries: CanvasCharacterSummaryRow[]
  locationSummaries: CanvasLocationSummaryRow[]
  shotSummaries: CanvasShotSummaryRow[]
  latestContinuity: CanvasPipelineContinuityReport | null
}

/**
 * 获取项目摘要（轻量版）— 主画布渲染所需的最小数据集。
 *
 * 与 {@link getCanvasProjectDetail} 的区别：
 * - 角色只查 id/name/role/referenceImageUrl/turnaroundSheetUrl/locked，跳过 profileJson/identityPrompt 等大字段
 * - 场景只查 id/name/type/referenceImageUrl/locked，跳过 profileJson/scenePrompt 等
 * - 镜头只查 id/shotIndex/duration/narrative/videoUrl/status/errorMessage/characterIds/locationId，跳过 cameraJson 等
 */
export async function getCanvasProjectSummary(id: string): Promise<CanvasProjectSummaryResult | null> {
  const project = await getCanvasProjectById(id)
  if (!project)
    return null

  const [characters, locations, shots, continuityReports] = await Promise.all([
    db
      .select({
        id: canvasPipelineCharacters.id,
        projectId: canvasPipelineCharacters.projectId,
        name: canvasPipelineCharacters.name,
        role: canvasPipelineCharacters.role,
        referenceImageUrl: canvasPipelineCharacters.referenceImageUrl,
        turnaroundSheetUrl: canvasPipelineCharacters.turnaroundSheetUrl,
        locked: canvasPipelineCharacters.locked,
      })
      .from(canvasPipelineCharacters)
      .where(eq(canvasPipelineCharacters.projectId, id)),
    db
      .select({
        id: canvasPipelineLocations.id,
        projectId: canvasPipelineLocations.projectId,
        name: canvasPipelineLocations.name,
        type: canvasPipelineLocations.type,
        referenceImageUrl: canvasPipelineLocations.referenceImageUrl,
        locked: canvasPipelineLocations.locked,
      })
      .from(canvasPipelineLocations)
      .where(eq(canvasPipelineLocations.projectId, id)),
    db
      .select({
        id: canvasPipelineShots.id,
        projectId: canvasPipelineShots.projectId,
        shotIndex: canvasPipelineShots.shotIndex,
        duration: canvasPipelineShots.duration,
        narrative: canvasPipelineShots.narrative,
        videoUrl: canvasPipelineShots.videoUrl,
        status: canvasPipelineShots.status,
        errorMessage: canvasPipelineShots.errorMessage,
        characterIdsJson: canvasPipelineShots.characterIdsJson,
        locationId: canvasPipelineShots.locationId,
      })
      .from(canvasPipelineShots)
      .where(eq(canvasPipelineShots.projectId, id))
      .orderBy(canvasPipelineShots.shotIndex),
    db
      .select()
      .from(canvasPipelineContinuityReports)
      .where(eq(canvasPipelineContinuityReports.projectId, id))
      .orderBy(desc(canvasPipelineContinuityReports.createdAt))
      .limit(1),
  ])

  return { project, characterSummaries: characters, locationSummaries: locations, shotSummaries: shots, latestContinuity: continuityReports[0] ?? null }
}

/** 查询单个角色完整数据（供详情面板按需加载） */
export async function getCanvasCharacterDetail(id: string) {
  const [character] = await db
    .select()
    .from(canvasPipelineCharacters)
    .where(eq(canvasPipelineCharacters.id, id))
    .limit(1)
  return character ?? null
}

/** 查询单个场景完整数据（供详情面板按需加载） */
export async function getCanvasLocationDetail(id: string) {
  const [location] = await db
    .select()
    .from(canvasPipelineLocations)
    .where(eq(canvasPipelineLocations.id, id))
    .limit(1)
  return location ?? null
}

/** 查询单个镜头完整数据（供详情面板按需加载） */
export async function getCanvasShotDetail(id: string) {
  const [shot] = await db
    .select()
    .from(canvasPipelineShots)
    .where(eq(canvasPipelineShots.id, id))
    .limit(1)
  return shot ?? null
}

