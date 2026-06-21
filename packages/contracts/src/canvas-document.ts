import { z } from 'zod'

// ===== Upload state =====

export const UploadStateSchema = z.object({
  progress: z.number().min(0).max(1),
  fileName: z.string(),
})

// ===== Node data (5 types) =====

export const ImageNodeDataSchema = z.object({
  src: z.string(),
  fileName: z.string(),
  width: z.number().optional(),
  height: z.number().optional(),
  uploading: UploadStateSchema.optional(),
  groupId: z.string().optional(),
  assetId: z.string().optional(),
})

export const VideoNodeDataSchema = z.object({
  src: z.string(),
  fileName: z.string(),
  width: z.number().optional(),
  height: z.number().optional(),
  uploading: UploadStateSchema.optional(),
  groupId: z.string().optional(),
  assetId: z.string().optional(),
})

export const DocNodeDataSchema = z.object({
  src: z.string(),
  fileName: z.string(),
  fileSize: z.number(),
  groupId: z.string().optional(),
  assetId: z.string().optional(),
})

export const TextNodeDataSchema = z.object({
  description: z.string(),
  groupId: z.string().optional(),
})

export const GroupNodeDataSchema = z.object({
  label: z.string(),
  width: z.number(),
  height: z.number(),
})

// ===== Node position =====

export const CanvasNodePositionSchema = z.object({
  x: z.number(),
  y: z.number(),
})

// ===== Node union =====

export const CanvasNodeTypeSchema = z.enum([
  'imageNode',
  'videoNode',
  'docNode',
  'textNode',
  'groupNode',
])

export const CanvasNodeSchema = z.object({
  id: z.string(),
  type: CanvasNodeTypeSchema,
  position: CanvasNodePositionSchema,
  data: z.union([
    ImageNodeDataSchema,
    VideoNodeDataSchema,
    DocNodeDataSchema,
    TextNodeDataSchema,
    GroupNodeDataSchema,
  ]),
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
