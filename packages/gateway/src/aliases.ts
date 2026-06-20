/**
 * 网关支持的文本模型列表（DashScope 真实模型名称）。
 */

/** 网关文本模型 */
export const GATEWAY_TEXT_MODELS = [
  { id: 'qwen-max', object: 'model', owned_by: 'dashscope' },
  { id: 'qwen-plus', object: 'model', owned_by: 'dashscope' },
  { id: 'qwen-turbo', object: 'model', owned_by: 'dashscope' },
]

/** 支持的文本模型 ID 集合（快速校验） */
const SUPPORTED_MODEL_IDS = new Set(GATEWAY_TEXT_MODELS.map((m) => m.id))

export function isTextModelSupported(model: string): boolean {
  return SUPPORTED_MODEL_IDS.has(model)
}
