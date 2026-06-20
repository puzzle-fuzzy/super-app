import type { CanvasAssetOutput } from '@super-app/types'
import type { CanvasRuntimeLlmClient } from '@super-app/canvas-runtime'
import type { NovelAnalysis } from '@super-app/types'
import { runAnalysisPhase, runCanvasAssetStep } from '@super-app/canvas-runtime'
import { getCanvasProjectById } from '@super-app/db'
import { createWorkerProviderAdapter, createWorkerRepoAdapter } from './canvas-adapter-factory'
import {
  getTextModel,
} from './canvas-execution'

export interface CanvasAnalysisResult extends Record<string, unknown> {
  phase: 'analyze'
  projectId: string
  analysis: NovelAnalysis
}

export async function executeCanvasAnalysis(
  projectId: string,
  client: CanvasRuntimeLlmClient,
  runId?: string,
): Promise<CanvasAnalysisResult> {
  const project = await getCanvasProjectById(projectId)
  if (!project)
    throw new Error('项目不存在')

  const textModel = getTextModel(project.modelPreferencesJson)
  const repo = createWorkerRepoAdapter()
  const provider = createWorkerProviderAdapter()

  return runCanvasAssetStep<CanvasAnalysisResult>({
    asset: {
      accountId: project.ownerId,
      projectId,
      category: 'analysis',
      targetEntityType: 'project',
      targetEntityId: projectId,
      pipelineRunId: runId ?? undefined,
      model: textModel,
    },
    execute: async () => {
      const { analysis } = await runAnalysisPhase({
        projectId,
        storyText: project.storyText,
        isReanalysis: project.status !== 'draft',
        client: client,
        textModel,
        repo,
        textLlmDeps: provider,
      })
      const output: CanvasAssetOutput = { type: 'json', data: { ...analysis } }
      return {
        result: { phase: 'analyze', projectId, analysis },
        output,
      }
    },
    repo,
  })
}
