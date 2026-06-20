// ===== Subtitle 领域类型 =====

/**
 * 字幕句子 — ASR 转录后的最小编辑单元
 *
 * 从 Paraformer-v2 的 sentences[] 直接映射，
 * 用户可在编辑器中合并、拆分、修改文字和时间戳。
 */
export interface SubtitleSentence {
  /** 前端生成的唯一 ID（crypto.randomUUID 或 nanoid） */
  id: string
  /** 句子文本 */
  text: string
  /** 开始时间（毫秒） */
  beginTime: number
  /** 结束时间（毫秒） */
  endTime: number
  /** 说话人 ID（仅当 ASR 启用 diarization 时存在） */
  speakerId?: number
}

/**
 * 字幕样式配置 — 预设模板 + 微调参数
 *
 * 用户从预设模板中选择基础风格，然后可微调字号、颜色、位置等。
 * 导出时转换为 ASS 格式参数。
 */
export interface SubtitleStyleConfig {
  /** 预设模板 ID（如 'cinema', 'anime', 'variety' 等） */
  templateId: string
  /** 字号 */
  fontSize: number
  /** 字体颜色（HEX） */
  fontColor: string
  /** 描边颜色（HEX） */
  outlineColor: string
  /** 描边宽度（像素） */
  outlineWidth: number
  /** 垂直位置 */
  position: 'top' | 'center' | 'bottom'
  /** 垂直边距（像素） */
  marginV: number
  /** 是否加粗 */
  bold: boolean
}
