/**
 * Canvas Pipeline Service — 业务逻辑层
 *
 * 调用 @super-app/db repository 函数和 @super-app/workflow-engine 决策函数。
 * 当前为骨架实现，返回 mock 数据。完整实现需要 DB repository 函数。
 */

// ── Project CRUD ──────────────────────────────────────────

export async function listProjects(opts: {
  search?: string
  status?: string
  limit: number
  offset: number
}) {
  // TODO: Call @super-app/db canvas project list
  return { data: [], total: 0 }
}

export async function createProject(input: {
  name: string
  storyText: string
  createdBy: string
}) {
  // TODO: Call @super-app/db createCanvasProject
  return { id: 'proj_1', name: input.name, status: 'draft' }
}

export async function getProject(id: string) {
  // TODO: Call @super-app/db getCanvasProjectDetail
  return null
}

export async function deleteProject(id: string, userId: string) {
  // TODO: Call @super-app/db soft-delete project
}

// ── Pipeline Control ──────────────────────────────────────

export async function startPipeline(projectId: string, userId: string) {
  // TODO: Create first pipeline_run + task (canvas.analyze)
  // Use @super-app/workflow-engine createNextCanvasPipelineTask
  return { phase: 'analyze', runId: 'run_1', taskId: 'task_1' }
}

export async function advancePipeline(projectId: string, userId: string) {
  // TODO: Check current phase, create next phase run + task
  return { phase: 'characters', runId: 'run_2', taskId: 'task_2' }
}

export async function cancelPipeline(projectId: string, userId: string) {
  // TODO: Mark active runs as cancelled
}

export async function retryPipeline(projectId: string, userId: string) {
  // TODO: Re-create task for the failed phase
  return { phase: 'analyze', runId: 'run_3', taskId: 'task_3' }
}

export async function getProjectRuns(projectId: string) {
  // TODO: Query canvas_pipeline_runs for project
  return []
}

// ── Resource CRUD ─────────────────────────────────────────

export async function getProjectCharacters(projectId: string) {
  // TODO: Query canvas_characters for project
  return []
}

export async function updateCharacter(id: string, values: Record<string, unknown>) {
  // TODO: Call @super-app/db updateCanvasCharacter
  return { id }
}

export async function getProjectLocations(projectId: string) {
  // TODO: Query canvas_locations for project
  return []
}

export async function updateLocation(id: string, values: Record<string, unknown>) {
  // TODO: Call @super-app/db updateCanvasLocation
  return { id }
}

export async function getProjectShots(projectId: string) {
  // TODO: Query canvas_shots for project
  return []
}

export async function updateShot(id: string, values: Record<string, unknown>) {
  // TODO: Call @super-app/db updateCanvasShot
  return { id }
}

// ── Assets ────────────────────────────────────────────────

export async function getProjectAssets(projectId: string) {
  // TODO: Query canvas_pipeline_assets for project
  return []
}

export async function getAsset(assetId: string) {
  // TODO: Query canvas_pipeline_assets by id
  return null
}
