// ===== 计费参数与模型定价（业务类型单一真源） =====
// 消除历史上 shared/models、billing/types、provider/models 的多份漂移定义。
// provider/models 的 ModelConfig.pricing 与 billing/calculate 均从此处消费同一份定义。

/**
 * 计费参数 — billing 计算所需的已知字段
 *
 * 从 ValidatedModelParameters 或 Record<string, unknown> 提取，
 * billing 包无法导入 provider branded type，故接受 Record 作为输入。
 */
export interface BillingParams {
  /** 图片生成数量（image 计费 unit 使用） */
  n?: number
  /** 视频时长秒数（video 计费 unit 使用） */
  duration?: number
  /** 视频分辨率（video 计费 unit 使用，720P/1080P） */
  resolution?: string
}

/**
 * 模型定价表项
 *
 * 价格单位（cents，整数分，金额权威值）：
 *  - 文本：inputPriceCents/outputPriceCents 每百万 Token 价格
 *  - 图片：inputPriceCents 每张价格
 *  - 视频：inputPriceCents 720P 每秒价格；inputPrice1080Cents 1080P 每秒价格
 *
 * unit 为可选：部分模型定价无明确计价单位（如纯展示型），消费方应容错处理。
 */
export interface ModelPricing {
  inputPriceCents: number
  outputPriceCents?: number
  inputPrice1080Cents?: number
  unit?: 'token' | 'image' | 'video' | 'audio'
  /** 定价备注（如「beta 期间免费」「仅展示」），供运营/文档展示 */
  note?: string
}
