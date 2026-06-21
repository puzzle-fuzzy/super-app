import type { LucideIcon } from 'lucide-react'
import {
  Box,
  File as FileIcon,
  FileText,
  ImageIcon,
  Link2,
  Music,
  Type as TypeIcon,
  Video,
} from 'lucide-react'

import type { AssetDto, AssetKind } from '@super-app/contracts/assets'
import type { SubjectType } from '@super-app/contracts/subject-assets'
import type { StyleType } from '@super-app/contracts/style-assets'
import type { TemplateType } from '@super-app/contracts/template-assets'
import type { TextType } from '@super-app/contracts/text-assets'
import { formatFileSize } from '@super-app/utils'

// ---------------------------------------------------------------------------
// Filter types & constants
// ---------------------------------------------------------------------------

export type FilterKind = 'all' | AssetKind

export interface FilterOption {
  value: FilterKind
  label: string
  helper: string
  disabled?: boolean
}

export const FILTERS: FilterOption[] = [
  { value: 'all', label: '全部', helper: '所有资产' },
  { value: 'image', label: '图片', helper: '视觉素材' },
  { value: 'video', label: '视频', helper: '动态素材' },
  { value: 'audio', label: '音频', helper: '声音素材' },
  { value: 'file', label: '文件', helper: '文档附件' },
  { value: 'text', label: '文本', helper: '提示词和备注' },
  { value: 'subject', label: '主体', helper: '人物和商品' },
  { value: 'style', label: '风格', helper: '可复用生成风格' },
  { value: 'template', label: '模板', helper: '可复用结构' },
]

// ---------------------------------------------------------------------------
// Type option lists (used in Select components)
// ---------------------------------------------------------------------------

export const TEXT_TYPE_OPTIONS: { value: TextType; label: string }[] = [
  { value: 'prompt', label: '提示词' },
  { value: 'novel', label: '小说片段' },
  { value: 'script', label: '脚本' },
  { value: 'subtitle', label: '字幕' },
  { value: 'note', label: '备注' },
  { value: 'dialogue', label: '对白' },
  { value: 'setting', label: '设定' },
  { value: 'other', label: '其他' },
]

export const SUBJECT_TYPE_OPTIONS: { value: SubjectType; label: string }[] = [
  { value: 'person', label: '人物' },
  { value: 'character', label: '角色' },
  { value: 'product', label: '商品' },
  { value: 'pet', label: '宠物' },
  { value: 'object', label: '物品' },
  { value: 'scene', label: '场景' },
  { value: 'other', label: '其他' },
]

export const STYLE_TYPE_OPTIONS: { value: StyleType; label: string }[] = [
  { value: 'visual', label: '视觉' },
  { value: 'video', label: '视频' },
  { value: 'writing', label: '写作' },
  { value: 'audio', label: '音频' },
  { value: 'ui', label: '界面' },
  { value: 'mixed', label: '混合' },
]

export const TEMPLATE_TYPE_OPTIONS: { value: TemplateType; label: string }[] = [
  { value: 'canvas', label: '画布' },
  { value: 'generation', label: '生成工作流' },
  { value: 'video_storyboard', label: '视频分镜' },
  { value: 'prompt', label: '提示词' },
  { value: 'page', label: '页面' },
  { value: 'poster', label: '海报' },
  { value: 'workflow', label: '工作流' },
]

export const CONSISTENCY_OPTIONS = [
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
] as const

export const LANGUAGE_OPTIONS = [
  { value: 'zh', label: '中文' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'es', label: 'Español' },
  { value: 'other', label: '其他' },
]

// ---------------------------------------------------------------------------
// CSS class strings
// ---------------------------------------------------------------------------

export const surfaceButton =
  'inline-flex h-10 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-colors active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45'

export const primaryButton = `${surfaceButton} bg-white px-4 text-[#141414] hover:bg-neutral-200`

export const secondaryButton = `${surfaceButton} border border-[#2a2a2a] bg-[#1c1c1c] px-3.5 text-[#e5e5e5] hover:border-[#3a3a3a] hover:bg-[#2a2a2a]`

export const menuItem =
  'flex h-9 w-full cursor-pointer appearance-none items-center justify-start gap-2.5 rounded-[7px] border-0 bg-transparent px-2.5 text-left font-sans text-[13px] font-medium leading-[13px] text-[#999999] no-underline hover:bg-[#2a2a2a] hover:text-[#e5e5e5] disabled:cursor-not-allowed disabled:opacity-45 [&_svg]:size-[15px] [&_svg]:shrink-0'

export const modalBackdrop =
  'fixed inset-0 z-50 grid place-items-center bg-black/70 p-[22px]'

export const modalPanel =
  'max-h-[90vh] w-[min(680px,100%)] rounded-[14px] border border-[#3a3a3a] bg-[#1c1c1c] p-6'

export const panelKicker = 'm-0 text-xs font-bold text-[#666666]'

export const panelTitle =
  'mt-2.5 text-2xl font-bold leading-tight tracking-[-0.02em] text-[#e5e5e5]'

export const fieldClass = 'grid gap-[7px]'

export const fieldLabel = 'text-[13px] font-semibold text-[#999999]'

export const fieldControl =
  'w-full resize-y rounded-[10px] border border-[#2a2a2a] bg-[#242424] px-3 py-[11px] text-[#e5e5e5] outline-none focus:border-[#3a3a3a]'

// ---------------------------------------------------------------------------
// Pure helper functions
// ---------------------------------------------------------------------------

export function assetLabel(asset: AssetDto): string {
  const file = asset.files.find((item) => item.role === 'original') ?? asset.files[0]
  const parts = [assetKindLabel(asset.kind)]

  if (file?.width && file?.height) {
    parts.push(`${file.width} × ${file.height}`)
  }
  if (file?.size) {
    parts.push(formatFileSize(file.size))
  }

  parts.push(formatDate(asset.createdAt))
  return parts.join(' · ')
}

export function assetSummary(asset: AssetDto): string {
  if (asset.description) {
    return asset.description
  }

  const labels: Record<AssetKind, string> = {
    image: '视觉参考、画面草稿或生成结果，可用于画布和后续创作。',
    video: '动态素材已归档，可以快速分享或在局域网内传输。',
    audio: '声音素材，可作为剪辑、配音或环境声参考。',
    text: '提示词、设定、脚本或备注文本，适合继续编辑复用。',
    subject: '人物、商品、场景或物体主体，用于保持生成一致性。',
    file: '文档、压缩包或附件资料，保留原始文件便于下载。',
    style: '风格参考资产。',
    template: '模板资产。',
  }

  return labels[asset.kind]
}

export function assetKindLabel(kind: AssetKind): string {
  const labels: Record<AssetKind, string> = {
    image: '图片',
    video: '视频',
    audio: '音频',
    file: '文件',
    text: '文本',
    subject: '主体',
    style: '风格',
    template: '模板',
  }

  return labels[kind]
}

export function iconForAsset(kind: AssetKind): LucideIcon {
  const icons: Record<AssetKind, LucideIcon> = {
    image: ImageIcon,
    video: Video,
    audio: Music,
    file: FileIcon,
    text: TypeIcon,
    subject: Box,
    style: Link2,
    template: FileText,
  }

  return icons[kind]
}

export function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
  })
}
