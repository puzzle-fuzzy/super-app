/**
 * Canvas Runtime Adapter 工厂 — Worker 端
 *
 * 从真实的 @super-app/db / @super-app/provider / @super-app/storage / @super-app/ffmpeg
 * 组装 CanvasRuntimeAdapters，供 canvas-runtime phase 函数注入使用。
 */
import type {
  CanvasRuntimeBillingAdapter,
  CanvasRuntimeFfmpegAdapter,
  CanvasRuntimeLlmClient,
  CanvasRuntimeProviderAdapter,
  CanvasRuntimeRepoAdapter,
  CanvasRuntimeStorageAdapter,
} from '@super-app/canvas-runtime'

import type { DashScopeClient } from '@super-app/provider'
import type { StorageProvider } from '@super-app/storage'
import { calculateCost } from '@super-app/billing'
import {
  batchCreateCanvasShots,
  bindCanvasAssetTaskId,
  createCanvasAsset,
  createCanvasCharacter,
  createCanvasLocation,
  createContinuityReport,
  createGenerationRecord,
  deleteCanvasCharactersByProject,
  deleteCanvasLocationsByProject,
  deleteCanvasShotsByProject,
  getCanvasProjectById,
  getCanvasProjectDetail,
  markCanvasAssetFailed,
  markCanvasAssetRunning,
  markCanvasAssetSucceeded,
  setCanvasAssetActive,
  updateCanvasCharacter,
  updateCanvasLocation,
  updateCanvasProject,
  updateCanvasShot,
} from '@super-app/db'
import { concatVideos, mixBgmTrack } from '@super-app/ffmpeg'
import { getModelById, validateAndMerge } from '@super-app/provider'

export function createWorkerRepoAdapter(): CanvasRuntimeRepoAdapter {
  return {
    getCanvasProjectById: getCanvasProjectById as any,
    getCanvasProjectDetail: getCanvasProjectDetail as any,
    updateCanvasProject: updateCanvasProject as any,
    createCanvasCharacter: createCanvasCharacter as any,
    updateCanvasCharacter: updateCanvasCharacter as any,
    deleteCanvasCharactersByProject: deleteCanvasCharactersByProject as any,
    createCanvasLocation: createCanvasLocation as any,
    updateCanvasLocation: updateCanvasLocation as any,
    deleteCanvasLocationsByProject: deleteCanvasLocationsByProject as any,
    batchCreateCanvasShots: batchCreateCanvasShots as any,
    deleteCanvasShotsByProject: deleteCanvasShotsByProject as any,
    updateCanvasShot: updateCanvasShot as any,
    createContinuityReport: createContinuityReport as any,
    createCanvasAsset: createCanvasAsset as any,
    markCanvasAssetRunning: markCanvasAssetRunning as any,
    markCanvasAssetSucceeded: markCanvasAssetSucceeded as any,
    markCanvasAssetFailed: markCanvasAssetFailed as any,
    setCanvasAssetActive: setCanvasAssetActive as any,
    bindCanvasAssetTaskId: bindCanvasAssetTaskId as any,
    createGenerationRecord: createGenerationRecord as any,
  }
}

export function createWorkerProviderAdapter(): CanvasRuntimeProviderAdapter {
  return {
    getModelById: getModelById as any,
    validateAndMerge: validateAndMerge as any,
  }
}

export function createWorkerFfmpegAdapter(): CanvasRuntimeFfmpegAdapter {
  return {
    concatVideos: concatVideos as any,
    mixBgmTrack: mixBgmTrack as any,
  }
}

export function createWorkerBillingAdapter(): CanvasRuntimeBillingAdapter {
  return { calculateCost: calculateCost as any }
}

export function createWorkerLlmAdapter(client: DashScopeClient): CanvasRuntimeLlmClient {
  return client as any as CanvasRuntimeLlmClient
}

export function createWorkerStorageAdapter(storage: StorageProvider): CanvasRuntimeStorageAdapter {
  return {
    put: async (key, body, contentType) => {
      // StorageProvider.put 的 body 只接受 Buffer；必要时转换
      const buf = Buffer.isBuffer(body) ? body : Buffer.from(body)
      const result = await storage.put({ key, body: buf, mimeType: contentType ?? 'application/octet-stream' })
      return { url: result.url }
    },
    read: async (key) => {
      const result = await storage.read(key)
      return { body: result.body }
    },
    delete: (key) => storage.delete(key),
    urlFor: (key) => storage.urlFor(key),
  }
}

export function createWorkerCanvasAdapters(storage: CanvasRuntimeStorageAdapter) {
  return {
    repo: createWorkerRepoAdapter(),
    provider: createWorkerProviderAdapter(),
    ffmpeg: createWorkerFfmpegAdapter(),
    billing: createWorkerBillingAdapter(),
    storage,
  }
}
