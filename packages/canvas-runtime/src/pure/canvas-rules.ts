// ===== Canvas 纯规则（从 shared/canvas.ts 迁入） =====
// 视频变体推荐 + 对白音频启发式判定。无 IO，client/server/worker 共用。

import type { CanvasVideoReference, CanvasVideoVariantRecommendation } from '@super-app/types'

/**
 * 纯规则：根据镜头参考引用推断视频生成变体（T2V/I2V/R2V）。
 *
 * 规则（与「按参考资产数量推荐」一致，并用 role 消除单图歧义）：
 * - 存在 role=firstFrame 的参考 → I2V（用户明确指定该图为视频首帧）
 * - 否则存在任意图片参考 → R2V（角色/场景一致性）
 * - 无参考 → T2V
 *
 * 本函数不感知「所选 base 模型是否真有对应变体」；真实 model id 解析与
 * 能力降级在 `@super-app/canvas-runtime` 的 `recommendCanvasVideoModel` 中完成。
 * UI 可直接调用此函数展示推荐原因，无需依赖 provider/model-configs。
 */
export function recommendCanvasVideoVariant(
  references: ReadonlyArray<CanvasVideoReference>,
): CanvasVideoVariantRecommendation {
  const imageRefs = references.filter(ref => Boolean(ref.url))

  if (imageRefs.some(ref => ref.role === 'firstFrame')) {
    return {
      variant: 'i2v',
      reason: '检测到首帧图，使用图生视频（I2V）以该图作为视频首帧',
    }
  }

  if (imageRefs.length >= 1) {
    return {
      variant: 'r2v',
      reason: `检测到 ${imageRefs.length} 张参考图，使用参考生视频（R2V）保证多主体一致`,
    }
  }

  return {
    variant: 't2v',
    reason: '未检测到参考图，使用文生视频（T2V）',
  }
}

// ===== 镜头对话音频启发式（纯规则，client/server/worker 共用） =====

/**
 * 启发式判定 narrative 是否含可触发 HappyHorse 原生对话音频的对白内容。
 *
 * 判定信号：出现成对的中文/英文引号对白标记 —— 「」『』""（含直角引号、
 * 中英文弯引号、英文双引号）。storyboard LLM 被要求把角色对白写进 narrative
 * 并用引号包裹（如 `小明：「我不能走」`），所以引号是「有对白」的可靠信号。
 *
 * 纯动作/环境镜头（narrative 仅描述动作画面，无引号）判定为无声 ——
 * 前端据此显示音频指示器，视频 prompt 生成时据此决定是否编排对话音频段。
 * 刻意不匹配 `Name:` 冒号形式，避免时间戳（如 `5s:`）和叙事冒号误判。
 */
export function hasDialogueAudio(narrative: string | null | undefined): boolean {
  if (!narrative || typeof narrative !== 'string')
    return false

  // 中文/英文成对引号任一出现即视为含对白。
  return /["""''「」『』]/u.test(narrative)
}
