import type { Node } from '@xyflow/react'
import type { JSONContent } from '@tiptap/core'

// ============================================================
// tersa-style data shapes — 与 tersa 1:1 对齐
// ============================================================

// ── Drop 节点 ──

export interface DropNodeData {
  isSource?: boolean
  [key: string]: unknown
}
export type DropNodeType = Node<DropNodeData, 'dropNode'>

// ── 文本节点 ──

export interface TextNodeData {
  /** TipTap JSON content（原始模式） */
  content?: JSONContent
  /** TipTap 纯文本 */
  text?: string
  /** AI 生成结果 */
  generated?: {
    text: string
  }
  /** 选中的模型 ID */
  model?: string
  /** 生成指令（转换模式） */
  instructions?: string
  /** 最后更新时间 */
  updatedAt?: string
  [key: string]: unknown
}
export type TextNodeType = Node<TextNodeData, 'textNode'>

// ── 图片节点 ──

export interface ImageNodeData {
  /** 用户上传的图片（原始模式） */
  content?: {
    url: string
    type: string
  }
  /** AI 生成的图片（转换模式） */
  generated?: {
    url: string
    type: string
  }
  /** 图片宽度 */
  width?: number
  /** 图片高度 */
  height?: number
  /** 选中的模型 ID */
  model?: string
  /** AI 自动生成的图片描述 */
  description?: string
  /** 生成指令（转换模式） */
  instructions?: string
  /** 最后更新时间 */
  updatedAt?: string
  [key: string]: unknown
}
export type ImageNodeType = Node<ImageNodeData, 'imageNode'>

// ── 视频节点 ──

export interface VideoNodeData {
  /** 用户上传的视频（原始模式） */
  content?: {
    url: string
    type: string
  }
  /** AI 生成的视频（转换模式） */
  generated?: {
    url: string
    type: string
  }
  /** 视频宽度 */
  width?: number
  /** 视频高度 */
  height?: number
  /** 选中的模型 ID */
  model?: string
  /** 生成指令（转换模式） */
  instructions?: string
  /** 最后更新时间 */
  updatedAt?: string
  [key: string]: unknown
}
export type VideoNodeType = Node<VideoNodeData, 'videoNode'>

// ── 联合类型 ──

export type AppNode = ImageNodeType | VideoNodeType | TextNodeType | DropNodeType

// ============================================================
// 以下为旧版类型，已被 tersa-style 替换 — 保留供参考
// ============================================================

/*
export interface UploadState {
  progress: number
  fileName: string
}

export type GenerationStatus = 'queued' | 'submitting' | 'generating' | 'saving' | 'succeeded' | 'failed'

export interface ImageNodeData {
  src: string; fileName: string; width?: number; height?: number
  uploading?: UploadState; generationStatus?: GenerationStatus; errorMessage?: string
  groupId?: string; assetId?: string; assetSource?: AssetSource; assetOrigin?: AssetOrigin
  generationRecordId?: string; taskId?: string; [key: string]: unknown
}

export interface DocNodeData {
  src: string; fileName: string; fileSize: number
  uploading?: UploadState; groupId?: string; assetId?: string; [key: string]: unknown
}

export interface TextNodeData { description: string; groupId?: string; [key: string]: unknown }
export interface GroupNodeData { label: string; width: number; height: number; [key: string]: unknown }
export type GroupNodeType = Node<GroupNodeData, 'groupNode'>
export type DocNodeType = Node<DocNodeData, 'docNode'>

export function getNodeGroupId(node: AppNode): string | undefined { ... }
export function setNodeGroupId(node: AppNode, groupId: string | undefined): AppNode { ... }
*/
