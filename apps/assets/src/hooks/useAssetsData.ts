import { useEffect, useRef, useState } from 'react'
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
import type { AssetDto } from '@super-app/contracts/assets'
import { assetsApi, stylesApi, subjectsApi, templatesApi, textsApi } from '@super-app/api-client'
import { logout } from '@super-app/auth-client'
import { clientEnv } from '@super-app/env/client'
import type { FilterKind } from '../utils/asset-helpers'
import { FILTERS } from '../utils/asset-helpers'
import {
  assetFileFromUrl,
  copyToClipboard,
  startAssetTransferSender,
} from '../utils/webrtc-transfer'

// ---------------------------------------------------------------------------
// Editor state types
// ---------------------------------------------------------------------------

export interface TextEditorState {
  kind: 'text'
  id?: string
  title: string
  textType: TextType
  content: string
  language: string
}

export interface SubjectEditorState {
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

export interface StyleEditorState {
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

export interface TemplateEditorState {
  kind: 'template'
  id?: string
  title: string
  templateType: TemplateType
  // JSON field edited as text; parsed on save.
  templateData: string
}

export type EditorState =
  | TextEditorState
  | SubjectEditorState
  | StyleEditorState
  | TemplateEditorState
  | null

export interface TransferNotice {
  assetId: string
  pageUrl: string
  expiresAt: string
  status: string
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAssetsData() {
  const [filter, setFilter] = useState<FilterKind>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [items, setItems] = useState<AssetDto[]>([])
  const [isListLoading, setIsListLoading] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [editor, setEditor] = useState<EditorState>(null)
  const [pendingDelete, setPendingDelete] = useState<AssetDto | null>(null)
  const [transferNotice, setTransferNotice] = useState<TransferNotice | null>(null)
  const [sharingAssetId, setSharingAssetId] = useState<string | null>(null)
  const [transferringAssetId, setTransferringAssetId] = useState<string | null>(null)
  const activeTransferRef = useRef<ReturnType<typeof startAssetTransferSender> | null>(null)

  const kind = filter === 'all' ? undefined : filter
  const activeFilter = FILTERS.find((option) => option.value === filter) ?? FILTERS[0]
  const visibleItems = items.filter((item) =>
    item.title.toLowerCase().includes(searchQuery.trim().toLowerCase())
  )

  // ---- list fetch on mount / filter change ----
  useEffect(() => {
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
  }, [kind])

  // ---- upload ----
  async function handleUpload(files: FileList | null) {
    const fileArray = Array.from(files ?? [])
    if (fileArray.length === 0) return

    setUploading(true)
    setUploadProgress(fileArray.length > 1 ? `0/${fileArray.length}` : null)
    setListError(null)

    try {
      const createdAssets: AssetDto[] = []
      let failedCount = 0
      let shouldReloadList = false

      for (let index = 0; index < fileArray.length; index++) {
        const file = fileArray[index]!
        setUploadProgress(fileArray.length > 1 ? `${index + 1}/${fileArray.length}` : null)

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
          fileArray.length === failedCount
            ? '上传失败'
            : `${fileArray.length} 个文件中有 ${failedCount} 个上传失败`
        )
      }
    } catch (err) {
      setListError(err instanceof Error ? err.message : '上传失败')
    } finally {
      setUploading(false)
      setUploadProgress(null)
    }
  }

  // ---- delete ----
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

  // ---- share ----
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

  // ---- transfer ----
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

  // ---- edit openers ----
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

  // ---- save ----
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

  // ---- logout ----
  async function handleLogout() {
    await logout()
    window.location.assign(clientEnv.SUPER_PUBLIC_AUTH_APP_URL)
  }

  return {
    // data state
    filter,
    setFilter,
    searchQuery,
    setSearchQuery,
    items,
    setItems,
    isListLoading,
    listError,
    setListError,
    uploading,
    uploadProgress,
    saving,
    // dialog state
    editor,
    setEditor,
    pendingDelete,
    setPendingDelete,
    transferNotice,
    setTransferNotice,
    sharingAssetId,
    transferringAssetId,
    // derived
    kind,
    visibleItems,
    activeFilter,
    // actions
    handleUpload,
    confirmDelete,
    handleCreateShareLink,
    handleStartTransfer,
    openEditText,
    openEditSubject,
    openEditStyle,
    openEditTemplate,
    saveEditor,
    handleLogout,
  }
}
