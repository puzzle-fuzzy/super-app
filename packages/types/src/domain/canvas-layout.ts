// ===== 画布布局与资产领域类型 =====
// 纯数据接口，供 DB schema $type() 和 app/package 边界共用。

/**
 * 画布布局 — 前端 React Flow 节点位置/视口状态
 */
export interface CanvasLayoutPosition {
  x: number
  y: number
}

export interface CanvasLayoutViewport extends CanvasLayoutPosition {
  zoom: number
}

export interface CanvasLayoutNode {
  id: string
  type?: string
  position: CanvasLayoutPosition
  width?: number
  height?: number
  /** 前端 React Flow 节点数据 — 存储边界：backend 不解读此字段内容 */
  data?: Record<string, unknown>
}

export interface CanvasLayoutEdge {
  id: string
  source: string
  target: string
  type?: string
  /** 前端 React Flow 边数据 — 存储边界：backend 不解读此字段内容 */
  data?: Record<string, unknown>
}

export interface CanvasLayoutDto {
  nodes: CanvasLayoutNode[]
  edges: CanvasLayoutEdge[]
  viewport?: CanvasLayoutViewport
}

/** 用户可选择的模型类别偏好 */
export interface CanvasModelPreferences {
  textModel?: string
  imageModel?: string
  videoModel?: string
  /** 是否启用后端自动推进流水线阶段（Worker 完成一个阶段后自动创建下一个阶段的任务） */
  autoProgress?: boolean
}

// ===== Canvas Asset Domain Types =====

/**
 * Canvas 资产输出 — 存储在 canvas_assets.outputJson JSONB 中
 *
 * 根据 category 不同，输出形态不同：
 *   text 类（analysis/characterProfile/locationProfile/storyboard/continuityReport/videoPrompt）：
 *     type='json', data={...} 存储解析后的 LLM 输出
 *   image 类（characterPortrait/characterTurnaround/locationRef）：
 *     type='image', urls=[...] 存储 provider 返回的图片 URL 列表
 *   video 类（shotVideo）：
 *     type='video', urls=[...] 存储下载后的视频 URL
 */
export interface CanvasAssetOutput {
  type: 'text' | 'image' | 'video' | 'json'
  /** LLM 输出的文本内容（text 类型） */
  text?: string
  /** 图片/视频 URL 列表（image/video 类型） */
  urls?: string[]
  /** 结构化 JSON 数据（json 类型） */
  data?: Record<string, unknown>
}

// ===== Canvas Shot Reference Asset Types =====

/**
 * 镜头额外参考资产的语义角色 — 用户可理解的标签，本轮不强绑定 provider 参数
 */
export type CanvasShotReferenceRole
  = | 'character'
    | 'location'
    | 'style'
    | 'firstFrame'
    | 'other'

/**
 * 镜头额外参考资产 — 保存到 canvas_shots.referenceAssetsJson JSONB 中
 *
 * 用户可以在某个镜头上选择多个额外参考资产，生成/重试/重新生成镜头视频时
 * 合并到 referenceUrls（角色/场景自动引用在前，用户额外引用在后，去重）。
 */
export interface CanvasShotReferenceAsset {
  /** 统一资产 ID。早期允许 uploaded_files.id 或 canvas_assets.id */
  assetId: string
  /** 生成时直接可用的稳定 URL，优先 publicUrl */
  url: string
  /** 语义标签：角色图 / 场景图 / 风格图 / 首帧图 / 其他 */
  role: CanvasShotReferenceRole
  /** UI 展示标签，避免只显示 URL。可选，最大 100 字符 */
  label?: string
  /** 来源：资产库 / 上传文件 / 手动输入 */
  source?: 'asset_library' | 'uploaded_file' | 'manual'
}
