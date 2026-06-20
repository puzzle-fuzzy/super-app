export type GenerationKind = 'image' | 'video'

export type ImageSize =
  | '2048*2048'
  | '2368*1728'
  | '1728*2368'
  | '1536*2688'
  | '2688*1536'
  | '1664*928'
  | '1472*1104'
  | '1328*1328'
  | '1104*1472'
  | '928*1664'

export type VideoRatio = '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '4:5' | '5:4' | '9:21' | '21:9'
export type VideoResolution = '720P' | '1080P'

export interface BaseGenerationModel {
  id: string
  label: string
  description: string
  kind: GenerationKind
}

export interface ImageGenerationModel extends BaseGenerationModel {
  kind: 'image'
  defaultSize: ImageSize
  sizes: readonly ImageSize[]
  supportsNegativePrompt: boolean
  supportsPromptExtend: boolean
  supportsSeed: boolean
}

export interface VideoGenerationModel extends BaseGenerationModel {
  kind: 'video'
  defaultRatio: VideoRatio
  ratios: readonly VideoRatio[]
  defaultResolution: VideoResolution
  resolutions: readonly VideoResolution[]
  defaultDuration: number
  minDuration: number
  maxDuration: number
  supportsNegativePrompt: boolean
  supportsPromptExtend: boolean
  supportsSeed: boolean
  supportsWatermark: boolean
}

export type GenerationModel = ImageGenerationModel | VideoGenerationModel

const QWEN_IMAGE_2_SIZES = [
  '2048*2048',
  '2368*1728',
  '1728*2368',
  '1536*2688',
  '2688*1536',
] as const

const QWEN_IMAGE_LEGACY_SIZES = [
  '1664*928',
  '1472*1104',
  '1328*1328',
  '1104*1472',
  '928*1664',
] as const

const WAN_VIDEO_RATIOS = ['16:9', '9:16', '1:1', '4:3', '3:4'] as const
const HAPPY_HORSE_RATIOS = ['16:9', '9:16', '1:1', '4:3', '3:4', '4:5', '5:4', '9:21', '21:9'] as const
const VIDEO_RESOLUTIONS = ['720P', '1080P'] as const

export const GENERATION_MODELS = [
  {
    id: 'qwen-image-2.0-pro',
    label: 'Qwen Image 2.0 Pro',
    description: '文字渲染、真实质感和语义遵循更强。',
    kind: 'image',
    defaultSize: '2048*2048',
    sizes: QWEN_IMAGE_2_SIZES,
    supportsNegativePrompt: true,
    supportsPromptExtend: true,
    supportsSeed: true,
  },
  {
    id: 'qwen-image-2.0',
    label: 'Qwen Image 2.0',
    description: '加速版，兼顾效果和响应速度。',
    kind: 'image',
    defaultSize: '2048*2048',
    sizes: QWEN_IMAGE_2_SIZES,
    supportsNegativePrompt: true,
    supportsPromptExtend: true,
    supportsSeed: true,
  },
  {
    id: 'qwen-image-max',
    label: 'Qwen Image Max',
    description: '真实感和自然度更强，固定单张输出。',
    kind: 'image',
    defaultSize: '1664*928',
    sizes: QWEN_IMAGE_LEGACY_SIZES,
    supportsNegativePrompt: true,
    supportsPromptExtend: true,
    supportsSeed: true,
  },
  {
    id: 'qwen-image-plus',
    label: 'Qwen Image Plus',
    description: '适合多样化艺术风格和文字渲染。',
    kind: 'image',
    defaultSize: '1664*928',
    sizes: QWEN_IMAGE_LEGACY_SIZES,
    supportsNegativePrompt: true,
    supportsPromptExtend: true,
    supportsSeed: true,
  },
  {
    id: 'wan2.7-t2v-2026-04-25',
    label: 'Wan 2.7 文生视频',
    description: '新版协议文生视频，支持多镜头叙事。',
    kind: 'video',
    defaultRatio: '16:9',
    ratios: WAN_VIDEO_RATIOS,
    defaultResolution: '720P',
    resolutions: VIDEO_RESOLUTIONS,
    defaultDuration: 5,
    minDuration: 2,
    maxDuration: 15,
    supportsNegativePrompt: true,
    supportsPromptExtend: true,
    supportsSeed: true,
    supportsWatermark: true,
  },
  {
    id: 'happyhorse-1.0-t2v',
    label: 'HappyHorse 文生视频',
    description: '物理真实、运动流畅的视频生成模型。',
    kind: 'video',
    defaultRatio: '16:9',
    ratios: HAPPY_HORSE_RATIOS,
    defaultResolution: '720P',
    resolutions: VIDEO_RESOLUTIONS,
    defaultDuration: 5,
    minDuration: 3,
    maxDuration: 15,
    supportsNegativePrompt: false,
    supportsPromptExtend: false,
    supportsSeed: true,
    supportsWatermark: true,
  },
] as const satisfies readonly GenerationModel[]

export type GenerationModelId = (typeof GENERATION_MODELS)[number]['id']

export const DEFAULT_GENERATION_MODEL_ID: GenerationModelId = 'qwen-image-2.0-pro'

export function getGenerationModel(id: string): GenerationModel | undefined {
  return GENERATION_MODELS.find((model) => model.id === id)
}

export function isImageGenerationModel(model: GenerationModel): model is ImageGenerationModel {
  return model.kind === 'image'
}

export function isVideoGenerationModel(model: GenerationModel): model is VideoGenerationModel {
  return model.kind === 'video'
}

export function imageSizeToAspectRatio(size: ImageSize): number {
  const [width, height] = size.split('*').map(Number)
  return width > 0 && height > 0 ? height / width : 1
}

export function videoRatioToAspectRatio(ratio: VideoRatio): number {
  const [width, height] = ratio.split(':').map(Number)
  return width > 0 && height > 0 ? height / width : 9 / 16
}
