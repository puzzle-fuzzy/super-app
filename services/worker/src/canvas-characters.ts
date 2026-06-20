import type { CanvasAssetOutput } from '@super-app/db'
import type { DashScopeClient } from '@super-app/provider'
import type { CanvasRuntimeLlmClient, CanvasRuntimeStorageAdapter } from '@super-app/canvas-runtime'
import { generateCharacterEntity, runCanvasAssetStep } from '@super-app/canvas-runtime'
import {
  deleteCanvasCharactersByProject,
  deleteCanvasShotsByProject,
  getCanvasProjectById,
  updateCanvasProject,
} from '@super-app/db'
import { createWorkerProviderAdapter, createWorkerRepoAdapter } from './canvas-adapter-factory'
import {
  assertCanvasProjectNotGenerating,
  getTextModel,
} from './canvas-execution'

export interface CanvasCharactersResult extends Record<string, unknown> {
  phase: 'characters'
  projectId: string
  charactersCreated: number
  charactersFailed: number
}

export async function executeCanvasCharacters(
  projectId: string,
  client: DashScopeClient,
  runId?: string,
): Promise<CanvasCharactersResult> {
  const project = await getCanvasProjectById(projectId)
  if (!project || !project.analysisJson)
    throw new Error('项目不存在或未分析')
  assertCanvasProjectNotGenerating(project.status)

  const analysis = project.analysisJson
  const accountId = project.ownerId
  const textModel = getTextModel(project.modelPreferencesJson)
  let charactersCreated = 0
  let charactersFailed = 0
  const repo = createWorkerRepoAdapter()
  const provider = createWorkerProviderAdapter()

  await deleteCanvasCharactersByProject(projectId, { excludeLocked: true })
  await deleteCanvasShotsByProject(projectId)

  for (const name of analysis.characterNames) {
    try {
      await runCanvasAssetStep({
        asset: {
          accountId,
          projectId,
          category: 'characterProfile',
          targetEntityType: 'project',
          targetEntityId: projectId,
          pipelineRunId: runId ?? undefined,
          model: textModel,
        },
        execute: async () => {
          const result = await generateCharacterEntity({ projectId, storyText: project.storyText, analysis, name, client: client as any, textModel, repo, textLlmDeps: provider })
          const output: CanvasAssetOutput = { type: 'json', data: { ...result.profile } }
          return {
            result: undefined,
            output,
          }
        },
        repo,
      })
      charactersCreated += 1
    }
    catch {
      charactersFailed += 1
    }
  }

  await updateCanvasProject(projectId, { status: 'characters_ready' })

  return {
    phase: 'characters',
    projectId,
    charactersCreated,
    charactersFailed,
  }
}
