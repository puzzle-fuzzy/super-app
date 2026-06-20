import type { CanvasAssetOutput } from '@super-app/db'
import { runCanvasAssetStep, runContinuityPhase } from '@super-app/canvas-runtime'
import { updateCanvasProject } from '@super-app/db'
import { createWorkerRepoAdapter } from './canvas-adapter-factory'
import { loadRunnableCanvasProject } from './canvas-execution'

export interface CanvasContinuityResult extends Record<string, unknown> {
  phase: 'continuity'
  projectId: string
  issuesFound: number
}

export async function executeCanvasContinuity(projectId: string, runId?: string): Promise<CanvasContinuityResult> {
  const detail = await loadRunnableCanvasProject(projectId)

  const accountId = detail.project.ownerId
  const repo = createWorkerRepoAdapter()
  const result = await runCanvasAssetStep<CanvasContinuityResult>({
    asset: {
      accountId,
      projectId,
      category: 'continuityReport',
      targetEntityType: 'project',
      targetEntityId: projectId,
      pipelineRunId: runId ?? undefined,
    },
    execute: async () => {
      const { issues } = await runContinuityPhase({ projectId, detail: detail as any, repo })

      const outputJson: CanvasAssetOutput = { type: 'json', data: { issuesCount: issues.length, issues } }
      return {
        result: { phase: 'continuity', projectId, issuesFound: issues.length },
        output: outputJson,
      }
    },
    repo,
  })

  await updateCanvasProject(projectId, { status: 'continuity_checked' })
  return result
}
