/**
 * OpenAI 模型别名 → DashScope 模型 ID 映射。
 * 未匹配的模型名称直接透传。
 */
export const MODEL_ALIASES: Record<string, string> = {
  'gpt-4': 'qwen-max',
  'gpt-4o': 'qwen-max',
  'gpt-4-turbo': 'qwen-max',
  'gpt-3.5-turbo': 'qwen-turbo',
  'gpt-4o-mini': 'qwen-plus',
}

/** 解析别名，未知模型直接返回原名 */
export function resolveModelAlias(model: string): string {
  return MODEL_ALIASES[model] ?? model
}

/** 网关支持的文本模型列表（含别名） */
export const GATEWAY_TEXT_MODELS = [
  { id: 'qwen-max', object: 'model', owned_by: 'dashscope' },
  { id: 'qwen-plus', object: 'model', owned_by: 'dashscope' },
  { id: 'qwen-turbo', object: 'model', owned_by: 'dashscope' },
  { id: 'gpt-4', object: 'model', owned_by: 'dashscope' },
  { id: 'gpt-4o', object: 'model', owned_by: 'dashscope' },
  { id: 'gpt-4-turbo', object: 'model', owned_by: 'dashscope' },
  { id: 'gpt-3.5-turbo', object: 'model', owned_by: 'dashscope' },
  { id: 'gpt-4o-mini', object: 'model', owned_by: 'dashscope' },
]
