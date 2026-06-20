import { useEffect, useRef, useState } from 'react'
import { Modal, Select } from '@super-app/ui-react'
import {
  Box,
  Check,
  Copy,
  Download,
  Ellipsis,
  File as FileIcon,
  FileText,
  Grid3X3,
  House,
  ImageIcon,
  LayoutTemplate,
  Link2,
  LogOut,
  Music,
  Palette,
  Plus,
  Save,
  Search,
  Send,
  Share2,
  Trash2,
  Type as TypeIcon,
  Upload,
  UserRound,
  Video,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import type { AssetDto, AssetKind } from '@super-app/contracts/assets'
import type { AssetTransferSessionDto } from '@super-app/contracts/assets'
import type {
  CreateSubjectAssetRequest,
  SubjectAssetDetailDto,
  SubjectType,
  UpdateSubjectAssetRequest,
} from '@super-app/contracts/subject-assets'
import type {
  CreateStyleAssetRequest,
  StyleAssetDetailDto,
  StyleType,
  UpdateStyleAssetRequest,
} from '@super-app/contracts/style-assets'
import type {
  CreateTemplateAssetRequest,
  TemplateAssetDetailDto,
  TemplateType,
  UpdateTemplateAssetRequest,
} from '@super-app/contracts/template-assets'
import type {
  CreateTextAssetRequest,
  TextAssetDetailDto,
  TextType,
  UpdateTextAssetRequest,
} from '@super-app/contracts/text-assets'
import { assetsApi, stylesApi, subjectsApi, templatesApi, textsApi } from '@super-app/api-client'
import { logout } from '@super-app/auth-client'
import { useRequireAuth } from '@super-app/auth-client/react'
import { clientEnv } from '@super-app/env/client'

type FilterKind = 'all' | AssetKind

interface FilterOption {
  value: FilterKind
  label: string
  helper: string
  disabled?: boolean
}

const FILTERS: FilterOption[] = [
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

const TEXT_TYPE_OPTIONS: { value: TextType; label: string }[] = [
  { value: 'prompt', label: '提示词' },
  { value: 'novel', label: '小说片段' },
  { value: 'script', label: '脚本' },
  { value: 'subtitle', label: '字幕' },
  { value: 'note', label: '备注' },
  { value: 'dialogue', label: '对白' },
  { value: 'setting', label: '设定' },
  { value: 'other', label: '其他' },
]

const SUBJECT_TYPE_OPTIONS: { value: SubjectType; label: string }[] = [
  { value: 'person', label: '人物' },
  { value: 'character', label: '角色' },
  { value: 'product', label: '商品' },
  { value: 'pet', label: '宠物' },
  { value: 'object', label: '物品' },
  { value: 'scene', label: '场景' },
  { value: 'other', label: '其他' },
]

const STYLE_TYPE_OPTIONS: { value: StyleType; label: string }[] = [
  { value: 'visual', label: '视觉' },
  { value: 'video', label: '视频' },
  { value: 'writing', label: '写作' },
  { value: 'audio', label: '音频' },
  { value: 'ui', label: '界面' },
  { value: 'mixed', label: '混合' },
]

const TEMPLATE_TYPE_OPTIONS: { value: TemplateType; label: string }[] = [
  { value: 'canvas', label: '画布' },
  { value: 'generation', label: '生成工作流' },
  { value: 'video_storyboard', label: '视频分镜' },
  { value: 'prompt', label: '提示词' },
  { value: 'page', label: '页面' },
  { value: 'poster', label: '海报' },
  { value: 'workflow', label: '工作流' },
]

const CONSISTENCY_OPTIONS = [
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
] as const

const LANGUAGE_OPTIONS = [
  { value: 'zh', label: '中文' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'es', label: 'Español' },
  { value: 'other', label: '其他' },
]

const surfaceButton =
  'inline-flex h-10 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-colors active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45'
const primaryButton = `${surfaceButton} bg-white px-4 text-[#141414] hover:bg-neutral-200`
const secondaryButton = `${surfaceButton} border border-[#2a2a2a] bg-[#1c1c1c] px-3.5 text-[#e5e5e5] hover:border-[#3a3a3a] hover:bg-[#2a2a2a]`
const menuItem =
  'flex h-9 w-full cursor-pointer appearance-none items-center justify-start gap-2.5 rounded-[7px] border-0 bg-transparent px-2.5 text-left font-sans text-[13px] font-medium leading-[13px] text-[#999999] no-underline hover:bg-[#2a2a2a] hover:text-[#e5e5e5] disabled:cursor-not-allowed disabled:opacity-45 [&_svg]:size-[15px] [&_svg]:shrink-0'
const modalBackdrop = 'fixed inset-0 z-50 grid place-items-center bg-black/70 p-[22px]'
const modalPanel =
  'max-h-[90vh] w-[min(680px,100%)] rounded-[14px] border border-[#3a3a3a] bg-[#1c1c1c] p-6'
const panelKicker = 'm-0 text-xs font-bold text-[#666666]'
const panelTitle = 'mt-2.5 text-2xl font-bold leading-tight tracking-[-0.02em] text-[#e5e5e5]'
const fieldClass = 'grid gap-[7px]'
const fieldLabel = 'text-[13px] font-semibold text-[#999999]'
const fieldControl =
  'w-full resize-y rounded-[10px] border border-[#2a2a2a] bg-[#242424] px-3 py-[11px] text-[#e5e5e5] outline-none focus:border-[#3a3a3a]'

interface TextEditorState {
  kind: 'text'
  id?: string
  title: string
  textType: TextType
  content: string
  language: string
}

interface SubjectEditorState {
  kind: 'subject'
  id?: string
  title: string
  subjectType: SubjectType
  displayName: string
  identityPrompt: string
  appearancePrompt: string
  negativePrompt: string
  consistencyLevel: 'low' | 'medium' | 'high'
}

interface StyleEditorState {
  kind: 'style'
  id?: string
  title: string
  styleType: StyleType
  positivePrompt: string
  negativePrompt: string
  recommendedModel: string
  // JSON fields edited as text; parsed on save.
  colorPalette: string
  recommendedParams: string
}

interface TemplateEditorState {
  kind: 'template'
  id?: string
  title: string
  templateType: TemplateType
  // JSON field edited as text; parsed on save.
  templateData: string
}

type EditorState =
  | TextEditorState
  | SubjectEditorState
  | StyleEditorState
  | TemplateEditorState
  | null

interface TransferNotice {
  assetId: string
  pageUrl: string
  expiresAt: string
  status: string
}

export function AssetsApp() {
  const { user, isLoading, error } = useRequireAuth()
  const [filter, setFilter] = useState<FilterKind>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [items, setItems] = useState<AssetDto[]>([])
  const [isListLoading, setIsListLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const [editor, setEditor] = useState<EditorState>(null)
  const [pendingDelete, setPendingDelete] = useState<AssetDto | null>(null)
  const [transferNotice, setTransferNotice] = useState<TransferNotice | null>(null)
  const [sharingAssetId, setSharingAssetId] = useState<string | null>(null)
  const [transferringAssetId, setTransferringAssetId] = useState<string | null>(null)
  const [openActionAssetId, setOpenActionAssetId] = useState<string | null>(null)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const activeTransferRef = useRef<ReturnType<typeof startAssetTransferSender> | null>(null)

  const kind = filter === 'all' ? undefined : filter
  const activeFilter = FILTERS.find((option) => option.value === filter) ?? FILTERS[0]
  const visibleItems = items.filter((item) =>
    item.title.toLowerCase().includes(searchQuery.trim().toLowerCase())
  )

  useEffect(() => {
    if (!user) return

    let active = true
    setListError(null)
    setIsListLoading(true)

    assetsApi
      .list({ kind })
      .then((res) => {
        if (!active) return
        setItems(res.items)
      })
      .catch((err) => {
        if (active) {
          setListError(err instanceof Error ? err.message : '加载资产失败')
        }
      })
      .finally(() => {
        if (active) {
          setIsListLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [user, kind])

  useEffect(() => {
    if (!openActionAssetId) return

    function closeOnOutsidePointer(event: PointerEvent) {
      const target = event.target
      if (target instanceof Element && target.closest('[data-asset-action-root]')) {
        return
      }
      setOpenActionAssetId(null)
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpenActionAssetId(null)
      }
    }

    document.addEventListener('pointerdown', closeOnOutsidePointer)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [openActionAssetId])

  useEffect(() => {
    if (!userMenuOpen) return

    function closeOnOutsidePointer(event: PointerEvent) {
      const target = event.target
      if (target instanceof Element && target.closest('[data-user-menu-root]')) {
        return
      }
      setUserMenuOpen(false)
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setUserMenuOpen(false)
      }
    }

    document.addEventListener('pointerdown', closeOnOutsidePointer)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [userMenuOpen])

  if (isLoading) {
    return <StateScreen title="正在确认登录状态" description="Super 正在连接资产中心。" />
  }

  if (error || !user) {
    return <StateScreen title="需要登录" description="正在跳转到统一登录中心。" />
  }

  function openNewText() {
    setEditor({ kind: 'text', title: '', textType: 'prompt', content: '', language: 'zh' })
  }

  function openNewSubject() {
    setEditor({
      kind: 'subject',
      title: '',
      subjectType: 'person',
      displayName: '',
      identityPrompt: '',
      appearancePrompt: '',
      negativePrompt: '',
      consistencyLevel: 'medium',
    })
  }

  function openNewStyle() {
    setEditor({
      kind: 'style',
      title: '',
      styleType: 'visual',
      positivePrompt: '',
      negativePrompt: '',
      recommendedModel: '',
      colorPalette: '',
      recommendedParams: '',
    })
  }

  function openNewTemplate() {
    setEditor({
      kind: 'template',
      title: '',
      templateType: 'prompt',
      templateData: '',
    })
  }

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    if (files.length === 0) return

    setUploading(true)
    setUploadProgress(files.length > 1 ? `0/${files.length}` : null)
    setListError(null)

    try {
      const createdAssets: AssetDto[] = []
      let failedCount = 0
      let shouldReloadList = false

      for (let index = 0; index < files.length; index++) {
        const file = files[index]!
        setUploadProgress(files.length > 1 ? `${index + 1}/${files.length}` : null)

        try {
          const created = await assetsApi.upload(file)
          if (kind && created.kind !== kind) {
            shouldReloadList = true
          } else {
            createdAssets.push(created)
          }
        } catch {
          failedCount += 1
        }
      }

      if (shouldReloadList) {
        const res = await assetsApi.list({ kind })
        setItems(res.items)
      } else if (createdAssets.length > 0) {
        setItems((prev) => [...createdAssets.reverse(), ...prev])
      }

      if (failedCount > 0) {
        setListError(
          files.length === failedCount
            ? '上传失败'
            : `${files.length} 个文件中有 ${failedCount} 个上传失败`
        )
      }
    } catch (err) {
      setListError(err instanceof Error ? err.message : '上传失败')
    } finally {
      setUploading(false)
      setUploadProgress(null)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return

    const asset = pendingDelete
    setListError(null)

    try {
      await assetsApi.remove(asset.id)
      setItems((prev) => prev.filter((item) => item.id !== asset.id))
      setPendingDelete(null)
    } catch (err) {
      setListError(err instanceof Error ? err.message : '删除失败')
    }
  }

  async function handleCreateShareLink(asset: AssetDto) {
    setSharingAssetId(asset.id)
    setListError(null)

    try {
      const share = await assetsApi.createShareLink(asset.id)
      await copyToClipboard(share.url)
      setTransferNotice({
        assetId: asset.id,
        pageUrl: share.url,
        expiresAt: share.expiresAt ?? '',
        status: '分享链接已复制，可直接发给对方下载。',
      })
    } catch (err) {
      setListError(err instanceof Error ? err.message : '创建分享链接失败')
    } finally {
      setSharingAssetId(null)
    }
  }

  async function handleStartTransfer(asset: AssetDto) {
    const original = asset.files.find((file) => file.role === 'original')
    if (!original) {
      setListError('这个资产没有可传输的原始文件')
      return
    }

    setTransferringAssetId(asset.id)
    setListError(null)
    activeTransferRef.current?.close()

    try {
      const session = await assetsApi.createTransferSession(asset.id)
      const file = await assetFileFromUrl(original.url, asset.title, original.mimeType)
      activeTransferRef.current = startAssetTransferSender(session, file, (status) => {
        setTransferNotice({
          assetId: asset.id,
          pageUrl: session.pageUrl,
          expiresAt: session.expiresAt,
          status,
        })
      })
      await copyToClipboard(session.pageUrl)
      setTransferNotice({
        assetId: asset.id,
        pageUrl: session.pageUrl,
        expiresAt: session.expiresAt,
        status: '局域网传输链接已复制，3 分钟内打开即可接收。',
      })
    } catch (err) {
      setListError(err instanceof Error ? err.message : '创建传输失败')
    } finally {
      setTransferringAssetId(null)
    }
  }

  function openEditText(asset: AssetDto) {
    setListError(null)
    textsApi
      .get(asset.id)
      .then((detail: TextAssetDetailDto) => {
        setEditor({
          kind: 'text',
          id: detail.id,
          title: detail.title,
          textType: detail.textType,
          content: detail.content,
          language: detail.language ?? '',
        })
      })
      .catch((err) => setListError(err instanceof Error ? err.message : '加载文本失败'))
  }

  function openEditSubject(asset: AssetDto) {
    setListError(null)
    subjectsApi
      .get(asset.id)
      .then((detail: SubjectAssetDetailDto) => {
        setEditor({
          kind: 'subject',
          id: detail.id,
          title: detail.title,
          subjectType: detail.subjectType,
          displayName: detail.displayName ?? '',
          identityPrompt: detail.identityPrompt ?? '',
          appearancePrompt: detail.appearancePrompt ?? '',
          negativePrompt: detail.negativePrompt ?? '',
          consistencyLevel: detail.consistencyLevel,
        })
      })
      .catch((err) => setListError(err instanceof Error ? err.message : '加载主体失败'))
  }

  function openEditStyle(asset: AssetDto) {
    setListError(null)
    stylesApi
      .get(asset.id)
      .then((detail: StyleAssetDetailDto) => {
        setEditor({
          kind: 'style',
          id: detail.id,
          title: detail.title,
          styleType: detail.styleType,
          positivePrompt: detail.positivePrompt ?? '',
          negativePrompt: detail.negativePrompt ?? '',
          recommendedModel: detail.recommendedModel ?? '',
          colorPalette: detail.colorPalette ? JSON.stringify(detail.colorPalette) : '',
          recommendedParams: detail.recommendedParams
            ? JSON.stringify(detail.recommendedParams)
            : '',
        })
      })
      .catch((err) => setListError(err instanceof Error ? err.message : '加载风格失败'))
  }

  function openEditTemplate(asset: AssetDto) {
    setListError(null)
    templatesApi
      .get(asset.id)
      .then((detail: TemplateAssetDetailDto) => {
        setEditor({
          kind: 'template',
          id: detail.id,
          title: detail.title,
          templateType: detail.templateType,
          templateData: detail.templateData ? JSON.stringify(detail.templateData) : '',
        })
      })
      .catch((err) => setListError(err instanceof Error ? err.message : '加载模板失败'))
  }

  async function saveEditor() {
    if (!editor) return

    setSaving(true)
    setListError(null)

    try {
      if (editor.kind === 'text') {
        if (!editor.title.trim() || !editor.content.trim()) {
          throw new Error('标题和正文不能为空')
        }

        if (editor.id) {
          const updated = await textsApi.update(editor.id, {
            title: editor.title,
            textType: editor.textType,
            content: editor.content,
            language: editor.language || undefined,
          } as UpdateTextAssetRequest)
          setItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)))
        } else {
          const created = await textsApi.create({
            title: editor.title,
            textType: editor.textType,
            content: editor.content,
            language: editor.language || undefined,
          } as CreateTextAssetRequest)
          if (!kind || created.kind === kind) {
            setItems((prev) => [created, ...prev])
          }
        }
      } else if (editor.kind === 'subject') {
        if (!editor.title.trim()) {
          throw new Error('标题不能为空')
        }

        if (editor.id) {
          const updated = await subjectsApi.update(editor.id, {
            title: editor.title,
            subjectType: editor.subjectType,
            displayName: editor.displayName || undefined,
            identityPrompt: editor.identityPrompt || undefined,
            appearancePrompt: editor.appearancePrompt || undefined,
            negativePrompt: editor.negativePrompt || undefined,
            consistencyLevel: editor.consistencyLevel,
          } as UpdateSubjectAssetRequest)
          setItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)))
        } else {
          const created = await subjectsApi.create({
            title: editor.title,
            subjectType: editor.subjectType,
            displayName: editor.displayName || undefined,
            identityPrompt: editor.identityPrompt || undefined,
            appearancePrompt: editor.appearancePrompt || undefined,
            negativePrompt: editor.negativePrompt || undefined,
            consistencyLevel: editor.consistencyLevel,
          } as CreateSubjectAssetRequest)
          if (!kind || created.kind === kind) {
            setItems((prev) => [created, ...prev])
          }
        }
      } else if (editor.kind === 'style') {
        // style
        if (!editor.title.trim()) {
          throw new Error('标题不能为空')
        }

        const parseJson = (text: string): Record<string, unknown> => {
          const trimmed = text.trim()
          if (!trimmed) return {}
          try {
            const parsed = JSON.parse(trimmed)
            if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
              throw new Error('JSON 必须是对象')
            }
            return parsed as Record<string, unknown>
          } catch (e) {
            throw new Error('调色板/参数 JSON 格式错误：' + (e as Error).message)
          }
        }

        const colorPalette = parseJson(editor.colorPalette)
        const recommendedParams = parseJson(editor.recommendedParams)

        const payload = {
          title: editor.title,
          styleType: editor.styleType,
          positivePrompt: editor.positivePrompt || undefined,
          negativePrompt: editor.negativePrompt || undefined,
          recommendedModel: editor.recommendedModel || undefined,
          colorPalette,
          recommendedParams,
        }

        if (editor.id) {
          const updated = await stylesApi.update(editor.id, payload as UpdateStyleAssetRequest)
          setItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)))
        } else {
          const created = await stylesApi.create(payload as CreateStyleAssetRequest)
          if (!kind || created.kind === kind) {
            setItems((prev) => [created, ...prev])
          }
        }
      } else {
        // template
        if (!editor.title.trim()) {
          throw new Error('标题不能为空')
        }

        const parseTemplateJson = (text: string): Record<string, unknown> => {
          const trimmed = text.trim()
          if (!trimmed) return {}
          try {
            const parsed = JSON.parse(trimmed)
            if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
              throw new Error('JSON 必须是对象')
            }
            return parsed as Record<string, unknown>
          } catch (e) {
            throw new Error('模板数据 JSON 格式错误：' + (e as Error).message)
          }
        }

        const templateData = parseTemplateJson(editor.templateData)
        const payload = {
          title: editor.title,
          templateType: editor.templateType,
          templateData,
        }

        if (editor.id) {
          const updated = await templatesApi.update(
            editor.id,
            payload as UpdateTemplateAssetRequest
          )
          setItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)))
        } else {
          const created = await templatesApi.create(payload as CreateTemplateAssetRequest)
          if (!kind || created.kind === kind) {
            setItems((prev) => [created, ...prev])
          }
        }
      }
      setEditor(null)
    } catch (err) {
      setListError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function handleLogout() {
    await logout()
    window.location.assign(clientEnv.SUPER_PUBLIC_AUTH_APP_URL)
  }

  return (
    <main className="min-h-screen bg-[#141414] text-[#e5e5e5]">
      <section
        className="mx-auto w-full max-w-[1800px] px-8 py-8 pb-16 max-[920px]:px-[18px] max-[920px]:py-6 max-[620px]:px-3.5 max-[620px]:py-5"
        aria-label="资产中心"
      >
        <header className="mb-7">
          <div className="flex items-end justify-between gap-6 max-[920px]:flex-col max-[920px]:items-stretch">
            <div>
              <h1 className="m-0 text-2xl font-bold leading-tight tracking-[-0.02em] text-[#e5e5e5]">
                素材库
              </h1>
              <p className="mt-1.5 text-sm leading-normal text-[#999999]">
                管理和浏览你的所有创意资产
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 max-[920px]:flex-wrap max-[920px]:justify-start">
              <label className="relative flex w-[min(100%,264px)] items-center max-[920px]:w-full">
                <Search
                  className="pointer-events-none absolute left-3 text-[#666666]"
                  size={16}
                  aria-hidden="true"
                />
                <input
                  className="h-[42px] w-full rounded-lg border border-[#2a2a2a] bg-[#1c1c1c] py-0 pr-3.5 pl-[38px] text-sm text-[#e5e5e5] outline-none transition-colors placeholder:text-[#666666] focus:border-[#3a3a3a]"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="搜索素材..."
                />
              </label>
              <button
                type="button"
                className={primaryButton}
                onClick={() => fileInput.current?.click()}
                disabled={uploading}
              >
                <Upload size={16} aria-hidden="true" />
                {uploading
                  ? uploadProgress
                    ? `上传中 ${uploadProgress}`
                    : '上传中...'
                  : '上传素材'}
              </button>
              <button type="button" className={secondaryButton} onClick={openNewText}>
                <FileText size={16} aria-hidden="true" />
                新建文本
              </button>
              <button type="button" className={secondaryButton} onClick={openNewSubject}>
                <UserRound size={16} aria-hidden="true" />
                新建主体
              </button>
              <button type="button" className={secondaryButton} onClick={openNewStyle}>
                <Palette size={16} aria-hidden="true" />
                新建风格
              </button>
              <button type="button" className={secondaryButton} onClick={openNewTemplate}>
                <LayoutTemplate size={16} aria-hidden="true" />
                新建模板
              </button>
              <a
                href={clientEnv.SUPER_PUBLIC_WORKSPACE_APP_URL}
                className="inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-[#2a2a2a] bg-[#1c1c1c] text-[#999999] no-underline transition-colors hover:border-[#3a3a3a] hover:bg-[#2a2a2a] hover:text-[#e5e5e5]"
                aria-label="首页"
                title="首页"
              >
                <House size={16} aria-hidden="true" />
              </a>
              <div className="relative" data-user-menu-root>
                <button
                  type="button"
                  className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-lg border border-[#2a2a2a] bg-[#1c1c1c] text-[#999999] transition-colors hover:border-[#3a3a3a] hover:bg-[#2a2a2a] hover:text-[#e5e5e5]"
                  onClick={() => setUserMenuOpen((prev) => !prev)}
                  aria-label="打开用户菜单"
                  aria-expanded={userMenuOpen}
                  aria-haspopup="true"
                >
                  {user.avatarUrl ? (
                    <img
                      className="h-7 w-7 rounded-full object-cover"
                      src={user.avatarUrl}
                      alt=""
                    />
                  ) : (
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-[#2a2a2a] text-[#999999]">
                      <UserRound size={14} aria-hidden="true" />
                    </span>
                  )}
                </button>
                <div
                  className={`absolute top-full right-0 z-50 mt-2 min-w-52 overflow-hidden rounded-[10px] border border-[#3a3a3a] bg-[#1d1d1d] p-1.5 shadow-[0_12px_32px_rgb(0_0_0_/_0.42)] ${
                    userMenuOpen ? 'grid' : 'hidden'
                  }`}
                >
                  <div className="grid gap-1 border-b border-[#2a2a2a] px-2.5 py-2.5">
                    <strong className="truncate text-[13px] leading-tight font-semibold text-[#e5e5e5]">
                      {user.name ?? 'Super 用户'}
                    </strong>
                    <span className="truncate text-xs leading-tight text-[#666666]">
                      {user.email}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setUserMenuOpen(false)
                      handleLogout()
                    }}
                    className={`${menuItem} mt-1`}
                  >
                    <LogOut size={15} aria-hidden="true" />
                    退出登录
                  </button>
                </div>
              </div>
            </div>
          </div>
          <input
            ref={fileInput}
            className="absolute h-px w-px overflow-hidden whitespace-nowrap [clip:rect(0_0_0_0)]"
            type="file"
            multiple
            onChange={handleUpload}
            disabled={uploading}
          />
        </header>

        <nav
          className="mb-6 flex items-end gap-[18px] overflow-x-auto border-b border-[#2a2a2a] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden max-[620px]:flex-col max-[620px]:items-stretch max-[620px]:gap-0"
          aria-label="资产视图"
        >
          <div className="flex min-w-max items-end" role="tablist" aria-label="资产类型">
            {FILTERS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-label={option.label}
                aria-selected={filter === option.value}
                disabled={option.disabled}
                className={`inline-flex min-h-12 cursor-pointer items-center whitespace-nowrap border-b-2 bg-transparent px-5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
                  filter === option.value
                    ? 'border-[#e5e5e5] text-[#e5e5e5]'
                    : 'border-transparent text-[#999999] hover:text-[#e5e5e5]'
                }`}
                onClick={() => !option.disabled && setFilter(option.value)}
              >
                <span>{option.label}</span>
              </button>
            ))}
          </div>
          <div
            className="ml-auto flex items-center gap-1 py-2.5 max-[620px]:ml-0"
            aria-label="视图模式"
          >
            <button
              type="button"
              className="inline-flex min-h-8 cursor-default items-center gap-1.5 rounded-md bg-[#242424] px-2.5 text-xs text-[#e5e5e5]"
            >
              <Grid3X3 size={14} aria-hidden="true" />
              网格
            </button>
          </div>
        </nav>

        <section
          className="mb-[18px] flex items-center justify-between gap-4 text-[#666666] max-[620px]:flex-col max-[620px]:items-start"
          aria-label="当前集合"
        >
          <div className="flex items-baseline gap-2.5">
            <span className="text-[13px]">正在浏览</span>
            <strong className="text-[15px] font-semibold text-[#e5e5e5]">
              {isListLoading ? '同步中' : `${visibleItems.length} 个素材`}
            </strong>
          </div>
          <p className="m-0 text-[13px]">
            {activeFilter.label} · {activeFilter.helper}
          </p>
        </section>

        {listError ? (
          <p className="mb-[18px] rounded-[10px] border border-[rgb(255_138_128_/_0.36)] bg-[rgb(255_138_128_/_0.1)] p-3.5 text-sm leading-normal text-[#ffd8d4]">
            {listError}
          </p>
        ) : null}

        <section className="min-w-0">
          {isListLoading ? (
            <LoadingState />
          ) : visibleItems.length === 0 ? (
            <EmptyState filter={filter} onNewText={openNewText} onNewSubject={openNewSubject} />
          ) : (
            <section
              className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 max-[620px]:grid-cols-1"
              aria-label="资产列表"
            >
              {visibleItems.map((asset) => (
                <AssetCard
                  asset={asset}
                  key={asset.id}
                  onDelete={() => setPendingDelete(asset)}
                  onEdit={() => {
                    if (asset.kind === 'text') openEditText(asset)
                    if (asset.kind === 'subject') openEditSubject(asset)
                    if (asset.kind === 'style') openEditStyle(asset)
                    if (asset.kind === 'template') openEditTemplate(asset)
                  }}
                  onShare={() => handleCreateShareLink(asset)}
                  onTransfer={() => handleStartTransfer(asset)}
                  sharing={sharingAssetId === asset.id}
                  transferring={transferringAssetId === asset.id}
                  menuOpen={openActionAssetId === asset.id}
                  onToggleMenu={() =>
                    setOpenActionAssetId((current) => (current === asset.id ? null : asset.id))
                  }
                  onCloseMenu={() => setOpenActionAssetId(null)}
                />
              ))}
            </section>
          )}
        </section>
      </section>

      {editor ? (
        <EditorPanel
          editor={editor}
          saving={saving}
          setEditor={setEditor}
          onCancel={() => setEditor(null)}
          onSave={saveEditor}
        />
      ) : null}

      {pendingDelete ? (
        <DeleteConfirm
          asset={pendingDelete}
          onCancel={() => setPendingDelete(null)}
          onConfirm={confirmDelete}
        />
      ) : null}

      {transferNotice ? (
        <TransferNoticeDialog notice={transferNotice} onClose={() => setTransferNotice(null)} />
      ) : null}
    </main>
  )
}

function AssetCard({
  asset,
  onDelete,
  onEdit,
  onShare,
  onTransfer,
  sharing,
  transferring,
  menuOpen,
  onToggleMenu,
  onCloseMenu,
}: {
  asset: AssetDto
  onDelete: () => void
  onEdit: () => void
  onShare: () => void
  onTransfer: () => void
  sharing: boolean
  transferring: boolean
  menuOpen: boolean
  onToggleMenu: () => void
  onCloseMenu: () => void
}) {
  const canEdit =
    asset.kind === 'text' ||
    asset.kind === 'subject' ||
    asset.kind === 'style' ||
    asset.kind === 'template'
  const canTransfer = asset.files.some((file) => file.role === 'original')
  const originalFile = asset.files.find((file) => file.role === 'original') ?? asset.files[0]
  const isMedia = asset.kind === 'image' || asset.kind === 'video'
  const Icon = iconForAsset(asset.kind)

  return (
    <article
      className={`relative rounded-xl border border-[#2a2a2a] bg-[#1c1c1c] transition-colors hover:border-[#3a3a3a] hover:bg-[#202020] ${
        menuOpen ? 'z-30' : 'z-0'
      }`}
    >
      <div className="min-w-0">
        <div className="relative aspect-[4/3] rounded-t-xl bg-[#242424]">
          {isMedia ? (
            <>
              <AssetPreview asset={asset} />
              {asset.kind === 'video' ? (
                <span className="absolute inset-0 grid place-items-center text-white">
                  <Video
                    className="box-content h-5 w-5 rounded-full border border-white/20 bg-white/15 p-3.5"
                    size={18}
                    aria-hidden="true"
                  />
                </span>
              ) : null}
            </>
          ) : (
            <div className="flex h-full flex-col overflow-hidden rounded-t-xl p-5">
              <span className="mb-4 grid h-[38px] w-[38px] place-items-center rounded-[9px] border border-[#2a2a2a] bg-[#1c1c1c] text-[#999999]">
                <Icon size={18} aria-hidden="true" />
              </span>
              <span className="text-xs font-bold tracking-[0.08em] text-[#666666] uppercase">
                {assetKindLabel(asset.kind)}
              </span>
              <p className="mt-2.5 line-clamp-4 flex-1 overflow-hidden text-[13px] leading-[1.7] text-[#777777]">
                {assetSummary(asset)}
              </p>
            </div>
          )}
          <AssetActions
            canEdit={canEdit}
            downloadUrl={originalFile?.url}
            canTransfer={canTransfer}
            onDelete={onDelete}
            onEdit={onEdit}
            onShare={onShare}
            onTransfer={onTransfer}
            sharing={sharing}
            transferring={transferring}
            menuOpen={menuOpen}
            onToggleMenu={onToggleMenu}
            onCloseMenu={onCloseMenu}
            dark={isMedia}
          />
        </div>
        <span className="grid min-w-0 gap-1 px-3.5 py-3.5">
          <strong className="overflow-hidden text-ellipsis whitespace-nowrap text-sm font-semibold leading-normal text-[#e5e5e5]">
            {asset.title}
          </strong>
          <small className="overflow-hidden text-ellipsis whitespace-nowrap text-xs text-[#666666]">
            {assetLabel(asset)}
          </small>
        </span>
      </div>
    </article>
  )
}

function AssetActions({
  canEdit,
  downloadUrl,
  canTransfer,
  onDelete,
  onEdit,
  onShare,
  onTransfer,
  sharing,
  transferring,
  menuOpen,
  onToggleMenu,
  onCloseMenu,
  dark,
}: {
  canEdit: boolean
  downloadUrl?: string
  canTransfer: boolean
  onDelete: () => void
  onEdit: () => void
  onShare: () => void
  onTransfer: () => void
  sharing: boolean
  transferring: boolean
  menuOpen: boolean
  onToggleMenu: () => void
  onCloseMenu: () => void
  dark?: boolean
}) {
  function runAction(action: () => void) {
    onCloseMenu()
    action()
  }

  return (
    <div className="absolute bottom-2.5 left-2.5 z-[3]">
      <div className="relative" data-asset-action-root>
        <button
          type="button"
          aria-label="更多操作"
          title="更多操作"
          aria-expanded={menuOpen}
          onClick={onToggleMenu}
          className={`grid h-8 w-8 place-items-center rounded-sm transition-colors cursor-pointer ${
            dark
              ? 'bg-black/55 text-[#d4d4d4] hover:bg-black/75'
              : 'bg-[#242424] text-[#999999] hover:bg-[#2a2a2a] hover:text-[#e5e5e5]'
          }`}
        >
          <Ellipsis size={16} aria-hidden="true" />
        </button>
        <div
          className={`absolute bottom-10 left-0 z-50 min-w-36 overflow-hidden rounded-[10px] border border-[#3a3a3a] bg-[#1d1d1d] p-1.5 shadow-[0_12px_32px_rgb(0_0_0_/_0.42)] ${
            menuOpen ? 'grid' : 'hidden'
          }`}
        >
          {canTransfer ? (
            <button
              className={menuItem}
              type="button"
              onClick={() => runAction(onTransfer)}
              disabled={transferring}
            >
              <Send size={15} aria-hidden="true" />
              {transferring ? '创建中' : '传输'}
            </button>
          ) : null}
          <button
            className={menuItem}
            type="button"
            onClick={() => runAction(onShare)}
            disabled={sharing || !canTransfer}
          >
            <Share2 size={15} aria-hidden="true" />
            {sharing ? '创建中' : '分享'}
          </button>
          {downloadUrl ? (
            <a className={menuItem} href={downloadUrl} download target="_blank" rel="noreferrer">
              <Download size={15} aria-hidden="true" />
              下载
            </a>
          ) : null}
          {canEdit ? (
            <button className={menuItem} type="button" onClick={() => runAction(onEdit)}>
              <FileText size={15} aria-hidden="true" />
              重命名
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => runAction(onDelete)}
            className={`${menuItem} text-[#ffaaa3] hover:bg-[#3a1f1d] hover:text-[#ffb8b2]`}
          >
            <Trash2 size={15} aria-hidden="true" />
            删除
          </button>
        </div>
      </div>
    </div>
  )
}

function TransferNoticeDialog({
  notice,
  onClose,
}: {
  notice: TransferNotice
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    copyToClipboard(notice.pageUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className={modalBackdrop} role="dialog" aria-label="传输分享">
      <div className={`${modalPanel} overflow-auto w-[min(440px,100%)]`}>
        <p className={panelKicker}>传输分享</p>
        <h2 className={panelTitle}>链接已准备好</h2>
        <p className="text-sm leading-relaxed text-[#999999]">{notice.status}</p>
        <code className="my-4 block [overflow-wrap:anywhere] rounded-[10px] border border-[#2a2a2a] bg-[#242424] p-3 text-[13px] leading-normal text-[#e5e5e5]">
          {notice.pageUrl}
        </code>
        {notice.expiresAt ? (
          <p className="text-sm leading-relaxed text-[#999999]">
            有效期至 {new Date(notice.expiresAt).toLocaleTimeString()}
          </p>
        ) : null}
        <div className="mt-1 flex flex-wrap justify-end gap-2">
          <button className={secondaryButton} type="button" onClick={onClose}>
            关闭
          </button>
          <button className={primaryButton} type="button" onClick={handleCopy} disabled={copied}>
            {copied ? (
              <>
                <Check size={15} aria-hidden="true" />
                已复制
              </>
            ) : (
              <>
                <Copy size={15} aria-hidden="true" />
                复制链接
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

function AssetPreview({ asset }: { asset: AssetDto }) {
  if (asset.thumbnailUrl || asset.kind === 'image') {
    return (
      <span className="grid h-full w-full place-items-center overflow-hidden rounded-t-xl bg-[#242424]">
        <img
          className="h-full w-full object-cover transition-transform duration-200 hover:scale-[1.025]"
          src={asset.thumbnailUrl ?? asset.files[0]?.url}
          alt={asset.title}
          loading="lazy"
        />
      </span>
    )
  }

  return (
    <span className="grid h-full w-full place-items-center overflow-hidden rounded-t-xl bg-[#242424]">
      <span className="grid h-[52px] w-[52px] place-items-center rounded-xl border border-[#2a2a2a] bg-[#242424] text-[15px] font-bold text-[#999999]">
        {assetKindLabel(asset.kind).slice(0, 2)}
      </span>
    </span>
  )
}

function EditorPanel({
  editor,
  saving,
  setEditor,
  onCancel,
  onSave,
}: {
  editor: Exclude<EditorState, null>
  saving: boolean
  setEditor: (editor: Exclude<EditorState, null>) => void
  onCancel: () => void
  onSave: () => void
}) {
  return (
    <Modal open onClose={onCancel}>
      <Modal.Header
        kicker="创作编辑"
        title={
          (editor.id ? '编辑' : '新建') +
          (editor.kind === 'text'
            ? '文本'
            : editor.kind === 'subject'
              ? '主体'
              : editor.kind === 'style'
                ? '风格'
                : '模板')
        }
      />
      <Modal.Body>
        <div className="grid gap-[15px]">
          <label className={fieldClass}>
            <span className={fieldLabel}>标题</span>
            <input
              className={fieldControl}
              value={editor.title}
              onChange={(event) => setEditor({ ...editor, title: event.target.value })}
            />
          </label>

          {editor.kind === 'text' ? (
            <TextEditorFields editor={editor} setEditor={setEditor} />
          ) : editor.kind === 'subject' ? (
            <SubjectEditorFields editor={editor} setEditor={setEditor} />
          ) : editor.kind === 'style' ? (
            <StyleEditorFields editor={editor} setEditor={setEditor} />
          ) : (
            <TemplateEditorFields editor={editor} setEditor={setEditor} />
          )}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <button className={secondaryButton} type="button" onClick={onCancel} disabled={saving}>
          取消
        </button>
        <button className={primaryButton} type="button" onClick={onSave} disabled={saving}>
          <Save size={15} aria-hidden="true" />
          {saving ? '保存中...' : '保存'}
        </button>
      </Modal.Footer>
    </Modal>
  )
}

function TextEditorFields({
  editor,
  setEditor,
}: {
  editor: TextEditorState
  setEditor: (editor: TextEditorState) => void
}) {
  return (
    <>
      <div className={fieldClass}>
        <span className={fieldLabel}>类型</span>
        <Select
          options={TEXT_TYPE_OPTIONS}
          value={editor.textType}
          onChange={(value) => setEditor({ ...editor, textType: value as TextType })}
        />
      </div>
      <div className={fieldClass}>
        <span className={fieldLabel}>语言</span>
        <Select
          options={LANGUAGE_OPTIONS}
          value={editor.language || 'zh'}
          onChange={(value) => setEditor({ ...editor, language: value })}
        />
      </div>
      <label className={fieldClass}>
        <span className={fieldLabel}>正文</span>
        <textarea
          className={`${fieldControl} leading-relaxed`}
          rows={12}
          value={editor.content}
          onChange={(event) => setEditor({ ...editor, content: event.target.value })}
        />
      </label>
    </>
  )
}

function SubjectEditorFields({
  editor,
  setEditor,
}: {
  editor: SubjectEditorState
  setEditor: (editor: SubjectEditorState) => void
}) {
  return (
    <>
      <div className={fieldClass}>
        <span className={fieldLabel}>主体类型</span>
        <Select
          options={SUBJECT_TYPE_OPTIONS}
          value={editor.subjectType}
          onChange={(value) => setEditor({ ...editor, subjectType: value as SubjectType })}
        />
      </div>
      <label className={fieldClass}>
        <span className={fieldLabel}>显示名称</span>
        <input
          className={fieldControl}
          value={editor.displayName}
          onChange={(event) => setEditor({ ...editor, displayName: event.target.value })}
        />
      </label>
      <label className={fieldClass}>
        <span className={fieldLabel}>身份提示词</span>
        <textarea
          className={`${fieldControl} leading-relaxed`}
          rows={3}
          value={editor.identityPrompt}
          onChange={(event) => setEditor({ ...editor, identityPrompt: event.target.value })}
        />
      </label>
      <label className={fieldClass}>
        <span className={fieldLabel}>外观提示词</span>
        <textarea
          className={`${fieldControl} leading-relaxed`}
          rows={3}
          value={editor.appearancePrompt}
          onChange={(event) => setEditor({ ...editor, appearancePrompt: event.target.value })}
        />
      </label>
      <label className={fieldClass}>
        <span className={fieldLabel}>负面提示词</span>
        <textarea
          className={`${fieldControl} leading-relaxed`}
          rows={3}
          value={editor.negativePrompt}
          onChange={(event) => setEditor({ ...editor, negativePrompt: event.target.value })}
        />
      </label>
      <div className={fieldClass}>
        <span className={fieldLabel}>一致性</span>
        <Select
          options={[...CONSISTENCY_OPTIONS]}
          value={editor.consistencyLevel}
          onChange={(value) =>
            setEditor({
              ...editor,
              consistencyLevel: value as 'low' | 'medium' | 'high',
            })
          }
        />
      </div>
    </>
  )
}

function StyleEditorFields({
  editor,
  setEditor,
}: {
  editor: StyleEditorState
  setEditor: (editor: StyleEditorState) => void
}) {
  return (
    <>
      <div className={fieldClass}>
        <span className={fieldLabel}>风格类型</span>
        <Select
          options={STYLE_TYPE_OPTIONS}
          value={editor.styleType}
          onChange={(value) => setEditor({ ...editor, styleType: value as StyleType })}
        />
      </div>
      <label className={fieldClass}>
        <span className={fieldLabel}>正向提示词</span>
        <textarea
          className={`${fieldControl} leading-relaxed`}
          rows={3}
          value={editor.positivePrompt}
          onChange={(event) => setEditor({ ...editor, positivePrompt: event.target.value })}
        />
      </label>
      <label className={fieldClass}>
        <span className={fieldLabel}>负面提示词</span>
        <textarea
          className={`${fieldControl} leading-relaxed`}
          rows={3}
          value={editor.negativePrompt}
          onChange={(event) => setEditor({ ...editor, negativePrompt: event.target.value })}
        />
      </label>
      <label className={fieldClass}>
        <span className={fieldLabel}>推荐模型（可选）</span>
        <input
          className={fieldControl}
          value={editor.recommendedModel}
          onChange={(event) => setEditor({ ...editor, recommendedModel: event.target.value })}
        />
      </label>
      <label className={fieldClass}>
        <span className={fieldLabel}>调色板 JSON（可选，如 {`{"warm":["#d4a574"]}`})</span>
        <textarea
          className={`${fieldControl} font-mono text-[13px] leading-relaxed`}
          rows={3}
          value={editor.colorPalette}
          onChange={(event) => setEditor({ ...editor, colorPalette: event.target.value })}
        />
      </label>
      <label className={fieldClass}>
        <span className={fieldLabel}>推荐参数 JSON（可选，如 {`{"steps":30}`})</span>
        <textarea
          className={`${fieldControl} font-mono text-[13px] leading-relaxed`}
          rows={3}
          value={editor.recommendedParams}
          onChange={(event) => setEditor({ ...editor, recommendedParams: event.target.value })}
        />
      </label>
    </>
  )
}

function TemplateEditorFields({
  editor,
  setEditor,
}: {
  editor: TemplateEditorState
  setEditor: (editor: TemplateEditorState) => void
}) {
  return (
    <>
      <div className={fieldClass}>
        <span className={fieldLabel}>模板类型</span>
        <Select
          options={TEMPLATE_TYPE_OPTIONS}
          value={editor.templateType}
          onChange={(value) => setEditor({ ...editor, templateType: value as TemplateType })}
        />
      </div>
      <label className={fieldClass}>
        <span className={fieldLabel}>模板数据 JSON（可选，如 {`{"nodes":[],"layers":[]}`})</span>
        <textarea
          className={`${fieldControl} font-mono text-[13px] leading-relaxed`}
          rows={8}
          value={editor.templateData}
          onChange={(event) => setEditor({ ...editor, templateData: event.target.value })}
        />
      </label>
    </>
  )
}

function DeleteConfirm({
  asset,
  onCancel,
  onConfirm,
}: {
  asset: AssetDto
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className={modalBackdrop} role="dialog" aria-label="删除确认">
      <div className={`${modalPanel} overflow-auto w-[min(440px,100%)]`}>
        <p className={panelKicker}>确认删除</p>
        <h2 className={panelTitle}>删除「{asset.title}」？</h2>
        <p className="text-sm leading-relaxed text-[#999999]">
          这个素材会从当前列表移除。之后的恢复能力会在资产回收站阶段加入。
        </p>
        <div className="mt-1 flex flex-wrap justify-end gap-2">
          <button className={secondaryButton} type="button" onClick={onCancel}>
            取消
          </button>
          <button className={primaryButton} type="button" onClick={onConfirm}>
            确认删除
          </button>
        </div>
      </div>
    </div>
  )
}

function EmptyState({
  filter,
  onNewText,
  onNewSubject,
}: {
  filter: FilterKind
  onNewText: () => void
  onNewSubject: () => void
}) {
  return (
    <section className="grid min-h-[420px] place-items-center bg-transparent px-6 py-14 text-center">
      <div className="max-w-[440px]">
        <p className={panelKicker}>空素材库</p>
        <h2 className="mt-2.5 text-[26px] font-bold leading-tight tracking-[-0.02em] text-[#e5e5e5]">
          还没有资产
        </h2>
        <p className="text-sm leading-relaxed text-[#999999]">
          先上传一张参考图，或者写下第一段提示词，让这里变成你的创作素材库。
        </p>
        <div>
          <button
            className={`${primaryButton} mt-[18px]`}
            type="button"
            onClick={filter === 'subject' ? onNewSubject : onNewText}
          >
            <Plus size={16} aria-hidden="true" />
            {filter === 'subject' ? '创建第一个主体' : '写第一段文本'}
          </button>
        </div>
      </div>
    </section>
  )
}

function LoadingState() {
  return (
    <section
      className="flex min-h-[260px] items-center justify-center gap-2.5 text-sm text-[#999999]"
      aria-label="资产加载中"
    >
      <span
        className="h-4 w-4 animate-spin rounded-full border-2 border-[#3a3a3a] border-t-[#e5e5e5]"
        aria-hidden="true"
      />
      <p className="m-0">正在加载素材...</p>
    </section>
  )
}

function StateScreen({ title, description }: { title: string; description: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#141414] p-10 text-center">
      <div>
        <p className={panelKicker}>Super 素材库</p>
        <h1 className="mt-2.5 text-[28px] font-bold leading-tight tracking-[-0.02em] text-[#e5e5e5]">
          {title}
        </h1>
        <p className="text-[#999999]">{description}</p>
      </div>
    </main>
  )
}

function assetLabel(asset: AssetDto) {
  const file = asset.files.find((item) => item.role === 'original') ?? asset.files[0]
  const parts = [assetKindLabel(asset.kind)]

  if (file?.width && file?.height) {
    parts.push(`${file.width} × ${file.height}`)
  }
  if (file?.size) {
    parts.push(formatBytes(file.size))
  }

  parts.push(formatDate(asset.createdAt))
  return parts.join(' · ')
}

function assetSummary(asset: AssetDto) {
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

function assetKindLabel(kind: AssetKind) {
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

function iconForAsset(kind: AssetKind): LucideIcon {
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

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`
  return `${(size / 1024 / 1024 / 1024).toFixed(1)} GB`
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
  })
}

async function assetFileFromUrl(url: string, title: string, mimeType?: string): Promise<File> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error('读取资产文件失败')
  }
  const blob = await response.blob()
  return new File([blob], title, { type: mimeType || blob.type || 'application/octet-stream' })
}

async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(text)
  }
}

function startAssetTransferSender(
  session: AssetTransferSessionDto,
  file: File,
  onStatus: (status: string) => void
) {
  const socket = new WebSocket(session.wsUrl)
  const connections = new Map<string, RTCPeerConnection>()
  const transferIdsByPeer = new Map<string, string>()
  let selfPeerId: string | null = null
  let closed = false

  const closeTimer = window.setTimeout(
    () => {
      close()
      onStatus('传输窗口已过期。需要重新创建链接。')
    },
    Math.max(new Date(session.expiresAt).getTime() - Date.now(), 0)
  )

  socket.addEventListener('open', () => {
    onStatus('等待接收设备打开链接。')
  })

  socket.addEventListener('message', (event) => {
    const message = parseSignalingMessage(event.data)
    if (!message) return

    if (message.type === 'peer-id') {
      selfPeerId = (message.payload as { id: string }).id
      return
    }

    if (message.type === 'peers') {
      const ids = (message.payload as { ids: string[] }).ids.filter((id) => id !== selfPeerId)
      ids.forEach((peerId) => sendFileOffer(peerId))
      return
    }

    if (message.type === 'peer-joined') {
      const peerId = (message.payload as { id: string }).id
      if (peerId !== selfPeerId) {
        sendFileOffer(peerId)
      }
      return
    }

    if (message.type === 'receiver-ready') {
      const peerId = message.from
      if (peerId && peerId !== selfPeerId) {
        sendFileOffer(peerId)
      }
      return
    }

    if (message.type === 'file-accept') {
      const peerId = message.from
      const transferId = (message.payload as { transferId: string }).transferId
      if (peerId) {
        void sendFileToPeer(peerId, transferId)
      }
      return
    }

    if (message.type === 'webrtc-signal') {
      const peerId = message.from
      if (!peerId) return
      const payload = message.payload as {
        transferId: string
        signal: { type: string; sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit }
      }
      const connection = connections.get(peerId)
      if (!connection) return

      if (payload.signal.type === 'answer' && payload.signal.sdp) {
        void connection.setRemoteDescription(new RTCSessionDescription(payload.signal.sdp))
      }
      if (payload.signal.type === 'ice-candidate' && payload.signal.candidate) {
        void connection.addIceCandidate(new RTCIceCandidate(payload.signal.candidate))
      }
    }
  })

  socket.addEventListener('close', () => {
    if (!closed) {
      onStatus('传输连接已关闭。')
    }
  })

  function sendFileOffer(peerId: string) {
    if (transferIdsByPeer.has(peerId)) return
    const transferId = `${session.roomId}-${peerId}`
    transferIdsByPeer.set(peerId, transferId)
    sendSocket({
      type: 'file-offer',
      to: peerId,
      payload: {
        transferId,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
      },
    })
    onStatus('接收设备已连接，等待对方确认。')
  }

  async function sendFileToPeer(peerId: string, transferId: string) {
    const connection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    })
    const channel = connection.createDataChannel('asset-file', { ordered: true })
    connections.set(peerId, connection)

    connection.onicecandidate = (event) => {
      if (event.candidate) {
        sendSocket({
          type: 'webrtc-signal',
          to: peerId,
          payload: {
            transferId,
            signal: { type: 'ice-candidate', candidate: event.candidate },
          },
        })
      }
    }

    channel.onopen = async () => {
      onStatus('正在传输文件。')
      await sendFileChunks(channel, file)
      channel.send(JSON.stringify({ type: 'done' }))
      onStatus('文件已发送完成。')
      window.setTimeout(() => connection.close(), 1200)
    }

    const offer = await connection.createOffer()
    await connection.setLocalDescription(offer)
    sendSocket({
      type: 'webrtc-signal',
      to: peerId,
      payload: {
        transferId,
        signal: { type: 'offer', sdp: connection.localDescription },
      },
    })
  }

  function sendSocket(message: object) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message))
    }
  }

  function close() {
    closed = true
    window.clearTimeout(closeTimer)
    for (const connection of connections.values()) {
      connection.close()
    }
    connections.clear()
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
      socket.close()
    }
  }

  return { close }
}

async function sendFileChunks(channel: RTCDataChannel, file: File) {
  const chunkSize = 65_536
  const bufferThreshold = 10_485_760
  const bufferLow = 2_097_152

  for (let offset = 0; offset < file.size; offset += chunkSize) {
    const end = Math.min(offset + chunkSize, file.size)
    channel.send(await file.slice(offset, end).arrayBuffer())

    if (channel.bufferedAmount > bufferThreshold) {
      channel.bufferedAmountLowThreshold = bufferLow
      await new Promise<void>((resolve) => {
        channel.onbufferedamountlow = () => {
          channel.onbufferedamountlow = null
          resolve()
        }
      })
    }
  }
}

interface SignalingMessage {
  type: string
  from?: string
  payload?: unknown
}

function parseSignalingMessage(raw: unknown): SignalingMessage | null {
  if (typeof raw !== 'string') return null
  try {
    const parsed = JSON.parse(raw) as SignalingMessage
    return typeof parsed.type === 'string' ? parsed : null
  } catch {
    return null
  }
}
