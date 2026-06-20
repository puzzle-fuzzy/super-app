import type { CanvasAssetOutput } from '@super-app/types'
import { buildShotVideoPromptEntity, resolveShotVideoReferences, runCanvasAssetStep, toPromptReferenceEntries } from '@super-app/canvas-runtime'
import {
  updateCanvasProject,
  updateCanvasShot,
} from '@super-app/db'
import { createWorkerRepoAdapter } from './canvas-adapter-factory'
import { loadRunnableCanvasProject } from './canvas-execution'
import type { CanvasRuntimeRepoAdapter } from '@super-app/canvas-runtime'

/** Runtime 实体类型（Record<string, unknown> JSONB 字段） */
type RuntimeDetail = NonNullable<Awaited<ReturnType<CanvasRuntimeRepoAdapter['getCanvasProjectDetail']>>>

export interface CanvasRebuildResult extends Record<string, unknown> {
  phase: 'rebuild'
  projectId: string
  promptsBuilt: number
}

export async function executeCanvasRebuild(projectId: string, runId?: string): Promise<CanvasRebuildResult> {
  const detail = await loadRunnableCanvasProject(projectId)

  const accountId = detail.project.ownerId
  const repo = createWorkerRepoAdapter()
  const characterMap = new Map(detail.characters.map(c => [c.id, c]))
  const locationMap = new Map(detail.locations.map(l => [l.id, l]))
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
        // DB 窄类型（ShotCamera/CharacterProfile）→ runtime 宽类型（Record<string, unknown>）
        // 窄→宽对无 index signature 的 interface 需经 unknown 中转
        const references = resolveShotVideoReferences({
          shot: { ...shot, characterIdsJson: shot.characterIdsJson ?? [] } as Parameters<typeof resolveShotVideoReferences>[0]['shot'],
          characters: detail.characters as unknown as RuntimeDetail['characters'],
          locations: detail.locations as unknown as RuntimeDetail['locations'],
        })
        const { videoPrompt, negativePrompt } = buildShotVideoPromptEntity({
          shot: shot as unknown as RuntimeDetail['shots'][number],
          characters: shotCharacters as unknown as RuntimeDetail['characters'],
          location: shotLocation as unknown as RuntimeDetail['locations'][number],
          references: toPromptReferenceEntries(references),
        })

        await updateCanvasShot(shot.id, {
          videoPrompt,
          negativePrompt,
          status: 'ready',
        })

        const outputJson: CanvasAssetOutput = { type: 'text', text: videoPrompt }
        promptsBuilt += 1
        return { result: undefined, output: outputJson }
      },
      repo,
    })
  }

  await updateCanvasProject(projectId, { status: 'prompts_ready' })
  return { phase: 'rebuild', projectId, promptsBuilt }
}
