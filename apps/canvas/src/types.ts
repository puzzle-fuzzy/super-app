import type { Node } from '@xyflow/react'

// ========== 上传状态 ==========
export interface UploadState {
  progress: number // 0..1
  fileName: string
}

// ========== 图片节点 ==========
export interface ImageNodeData {
  src: string
  fileName: string
  width?: number
  height?: number
  uploading?: UploadState
  groupId?: string
  assetId?: string
  [key: string]: unknown
}
export type ImageNodeType = Node<ImageNodeData, 'imageNode'>

// ========== 视频节点 ==========
export interface VideoNodeData {
  src: string
  fileName: string
  width?: number
  height?: number
  uploading?: UploadState
  groupId?: string
  assetId?: string
  [key: string]: unknown
}
export type VideoNodeType = Node<VideoNodeData, 'videoNode'>

// ========== 文档节点 ==========
export interface DocNodeData {
  src: string
  fileName: string
  fileSize: number
  uploading?: UploadState
  groupId?: string
  assetId?: string
  [key: string]: unknown
}
export type DocNodeType = Node<DocNodeData, 'docNode'>

// ========== 文本节点 ==========
export interface TextNodeData {
  description: string
  groupId?: string
  [key: string]: unknown
}
export type TextNodeType = Node<TextNodeData, 'textNode'>

// ========== 小组节点 ==========
export interface GroupNodeData {
  label: string
  width: number
  height: number
  [key: string]: unknown
}
export type GroupNodeType = Node<GroupNodeData, 'groupNode'>

// ========== 联合类型 ==========
export type AppNode = ImageNodeType | VideoNodeType | DocNodeType | TextNodeType | GroupNodeType

// ========== API 响应 ==========
export interface UploadResponse {
  src: string
  fileName: string
  mediaType: 'image' | 'video' | 'document'
}

// ========== 数据访问辅助 ==========

/** 获取节点的 groupId（小组节点没有 groupId） */
export function getNodeGroupId(node: AppNode): string | undefined {
  if (node.type === 'groupNode') return undefined
  return (node.data as ImageNodeData).groupId
}

/** 设置节点的 groupId（小组节点忽略） */
export function setNodeGroupId(node: AppNode, groupId: string | undefined): AppNode {
  if (node.type === 'groupNode') return node
  return { ...node, data: { ...node.data, groupId } } as AppNode
}
