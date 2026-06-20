// ===== 对话 / R2V 领域类型 =====

/** 对话层结构化数据（Phase 8.5 dialogue 生成） */
export interface DialogueLine {
  speaker: string
  text: string
  emotion: string
  volume: string
}

export interface DialogueSoundEffect {
  type: string
  description: string
}

export interface DialogueJson {
  lines: DialogueLine[]
  soundEffects: DialogueSoundEffect[]
  ambientSound: string
}

/**
 * R2V 参考媒体条目 — buildR2VRequest 预算组装结果，存 canvas_shots.reference_media
 *
 * buildR2VRequest 把镜头的参考图按「主要角色 turnaround → 次要角色 portrait →
 * 关键场景 → 预留额外」优先级排序，裁剪到 DashScope R2V 上限（9 张）。
 * imageNumber 对应 R2V prompt 中的 [Image N] 指代（1-based，数组顺序）。
 */
export interface R2VReferenceMedia {
  url: string
  /** 参考类型：turnaround（主要角色三视图）/ portrait（次要角色）/ scene（场景）/ extra（预留） */
  kind: 'turnaround' | 'portrait' | 'scene' | 'extra'
  /** 对应角色 ID（kind=turnaround/portrait 时） */
  characterId?: string
  /** 对应场景 ID（kind=scene 时） */
  locationId?: string
  /** 在 R2V media[] 中的 1-based 序号，对应 prompt 的 [Image N] */
  imageNumber: number
}
