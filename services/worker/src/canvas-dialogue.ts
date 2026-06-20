import type { CanvasRuntimeLlmClient } from '@super-app/canvas-runtime'
import { runDialoguePhase } from '@super-app/canvas-runtime'
import { getCanvasProjectDetail, updateCanvasShot } from '@super-app/db'
import { createWorkerProviderAdapter } from './canvas-adapter-factory'
import { getTextModel } from './canvas-execution'
import { toRuntimeDetail } from './canvas-mappers'

export interface CanvasDialogueResult extends Record<string, unknown> {
  phase: 'dialogue'
  projectId: string
  dialogueShotCount: number
}

/**
 * Canvas dialogue 阶段执行核心
 *
 * 为项目所有镜头生成对话层数据（dialoguePrompt + dialogueJson + R2V 参考媒体预算），
 * 写回 canvas_shots。run 状态流转与 PG NOTIFY 由 handler 信封（canvas-handlers.ts）负责。
 */
export async function executeCanvasDialogue(
  projectId: string,
  client: CanvasRuntimeLlmClient,
): Promise<CanvasDialogueResult> {
  const detail = await getCanvasProjectDetail(projectId)
  if (!detail)
    throw new Error('项目不存在')

  const textModel = getTextModel(detail.project.modelPreferencesJson)
  const provider = createWorkerProviderAdapter()
  const { results } = await runDialoguePhase({ projectId, detail: toRuntimeDetail(detail), client, textModel, provider })

  for (const result of results) {
    if (result.dialoguePrompt === null && result.dialogueJson === null && result.referenceMedia.length === 0)
      continue
    const patch: Record<string, unknown> = {
      dialoguePrompt: result.dialoguePrompt ?? undefined,
      referenceMedia: result.referenceMedia,
    }
    if (result.dialogueJson)
      patch.dialogueJson = result.dialogueJson
    await updateCanvasShot(result.shotId, patch as Parameters<typeof updateCanvasShot>[1])
  }

  return {
    phase: 'dialogue',
    projectId,
    dialogueShotCount: results.filter(r => r.dialogueJson).length,
  }
}
