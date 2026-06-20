import type { ModelPricing } from './types'

/**
 * 模型定价表（DashScope 官方定价）。
 *
 * - token:  每百万 token 的美分数
 * - image:  每张图片的美分数
 * - video:  每秒视频的美分数（按分辨率区分）
 * - audio:  每秒音频的美分数
 */

export const MODEL_PRICING: Record<string, ModelPricing> = {
  // === 图片生成 ===
  'qwen-image-2.0-pro': {
    unit: 'image',
    inputPriceCents: 25,
  },
  'qwen-image-2.0': {
    unit: 'image',
    inputPriceCents: 12,
  },
  'qwen-image-max': {
    unit: 'image',
    inputPriceCents: 20,
  },
  'qwen-image-plus': {
    unit: 'image',
    inputPriceCents: 8,
  },

  // === 视频生成 ===
  'wan2.7-t2v-2026-04-25': {
    unit: 'video',
    inputPriceCents: 60, // 720P: 60 cents/sec
    inputPrice1080Cents: 100, // 1080P: 100 cents/sec
  },
  'happyhorse-1.0-t2v': {
    unit: 'video',
    inputPriceCents: 90, // 720P: 90 cents/sec
    inputPrice1080Cents: 160, // 1080P: 160 cents/sec
  },
}

/** 获取模型定价，未知模型返回 undefined */
export function getModelPricing(modelId: string): ModelPricing | undefined {
  return MODEL_PRICING[modelId]
}
