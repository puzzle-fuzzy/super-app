import type { CanvasAssetOutput } from '@super-app/db'
import { buildShotVideoPromptEntity, resolveShotVideoReferences, runCanvasAssetStep, toPromptReferenceEntries } from '@super-app/canvas-runtime'
import {
  updateCanvasProject,
  updateCanvasShot,
} from '@super-app/db'
import { createWorkerRepoAdapter } from './canvas-adapter-factory'
import { loadRunnableCanvasProject } from './canvas-execution'

export interface CanvasRebuildResult extends Record<string, unknown> {
  phase: 'rebuild'
  projectId: string
  promptsBuilt: number
}

export async function executeCanvasRebuild(projectId: string, runId?: string): Promise<CanvasRebuildResult> {
  const detail = await loadRunnableCanvasProject(projectId)

  const accountId = detail.project.ownerId
  const repo = createWorkerRepoAdapter()
  const characterMap = new Map(detail.characters.map(character => [character.id, character]))
  const locationMap = new Map(detail.locations.map(location => [location.id, location]))
  let promptsBuilt = 0

  for (const shot of detail.shots) {
    const shotCharacters = shot.characterIdsJson
      .map(id => characterMap.get(id))
      .filter(Boolean) as typeof detail.characters

    const shotLocation = shot.locationId ? locationMap.get(shot.locationId) : undefined
    if (!shotLocation)
      continue

    await runCanvasAssetStep({
      asset: {
        ownerId: accountId,
        projectId,
        category: 'videoPrompt',
        targetEntityType: 'shot',
        targetEntityId: shot.id,
        pipelineRunId: runId ?? undefined,
      },
      execute: async () => {
        // 解析 R2V 参考图（与 submit 用同一纯函数），把角色/场景指代烘焙成 [Image N]。
        const references = resolveShotVideoReferences({ shot, characters: detail.characters as any, locations: detail.locations as any } as any)
        const { videoPrompt, negativePrompt } = buildShotVideoPromptEntity({
          shot,
          characters: shotCharacters,
          location: shotLocation,
          references: toPromptReferenceEntries(references),
        } as any)

        await updateCanvasShot(shot.id, {
          videoPrompt,
          negativePrompt,
          status: 'ready',
        } as any)

        const outputJson: CanvasAssetOutput = { type: 'text', text: videoPrompt }
        promptsBuilt += 1
        return { result: undefined, output: outputJson }
      },
      repo,
    } as any)
  }

  await updateCanvasProject(projectId, { status: 'prompts_ready' } as any)
  return { phase: 'rebuild', projectId, promptsBuilt }
}
