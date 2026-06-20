// ===== Task / Canvas Pipeline 产物领域类型 =====
// 任务输入输出信封 + LLM 档案结构（故事分析/角色/场景/镜头/连续性）。
// 纯数据接口，无运行时依赖。

/** 任务输入参数 — 结构随 task type 定义 */
export interface TaskInput {
  [key: string]: unknown
}

/** 任务输出结果 — 结构随 task type 定义 */
export interface TaskOutput {
  [key: string]: unknown
}

/** 任务错误信息 — 区分 retriable vs permanent */
export interface TaskErrorInfo {
  /** 错误分类（provider_error / timeout / validation / system） */
  category: string
  /** 是否可重试 */
  retriable: boolean
  /** 原始错误码（如 provider error code） */
  code?: string
  /** 错误详情 */
  message: string
  /** 重试延迟建议（ms） */
  retryDelayMs?: number
}

/** 故事分析结果 */
export interface NovelAnalysis {
  summary: string
  mainConflict: string
  timeline: string[]
  characterNames: string[]
  sceneNames: string[]
}

/** 角色档案（LLM 输出） */
export interface CharacterProfile {
  name: string
  role: string
  age: string
  gender: string
  bodyShape: string
  height: string
  face: { shape: string, eyes: string, eyebrows: string, nose: string, mouth: string, skin: string }
  hair: { color: string, style: string, length: string }
  costume: { mainColor: string, style: string, material: string, details: string[] }
  accessories: string[]
  identityPrompt: string
  negativePrompt: string
}

/** 场景档案（LLM 输出） */
export interface LocationProfile {
  name: string
  type: 'interior' | 'exterior' | 'mixed'
  location: string
  era: string
  atmosphere: string
  visualRules: {
    colorPalette: string[]
    lighting: string
    architecture: string
    floor: string
    backgroundElements: string[]
  }
  cameraRules: {
    axisDirection: string
    allowedAngles: string[]
    forbiddenAngles: string[]
  }
  scenePrompt: string
  negativePrompt: string
}

/** 镜头摄影参数（从 ShotDraft.camera 提取） */
export interface ShotCamera {
  shotSize: string
  angle: string
  movement: string
  lens: string
}

/** 镜头连续性参数（从 ShotDraft.continuity 提取） */
export interface ShotContinuity {
  screenDirection: string
  characterFacing: Record<string, string>
  actionStart: string
  actionEnd: string
  emotionStart: string
  emotionEnd: string
}

/** 镜头时间线条目（从 ShotDraft.timeline 提取） */
export interface ShotTimelineEntry {
  time: string
  action: string
}

/** 镜头环境参数（从 ShotDraft.environment 提取） */
export interface ShotEnvironment {
  backgroundMotion?: string
  lighting?: string
  mood?: string
  style?: string
}

/** 连续性问题 */
export interface ContinuityIssue {
  severity: 'error' | 'warning'
  shotId?: string
  shotIndex?: number
  code: 'MISSING_SCENE' | 'MISSING_CHARACTER' | 'FORBIDDEN_CAMERA_ANGLE'
    | 'FACING_CHANGE' | 'ACTION_MISMATCH' | 'EMOTION_MISMATCH'
  message: string
  suggestion?: string
}
