import type { CanvasRuntimeLlmClient } from '@super-app/canvas-runtime'
import { submitShotVideoEntity } from '@super-app/canvas-runtime'
import {
  createCanvasAsset,
  findReusableCanvasAssetForPipelineTarget,
  markCanvasAssetFailed,
  markCanvasAssetRunning,
  notifyNotification,
  updateCanvasProject,
  updateCanvasShot,
} from '@super-app/db'
import { createWorkerBillingAdapter, createWorkerProviderAdapter, createWorkerRepoAdapter } from './canvas-adapter-factory'
import {
  getVideoModel,
  loadRunnableCanvasProject,
} from './canvas-execution'

export interface CanvasVideosResult extends Record<string, unknown> {
  phase: 'videos'
  projectId: string
  shotsSubmitted: number
  shotsSkipped: number
  shotsFailed: number
}

export async function executeCanvasVideos(
  projectId: string,
  client: CanvasRuntimeLlmClient,
  runId?: string,
  workerTaskId?: string,
): Promise<CanvasVideosResult> {
  const detail = await loadRunnableCanvasProject(projectId)
  const project = detail.project
  const accountId = project.ownerId
  let shotsSubmitted = 0
  let shotsSkipped = 0
  let shotsFailed = 0
  const repo = createWorkerRepoAdapter()
  const provider = createWorkerProviderAdapter()
  const billing = createWorkerBillingAdapter()

  await updateCanvasProject(projectId, { status: 'generating' })

  for (const shot of detail.shots) {
    if (!shot.videoPrompt) {
      shotsSkipped += 1
      continue
    }

    const existingAsset = runId
      ? await findReusableCanvasAssetForPipelineTarget({
          pipelineRunId: runId,
          targetEntityType: 'shot',
          targetEntityId: shot.id,
          category: 'shotVideo',
        })
      : null

    if (existingAsset && (existingAsset.status === 'succeeded' || shot.videoTaskId || existingAsset.taskId)) {
      shotsSubmitted += 1
      continue
    }

    const pendingModel = getVideoModel(project.modelPreferencesJson, [])
    const shotVideoAsset = existingAsset ?? await createCanvasAsset({
      ownerId: accountId,
      projectId,
      category: 'shotVideo',
      targetEntityType: 'shot',
      targetEntityId: shot.id,
      pipelineRunId: runId ?? undefined,
      model: pendingModel,
    })
    if (shotVideoAsset.status === 'queued')
      await markCanvasAssetRunning(shotVideoAsset.id)

    try {
      await submitShotVideoEntity({
        projectId,
        accountId: accountId,
        shotId: shot.id,
        assetId: shotVideoAsset.id,
        // DB 窄类型（ShotCamera/CharacterProfile）→ runtime 宽类型（Record<string, unknown>）
        // 窄→宽在无 index signature 的 interface 上 TS 报错，经 unknown 中转
        shot: shot as unknown as Parameters<typeof submitShotVideoEntity>[0]['shot'],
        characters: detail.characters as unknown as Parameters<typeof submitShotVideoEntity>[0]['characters'],
        locations: detail.locations as unknown as Parameters<typeof submitShotVideoEntity>[0]['locations'],
        modelPreferences: project.modelPreferencesJson,
        client,
        repo,
        provider,
        billing,
        diagnostics: {
          workerTaskId,
          pipelineRunId: runId,
          canvasAssetId: shotVideoAsset.id,
        },
      })

      shotsSubmitted += 1
    }
    catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      await updateCanvasShot(shot.id, { status: 'failed', errorMessage })
      await markCanvasAssetFailed(shotVideoAsset.id, errorMessage).catch(() => {})
      // 通知：镜头视频提交失败 — 提交阶段失败不会进入 task-processor 轮询，需在此显式通知
      await notifyNotification({
        accountId: accountId,
        type: 'task_failed',
        title: '镜头视频提交失败',
        body: errorMessage,
        meta: { projectId, assetId: shotVideoAsset.id, category: 'video' },
        // notifyNotification 期望 ownerId，worker 上下文用 accountId
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any).catch(() => {})
      shotsFailed += 1
    }
  }

  await updateCanvasProject(projectId, {
    status: shotsSubmitted > 0 ? 'generating' : 'prompts_ready',
  })

  return {
    phase: 'videos',
    projectId,
    shotsSubmitted,
    shotsSkipped,
    shotsFailed,
  }
}
