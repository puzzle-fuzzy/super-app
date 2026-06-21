import { z } from 'zod'

// ===== 节点位置 =====

export const CanvasNodePositionSchema = z.object({
  x: z.number(),
  y: z.number(),
})

// ===== 节点（宽松验证，兼容新旧数据格式） =====
//
// tersa-style 节点使用 content/generated 双模格式
// 旧 super-app 节点使用 src/fileName/assetId 格式
// 这里使用宽松的 record schema 以兼容两种格式

export const CanvasNodeSchema = z.object({
  id: z.string(),
  type: z.string(),
  position: CanvasNodePositionSchema,
  data: z.record(z.unknown()),
})

export type CanvasNode = z.infer<typeof CanvasNodeSchema>

// ===== Edge =====

export const CanvasEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().optional(),
  targetHandle: z.string().optional(),
  animated: z.boolean().optional(),
  style: z.record(z.unknown()).optional(),
})

export type CanvasEdge = z.infer<typeof CanvasEdgeSchema>

// ===== Full document =====

export const CanvasDocumentDataSchema = z.object({
  nodes: z.array(CanvasNodeSchema),
  edges: z.array(CanvasEdgeSchema),
})

export type CanvasDocumentData = z.infer<typeof CanvasDocumentDataSchema>

// ============================================================
// 以下是旧版 schema，已注释 — 保留供参考
// ============================================================

/*
export const UploadStateSchema = z.object({
  progress: z.number().min(0).max(1),
  fileName: z.string(),
})

export const ImageNodeDataSchema = z.object({
  src: z.string(), fileName: z.string(), width: z.number().optional(), height: z.number().optional(),
  uploading: UploadStateSchema.optional(), groupId: z.string().optional(), assetId: z.string().optional(),
})

export const VideoNodeDataSchema = z.object({
  src: z.string(), fileName: z.string(), width: z.number().optional(), height: z.number().optional(),
  uploading: UploadStateSchema.optional(), groupId: z.string().optional(), assetId: z.string().optional(),
})

export const DocNodeDataSchema = z.object({
  src: z.string(), fileName: z.string(), fileSize: z.number(),
  groupId: z.string().optional(), assetId: z.string().optional(),
})

export const TextNodeDataSchema = z.object({
  description: z.string(), groupId: z.string().optional(),
})

export const GroupNodeDataSchema = z.object({
  label: z.string(), width: z.number(), height: z.number(),
})

export const CanvasNodeTypeSchema = z.enum(['imageNode','videoNode','docNode','textNode','groupNode'])
*/
