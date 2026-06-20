import type { CanvasAssetOutput } from '@super-app/db'
import type { DashScopeClient } from '@super-app/provider'
import type { CanvasRuntimeLlmClient, CanvasRuntimeStorageAdapter } from '@super-app/canvas-runtime'
import { generateLocationEntity, runCanvasAssetStep } from '@super-app/canvas-runtime'
import {
  deleteCanvasLocationsByProject,
  deleteCanvasShotsByProject,
  getCanvasProjectById,
  updateCanvasProject,
} from '@super-app/db'
import { createWorkerProviderAdapter, createWorkerRepoAdapter } from './canvas-adapter-factory'
import {
  assertCanvasProjectNotGenerating,
  getTextModel,
} from './canvas-execution'

export interface CanvasLocationsResult extends Record<string, unknown> {
  phase: 'locations'
  projectId: string
  locationsCreated: number
  locationsFailed: number
}

export async function executeCanvasLocations(
  projectId: string,
  client: DashScopeClient,
  runId?: string,
): Promise<CanvasLocationsResult> {
  const project = await getCanvasProjectById(projectId)
  if (!project || !project.analysisJson)
    throw new Error('项目不存在或未分析')
  assertCanvasProjectNotGenerating(project.status)

  const analysis = project.analysisJson
  const accountId = project.ownerId
  const textModel = getTextModel(project.modelPreferencesJson)
  let locationsCreated = 0
  let locationsFailed = 0
  const repo = createWorkerRepoAdapter()
  const provider = createWorkerProviderAdapter()

  await deleteCanvasLocationsByProject(projectId, { excludeLocked: true })
  await deleteCanvasShotsByProject(projectId)

  for (const name of analysis.sceneNames) {
    try {
      await runCanvasAssetStep({
        asset: {
          accountId,
          projectId,
          category: 'locationProfile',
          targetEntityType: 'project',
          targetEntityId: projectId,
          pipelineRunId: runId ?? undefined,
          model: textModel,
        },
        execute: async () => {
          const result = await generateLocationEntity({ projectId, storyText: project.storyText, analysis, name, client: client as any, textModel, repo, textLlmDeps: provider })
          const output: CanvasAssetOutput = { type: 'json', data: { ...result.profile } }
          return {
            result: undefined,
            output,
          }
        },
        repo,
      })
      locationsCreated += 1
    }
    catch {
      locationsFailed += 1
    }
  }

  await updateCanvasProject(projectId, { status: 'locations_ready' })

  return {
    phase: 'locations',
    projectId,
    locationsCreated,
    locationsFailed,
  }
}
