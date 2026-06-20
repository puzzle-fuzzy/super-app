/**
 * Canvas Runtime Adapter 工厂 — Worker 端
 *
 * 从真实的 @super-app/db / @super-app/provider / @super-app/storage / @super-app/ffmpeg
 * 组装 CanvasRuntimeAdapters，供 canvas-runtime phase 函数注入使用。
 *
 * 设计决策：
 * - CanvasRuntime*Adapter 接口有意使用宽类型（如 Record<string, unknown>）解耦 DB schema。
 *   真实实现使用 Drizzle 窄类型。adapt() 桥接二者，是 adapter 模式的必要类型擦除，非代码气味。
 * - 仅在签名结构匹配时省略 adapt()（如 FFmpeg concatVideos/mixBgmTrack 直接引用 typeof）。
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

/**
 * Adapter 边界桥接：将实现函数适配为接口类型。
 *
 * 接口有意使用宽类型（如 Record<string, unknown>）解耦 DB schema 细节。
 * 实现函数使用 Drizzle 窄类型（如 NewCanvasCharacter）。
 * 宽参数 → 窄参数在函数参数位逆变不安全，需通过此桥接擦除类型差。
 *
 * 返回 any 以便赋值到接口方法位；类型安全由接口定义方和调用方共同担保。
 */
// adapter 边界有意使用宽类型
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function adapt(fn: (...args: any[]) => any): any {
  return fn
}

export function createWorkerRepoAdapter(): CanvasRuntimeRepoAdapter {
  return {
    getCanvasProjectById: adapt(getCanvasProjectById),
    getCanvasProjectDetail: adapt(getCanvasProjectDetail),
    updateCanvasProject: adapt(updateCanvasProject),
    createCanvasCharacter: adapt(createCanvasCharacter),
    updateCanvasCharacter: adapt(updateCanvasCharacter),
    deleteCanvasCharactersByProject: adapt(deleteCanvasCharactersByProject),
    createCanvasLocation: adapt(createCanvasLocation),
    updateCanvasLocation: adapt(updateCanvasLocation),
    deleteCanvasLocationsByProject: adapt(deleteCanvasLocationsByProject),
    batchCreateCanvasShots: adapt(batchCreateCanvasShots),
    deleteCanvasShotsByProject: adapt(deleteCanvasShotsByProject),
    updateCanvasShot: adapt(updateCanvasShot),
    createContinuityReport: adapt(createContinuityReport),
    createCanvasAsset: adapt(createCanvasAsset),
    markCanvasAssetRunning: adapt(markCanvasAssetRunning),
    markCanvasAssetSucceeded: adapt(markCanvasAssetSucceeded),
    markCanvasAssetFailed,
    setCanvasAssetActive,
    bindCanvasAssetTaskId,
    createGenerationRecord: adapt(createGenerationRecord),
  }
}

export function createWorkerProviderAdapter(): CanvasRuntimeProviderAdapter {
  return {
    getModelById,
    validateAndMerge: adapt(validateAndMerge),
  }
}

export function createWorkerFfmpegAdapter(): CanvasRuntimeFfmpegAdapter {
  return { concatVideos, mixBgmTrack }
}

export function createWorkerBillingAdapter(): CanvasRuntimeBillingAdapter {
  return { calculateCost: adapt(calculateCost) }
}

export function createWorkerLlmAdapter(client: DashScopeClient): CanvasRuntimeLlmClient {
  return client as unknown as CanvasRuntimeLlmClient
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
