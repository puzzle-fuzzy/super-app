/**
 * 模型目录 API
 *
 * GET /api/models — 返回所有可用 AI 模型（含定价、参数、分类）
 */
import { GENERATION_MODELS } from '@super-app/ai-models'
import { getModelPricing } from '@super-app/billing'
import { GATEWAY_TEXT_MODELS } from '@super-app/gateway'
import { Elysia } from 'elysia'

import { authPlugin, requireUser } from '../../plugins/auth'
import { ok } from '../../shared/response'

export const modelsModule = new Elysia({ name: 'models', detail: { tags: ['模型'] } })
  .use(authPlugin)
  .guard({ beforeHandle: requireUser }, (guarded) =>
    guarded.get('/models', async () => {
      // 文本模型（来自 gateway）
      const textModels = GATEWAY_TEXT_MODELS.map((m) => {
        const pricing = getModelPricing(m.id)
        return {
          id: m.id,
          label: labelForModel(m.id),
          category: 'text' as const,
          description: descriptionForModel(m.id),
          pricing: pricing
            ? {
                unit: pricing.unit,
                inputPriceCents: pricing.inputPriceCents,
                outputPriceCents: pricing.outputPriceCents,
              }
            : null,
        }
      })

      // 图片/视频模型（来自 ai-models）
      const mediaModels = GENERATION_MODELS.map((m) => {
        const pricing = getModelPricing(m.id)
        return {
          id: m.id,
          label: m.label,
          category: m.kind,
          description: m.description,
          ...(m.kind === 'image'
            ? { defaultSize: m.defaultSize, sizes: m.sizes }
            : {}),
          ...(m.kind === 'video'
            ? {
                defaultRatio: m.defaultRatio,
                ratios: m.ratios,
                defaultResolution: m.defaultResolution,
                resolutions: m.resolutions,
                defaultDuration: m.defaultDuration,
                minDuration: m.minDuration,
                maxDuration: m.maxDuration,
              }
            : {}),
          pricing: pricing
            ? {
                unit: pricing.unit,
                inputPriceCents: pricing.inputPriceCents,
                ...(pricing.inputPrice1080Cents
                  ? { inputPrice1080Cents: pricing.inputPrice1080Cents }
                  : {}),
                ...(pricing.outputPriceCents
                  ? { outputPriceCents: pricing.outputPriceCents }
                  : {}),
              }
            : null,
        }
      })

      return ok({
        models: [...textModels, ...mediaModels],
      })
    })
  )

function labelForModel(id: string): string {
  const labels: Record<string, string> = {
    'qwen-max': '千问 Max',
    'qwen-plus': '千问 Plus',
    'qwen-turbo': '千问 Turbo',
  }
  return labels[id] ?? id
}

function descriptionForModel(id: string): string {
  const descs: Record<string, string> = {
    'qwen-max': '最强模型，适合复杂推理和长文本',
    'qwen-plus': '性价比最优，平衡效果和速度',
    'qwen-turbo': '超高速响应，适合简单任务',
  }
  return descs[id] ?? ''
}
