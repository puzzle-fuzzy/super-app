/**
 * Pipeline Service — AI 视频制作流水线业务逻辑
 *
 * 所有函数遵循 { db, owner, input } 模式，与 canvas/assets 模块风格一致。
 * DB 调用全部委托给 @super-app/db 仓库函数，不做内联 SQL。
 */
import type { Db } from '@super-app/db'
import type { CurrentUser } from '@super-app/contracts/auth'
import type {
  CanvasPipelinePhase,
  CanvasPipelineRunDTO,
  CharacterDTO,
  LocationDTO,
  ProjectDTO,
  ShotDTO,
} from '@super-app/types'

import { createNextCanvasPipelineTask } from '@super-app/canvas-pipeline'
import {
  cancelActiveCanvasAssetsByProject,
  cancelTask,
  createCanvasProject,
  createPipelineRun,
  createTask,
  findActiveRunForPhase,
  getCanvasAssetById,
  getCanvasCharacterForOwner,
  getCanvasLocationForOwner,
  getCanvasProjectByIdForOwner,
  getCanvasProjectDetail,
  getCanvasShotForOwner,
  linkPipelineRunToTask,
  listActiveCanvasAssetsByProject,
  listCanvasCharactersByProject,
  listCanvasLocationsByProject,
  listCanvasProjectsByOwner,
  listCanvasShotsByProject,
  listPipelineRunsByProject,
  listTerminalCanvasAssetsByProject,
  markPipelineRunCancelled,
  softDeleteCanvasProject,
  updateCanvasCharacter,
  updateCanvasLocation,
  updateCanvasShot,
} from '@super-app/db'

import { AppError, NotFoundError } from '../../shared/errors'

// ── Project CRUD ────────────────────────────────────────────────

export interface ListProjectsInput {
  db: Db
  owner: CurrentUser
  search?: string
  status?: string
  limit?: number
  offset?: number
}

export async function listProjects({ owner }: ListProjectsInput) {
  const projects = await listCanvasProjectsByOwner(owner.id)
  return {
    items: projects.map(toProjectSummary),
    total: projects.length,
  }
}

export interface CreateProjectInput {
  db: Db
  owner: CurrentUser
  name: string
  storyText: string
}

export async function createProject({ owner, name, storyText }: CreateProjectInput) {
  const project = await createCanvasProject({
    ownerId: owner.id,
    title: name,
    storyText,
    status: 'draft',
  })
  return toProjectSummary(project)
}

export interface GetProjectInput {
  db: Db
  owner: CurrentUser
  id: string
}

export async function getProject({ owner, id }: GetProjectInput): Promise<ProjectDTO | null> {
  const owned = await getCanvasProjectByIdForOwner(id, owner.id)
  if (!owned) return null

  const detail = await getCanvasProjectDetail(id)
  if (!detail) return null

  return toProjectDTO(detail)
}

export interface DeleteProjectInput {
  db: Db
  owner: CurrentUser
  id: string
}

export async function deleteProject({ owner, id }: DeleteProjectInput): Promise<void> {
  const owned = await getCanvasProjectByIdForOwner(id, owner.id)
  if (!owned) throw new NotFoundError('项目不存在')
  await softDeleteCanvasProject(id)
}

// ── Phase Triggers ──────────────────────────────────────────────

export interface TriggerPhaseInput {
  db: Db
  owner: CurrentUser
  projectId: string
  phase: CanvasPipelinePhase
}

export interface TriggerPhaseResult {
  runId: string
  taskId: string
  taskType: string
  phase: CanvasPipelinePhase
}

/**
 * 手动触发单个流水线阶段。
 *
 * 1. 校验项目归属
 * 2. 并发守卫：检查该 phase 无活跃 run
 * 3. 创建 pipeline_run + task（通过 createNextCanvasPipelineTask adapter）
 * 4. Worker 自动 claim 并执行
 */
export async function triggerPhase({
  owner,
  projectId,
  phase,
}: TriggerPhaseInput): Promise<TriggerPhaseResult> {
  const owned = await getCanvasProjectByIdForOwner(projectId, owner.id)
  if (!owned) throw new NotFoundError('项目不存在')

  const activeRun = await findActiveRunForPhase(projectId, phase)
  if (activeRun) {
    throw new AppError(409, 'CONFLICT', `阶段 "${phase}" 已有活跃执行，请等待完成或取消后再试`)
  }

  const result = await createNextCanvasPipelineTask({
    projectId,
    accountId: owner.id,
    nextPhase: phase,
    adapter: {
      createPipelineRun: (values: { projectId: string; phase: CanvasPipelinePhase; createdBy: string }) =>
        createPipelineRun(values),
      createTask: (values: {
        accountId: string
        type: `canvas.${CanvasPipelinePhase}`
        domain: 'canvas'
        priority: number
        projectId: string
        targetType: 'pipeline_run'
        targetId: string
        traceId?: string | null
      }) =>
        createTask({
          ownerId: values.accountId,
          type: values.type,
          domain: values.domain,
          priority: values.priority,
          projectId: values.projectId,
          targetType: values.targetType,
          targetId: values.targetId,
          ...(values.traceId ? { traceId: values.traceId } : {}),
        }),
      linkPipelineRunToTask: (runId: string, taskId: string) => linkPipelineRunToTask(runId, taskId),
    },
  })

  return {
    runId: result.runId,
    taskId: result.taskId,
    taskType: result.taskType,
    phase,
  }
}

// ── Pipeline Control ────────────────────────────────────────────

export interface CancelPipelineInput {
  db: Db
  owner: CurrentUser
  projectId: string
}

export async function cancelPipeline({ owner, projectId }: CancelPipelineInput) {
  const owned = await getCanvasProjectByIdForOwner(projectId, owner.id)
  if (!owned) throw new NotFoundError('项目不存在')

  const runs = await listPipelineRunsByProject(projectId)
  let cancelledRuns = 0
  for (const run of runs) {
    if (run.status === 'pending' || run.status === 'running') {
      await markPipelineRunCancelled(run.id)
      if (run.taskId) {
        await cancelTask(run.taskId)
      }
      cancelledRuns++
    }
  }

  await cancelActiveCanvasAssetsByProject(projectId)

  return { cancelled: cancelledRuns }
}

export interface RetryPipelineInput {
  db: Db
  owner: CurrentUser
  projectId: string
}

export async function retryPipeline({ owner, projectId }: RetryPipelineInput): Promise<TriggerPhaseResult | null> {
  const owned = await getCanvasProjectByIdForOwner(projectId, owner.id)
  if (!owned) throw new NotFoundError('项目不存在')

  const runs = await listPipelineRunsByProject(projectId)
  const failedRun = runs.find((r) => r.status === 'failed' || r.status === 'cancelled')
  if (!failedRun) return null

  return triggerPhase({ db: undefined as unknown as Db, owner, projectId, phase: failedRun.phase as CanvasPipelinePhase })
}

export interface GetProjectRunsInput {
  db: Db
  owner: CurrentUser
  projectId: string
}

export async function getProjectRuns({ owner, projectId }: GetProjectRunsInput): Promise<CanvasPipelineRunDTO[]> {
  const owned = await getCanvasProjectByIdForOwner(projectId, owner.id)
  if (!owned) throw new NotFoundError('项目不存在')

  const runs = await listPipelineRunsByProject(projectId)
  return runs.map(toRunDTO)
}

// ── Resource CRUD ───────────────────────────────────────────────

export interface GetProjectResourcesInput {
  db: Db
  owner: CurrentUser
  projectId: string
}

export async function getProjectCharacters({ owner, projectId }: GetProjectResourcesInput): Promise<CharacterDTO[]> {
  const owned = await getCanvasProjectByIdForOwner(projectId, owner.id)
  if (!owned) throw new NotFoundError('项目不存在')

  const chars = await listCanvasCharactersByProject(projectId)
  return chars.map(toCharacterDTO)
}

export interface UpdateCharacterInput {
  db: Db
  owner: CurrentUser
  characterId: string
  data: Record<string, unknown>
}

export async function updateCharacter({ owner, characterId, data }: UpdateCharacterInput): Promise<CharacterDTO | null> {
  const char = await getCanvasCharacterForOwner(characterId, owner.id)
  if (!char) throw new NotFoundError('角色不存在')

  const updated = await updateCanvasCharacter(characterId, data as Parameters<typeof updateCanvasCharacter>[1])
  if (!updated) return null

  return toCharacterDTO(updated)
}

export async function getProjectLocations({ owner, projectId }: GetProjectResourcesInput): Promise<LocationDTO[]> {
  const owned = await getCanvasProjectByIdForOwner(projectId, owner.id)
  if (!owned) throw new NotFoundError('项目不存在')

  const locs = await listCanvasLocationsByProject(projectId)
  return locs.map(toLocationDTO)
}

export interface UpdateLocationInput {
  db: Db
  owner: CurrentUser
  locationId: string
  data: Record<string, unknown>
}

export async function updateLocation({ owner, locationId, data }: UpdateLocationInput): Promise<LocationDTO | null> {
  const loc = await getCanvasLocationForOwner(locationId, owner.id)
  if (!loc) throw new NotFoundError('场景不存在')

  const updated = await updateCanvasLocation(locationId, data as Parameters<typeof updateCanvasLocation>[1])
  if (!updated) return null

  return toLocationDTO(updated)
}

export async function getProjectShots({ owner, projectId }: GetProjectResourcesInput): Promise<ShotDTO[]> {
  const owned = await getCanvasProjectByIdForOwner(projectId, owner.id)
  if (!owned) throw new NotFoundError('项目不存在')

  const shots = await listCanvasShotsByProject(projectId)
  return shots.map(toShotDTO)
}

export interface UpdateShotInput {
  db: Db
  owner: CurrentUser
  shotId: string
  data: Record<string, unknown>
}

export async function updateShot({ owner, shotId, data }: UpdateShotInput): Promise<ShotDTO | null> {
  const shot = await getCanvasShotForOwner(shotId, owner.id)
  if (!shot) throw new NotFoundError('镜头不存在')

  const updated = await updateCanvasShot(shotId, data as Parameters<typeof updateCanvasShot>[1])
  if (!updated) return null

  return toShotDTO(updated)
}

// ── Assets ──────────────────────────────────────────────────────

export async function getProjectAssets({ owner, projectId }: GetProjectResourcesInput) {
  const owned = await getCanvasProjectByIdForOwner(projectId, owner.id)
  if (!owned) throw new NotFoundError('项目不存在')

  const [active, terminal] = await Promise.all([
    listActiveCanvasAssetsByProject(projectId),
    listTerminalCanvasAssetsByProject(projectId),
  ])

  return {
    active: active.map(toAssetSummary),
    terminal: terminal.map(toAssetSummary),
  }
}

export interface GetAssetInput {
  db: Db
  owner: CurrentUser
  assetId: string
}

export async function getAsset({ owner, assetId }: GetAssetInput) {
  const asset = await getCanvasAssetById(assetId)
  if (!asset) return null
  if (asset.ownerId && asset.ownerId !== owner.id) {
    return null
  }
  return toAssetSummary(asset)
}

// ── DTO Mappers ─────────────────────────────────────────────────

function toProjectSummary(p: { id: string; ownerId: string; title: string | null; storyText: string; status: string; createdAt: Date; updatedAt: Date }) {
  return {
    id: p.id,
    accountId: p.ownerId,
    title: p.title,
    storyText: p.storyText,
    status: p.status,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }
}

function toProjectDTO(detail: NonNullable<Awaited<ReturnType<typeof getCanvasProjectDetail>>>): ProjectDTO {
  const { project, characters, locations, shots, latestContinuity } = detail
  return {
    id: project.id,
    accountId: project.ownerId,
    title: project.title,
    storyText: project.storyText,
    status: project.status as ProjectDTO['status'],
    analysis: project.analysisJson as ProjectDTO['analysis'],
    modelPreferences: project.modelPreferencesJson as ProjectDTO['modelPreferences'],
    characters: characters.map(toCharacterDTO),
    locations: locations.map(toLocationDTO),
    shots: shots.map(toShotDTO),
    continuityIssues: (latestContinuity?.issuesJson ?? []) as ProjectDTO['continuityIssues'],
    canvasLayout: project.canvasLayout as ProjectDTO['canvasLayout'],
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  }
}

function toCharacterDTO(c: Record<string, unknown>): CharacterDTO {
  return {
    id: c.id as string,
    projectId: c.projectId as string,
    name: c.name as string,
    role: (c.role as string) ?? null,
    description: (c.description as string) ?? null,
    profile: (c.profileJson as CharacterDTO['profile']) ?? null,
    identityPrompt: (c.identityPrompt as string) ?? null,
    negativePrompt: (c.negativePrompt as string) ?? null,
    referenceImageUrl: (c.referenceImageUrl as string) ?? null,
    turnaroundSheetUrl: (c.turnaroundSheetUrl as string) ?? null,
    locked: (c.locked as boolean) ?? false,
    createdAt: toISO(c.createdAt),
    updatedAt: toISO(c.updatedAt),
  }
}

function toLocationDTO(l: Record<string, unknown>): LocationDTO {
  return {
    id: l.id as string,
    projectId: l.projectId as string,
    name: l.name as string,
    type: (l.type as LocationDTO['type']) ?? 'indoor',
    profile: (l.profileJson as LocationDTO['profile']) ?? null,
    scenePrompt: (l.scenePrompt as string) ?? null,
    negativePrompt: (l.negativePrompt as string) ?? null,
    referenceImageUrl: (l.referenceImageUrl as string) ?? null,
    locked: (l.locked as boolean) ?? false,
    createdAt: toISO(l.createdAt),
    updatedAt: toISO(l.updatedAt),
  }
}

function toShotDTO(s: Record<string, unknown>): ShotDTO {
  return {
    id: s.id as string,
    projectId: s.projectId as string,
    shotIndex: (s.shotIndex as number) ?? 0,
    duration: (s.duration as number) ?? 5,
    locationId: (s.locationId as string) ?? null,
    characterIds: (s.characterIdsJson as string[]) ?? [],
    narrative: (s.narrative as string) ?? '',
    camera: (s.cameraJson as ShotDTO['camera']) ?? {},
    continuity: (s.continuityJson as ShotDTO['continuity']) ?? {},
    timeline: (s.timelineJson as ShotDTO['timeline']) ?? null,
    environment: (s.environmentJson as ShotDTO['environment']) ?? null,
    videoPrompt: (s.videoPrompt as string) ?? null,
    negativePrompt: (s.negativePrompt as string) ?? null,
    videoTaskId: (s.videoTaskId as string) ?? null,
    videoUrl: (s.videoUrl as string) ?? null,
    status: (s.status as ShotDTO['status']) ?? 'draft',
    errorMessage: (s.errorMessage as string) ?? null,
    referenceAssets: (s.referenceAssetsJson as ShotDTO['referenceAssets']) ?? [],
    createdAt: toISO(s.createdAt),
    updatedAt: toISO(s.updatedAt),
  }
}

function toRunDTO(r: Record<string, unknown>): CanvasPipelineRunDTO {
  return {
    id: r.id as string,
    projectId: r.projectId as string,
    phase: r.phase as CanvasPipelinePhase,
    status: r.status as CanvasPipelineRunDTO['status'],
    startedAt: toISO(r.startedAt),
    finishedAt: toISO(r.finishedAt),
    errorMessage: (r.errorMessage as string) ?? null,
    createdBy: (r.createdBy as string) ?? null,
    inputSnapshotJson: (r.inputSnapshotJson as CanvasPipelineRunDTO['inputSnapshotJson']) ?? null,
    outputSummaryJson: (r.outputSummaryJson as CanvasPipelineRunDTO['outputSummaryJson']) ?? null,
    taskId: (r.taskId as string) ?? null,
    createdAt: toISO(r.createdAt),
  }
}

function toAssetSummary(a: Record<string, unknown>) {
  return {
    id: a.id as string,
    projectId: a.projectId as string,
    category: a.category as string,
    targetEntityType: a.targetEntityType as string,
    targetEntityId: a.targetEntityId as string,
    status: a.status as string,
    model: (a.model as string) ?? null,
    publicUrl: (a.publicUrl as string) ?? null,
    providerUrl: (a.providerUrl as string) ?? null,
    errorMessage: (a.errorMessage as string) ?? null,
    isActive: (a.isActive as boolean) ?? false,
    locked: (a.locked as boolean) ?? false,
    createdAt: toISO(a.createdAt),
    updatedAt: toISO(a.updatedAt),
  }
}

function toISO(v: unknown): string {
  if (v instanceof Date) return v.toISOString()
  if (typeof v === 'string') return v
  return ''
}
