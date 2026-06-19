import { useEffect, useRef, useState } from 'react'

import type { AssetDto, AssetKind } from '@super-app/contracts/assets'
import type { AssetTransferSessionDto } from '@super-app/contracts/assets'
import type {
  CreateSubjectAssetRequest,
  SubjectAssetDetailDto,
  SubjectType,
  UpdateSubjectAssetRequest,
} from '@super-app/contracts/subject-assets'
import type {
  CreateTextAssetRequest,
  TextAssetDetailDto,
  TextType,
  UpdateTextAssetRequest,
} from '@super-app/contracts/text-assets'
import { assetsApi, subjectsApi, textsApi } from '@super-app/api-client'
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
  { value: 'style', label: '风格', helper: '即将上线', disabled: true },
  { value: 'template', label: '模板', helper: '即将上线', disabled: true },
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

const CONSISTENCY_OPTIONS = [
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
] as const

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

type EditorState = TextEditorState | SubjectEditorState | null

interface TransferNotice {
  assetId: string
  pageUrl: string
  expiresAt: string
  status: string
}

export function AssetsApp() {
  const { user, isLoading, error } = useRequireAuth()
  const [filter, setFilter] = useState<FilterKind>('all')
  const [items, setItems] = useState<AssetDto[]>([])
  const [isListLoading, setIsListLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const [editor, setEditor] = useState<EditorState>(null)
  const [pendingDelete, setPendingDelete] = useState<AssetDto | null>(null)
  const [transferNotice, setTransferNotice] = useState<TransferNotice | null>(null)
  const [sharingAssetId, setSharingAssetId] = useState<string | null>(null)
  const [transferringAssetId, setTransferringAssetId] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const activeTransferRef = useRef<ReturnType<typeof startAssetTransferSender> | null>(null)

  const kind = filter === 'all' ? undefined : filter
  const activeFilter = FILTERS.find((option) => option.value === filter) ?? FILTERS[0]

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

  if (isLoading) {
    return <StateScreen title="正在确认登录状态" description="Super 正在连接资产中心。" />
  }

  if (error || !user) {
    return <StateScreen title="需要登录" description="正在跳转到统一登录中心。" />
  }

  function openNewText() {
    setEditor({ kind: 'text', title: '', textType: 'prompt', content: '', language: '' })
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

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setUploading(true)
    setListError(null)

    try {
      const created = await assetsApi.upload(file)
      if (kind && created.kind !== kind) {
        const res = await assetsApi.list({ kind })
        setItems(res.items)
      } else {
        setItems((prev) => [created, ...prev])
      }
    } catch (err) {
      setListError(err instanceof Error ? err.message : '上传失败')
    } finally {
      setUploading(false)
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
        status: '局域网传输链接已复制，30 秒内打开即可接收。',
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
      } else {
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
    <main className="assets-shell bg-background text-foreground">
      <section className="assets-workspace" aria-label="资产中心">
        <header className="assets-topbar">
          <div className="topbar-nav">
            <div className="rail-brand">
              <span>S</span>
              <div>
                <strong>Super</strong>
                <small>我的素材库</small>
              </div>
            </div>
            <button type="button" className="quiet-action" onClick={handleLogout}>
              退出登录
            </button>
          </div>

          <div className="hero-panel">
            <div className="topbar-copy">
              <p className="eyebrow">Super 素材库</p>
              <h1>资产中心</h1>
              <p>收好图片、文件、提示词和角色设定。下一次打开画布时，素材已经在这里等你。</p>
            </div>

            <div className="quick-compose" aria-label="快速创建">
              <span>继续创作</span>
              <button
                type="button"
                className="secondary-action"
                onClick={() => fileInput.current?.click()}
              >
                {uploading ? '上传中...' : '上传文件'}
              </button>
              <button type="button" className="secondary-action" onClick={openNewText}>
                新建文本
              </button>
              <button type="button" className="primary-action" onClick={openNewSubject}>
                新建主体
              </button>
            </div>

            <input
              ref={fileInput}
              className="file-input"
              type="file"
              onChange={handleUpload}
              disabled={uploading}
            />
            <div className="workspace-orb" aria-hidden="true" />
          </div>
        </header>

        <nav className="asset-type-nav" role="tablist" aria-label="资产类型">
          {FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-label={option.label}
              aria-selected={filter === option.value}
              disabled={option.disabled}
              className={filter === option.value ? 'active' : ''}
              onClick={() => !option.disabled && setFilter(option.value)}
            >
              <span>{option.label}</span>
              <small>{option.disabled ? '即将上线' : option.helper}</small>
            </button>
          ))}
        </nav>

        <section className="collection-strip" aria-label="当前集合">
          <div>
            <span>正在浏览</span>
            <strong>{isListLoading ? '同步中' : `${items.length} 个资产`}</strong>
          </div>
          <p>
            {activeFilter.label} · {activeFilter.helper}
          </p>
        </section>

        {listError ? <p className="list-error">{listError}</p> : null}

        <section className="assets-content">
          {isListLoading ? (
            <AssetSkeletons />
          ) : items.length === 0 ? (
            <EmptyState filter={filter} onNewText={openNewText} onNewSubject={openNewSubject} />
          ) : (
            <section className="asset-grid" aria-label="资产列表">
              {items.map((asset) => (
                <AssetCard
                  asset={asset}
                  key={asset.id}
                  onDelete={() => setPendingDelete(asset)}
                  onEdit={() => {
                    if (asset.kind === 'text') openEditText(asset)
                    if (asset.kind === 'subject') openEditSubject(asset)
                  }}
                  onShare={() => handleCreateShareLink(asset)}
                  onTransfer={() => handleStartTransfer(asset)}
                  sharing={sharingAssetId === asset.id}
                  transferring={transferringAssetId === asset.id}
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
}: {
  asset: AssetDto
  onDelete: () => void
  onEdit: () => void
  onShare: () => void
  onTransfer: () => void
  sharing: boolean
  transferring: boolean
}) {
  const canEdit = asset.kind === 'text' || asset.kind === 'subject'
  const canTransfer = asset.files.some((file) => file.role === 'original')

  return (
    <article className="asset-card">
      <div className="asset-card-main">
        <AssetPreview asset={asset} />
        <span className="asset-meta">
          <strong>{asset.title}</strong>
          <small>{assetLabel(asset)}</small>
        </span>
      </div>

      <div className="asset-card-actions">
        {canTransfer ? (
          <button type="button" onClick={onTransfer} disabled={transferring}>
            {transferring ? '创建中' : '传输'}
          </button>
        ) : null}
        <button type="button" onClick={onShare} disabled={sharing || !canTransfer}>
          {sharing ? '创建中' : '分享链接'}
        </button>
        {canEdit ? (
          <button type="button" onClick={onEdit}>
            编辑
          </button>
        ) : null}
        <button type="button" onClick={onDelete}>
          删除
        </button>
      </div>
    </article>
  )
}

function TransferNoticeDialog({
  notice,
  onClose,
}: {
  notice: TransferNotice
  onClose: () => void
}) {
  return (
    <div className="confirm-backdrop" role="dialog" aria-label="传输分享">
      <div className="confirm-card transfer-card">
        <p className="panel-kicker">传输分享</p>
        <h2>链接已准备好</h2>
        <p>{notice.status}</p>
        <code>{notice.pageUrl}</code>
        {notice.expiresAt ? (
          <p>有效期至 {new Date(notice.expiresAt).toLocaleTimeString()}</p>
        ) : null}
        <div className="editor-actions">
          <button type="button" onClick={onClose}>
            关闭
          </button>
          <button type="button" onClick={() => copyToClipboard(notice.pageUrl)}>
            复制链接
          </button>
        </div>
      </div>
    </div>
  )
}

function AssetPreview({ asset }: { asset: AssetDto }) {
  if (asset.thumbnailUrl || asset.kind === 'image') {
    return (
      <span className="asset-thumb">
        <img src={asset.thumbnailUrl ?? asset.files[0]?.url} alt={asset.title} loading="lazy" />
      </span>
    )
  }

  return (
    <span className={`asset-thumb symbolic ${asset.kind}`}>
      <span>{asset.kind.slice(0, 2)}</span>
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
    <aside className="editor-panel" role="dialog" aria-label="资产编辑器">
      <div className="editor-panel-inner">
        <header>
          <p className="panel-kicker">创作编辑</p>
          <h2>{(editor.id ? '编辑' : '新建') + (editor.kind === 'text' ? '文本' : '主体')}</h2>
        </header>

        <label className="editor-field">
          <span>标题</span>
          <input
            value={editor.title}
            onChange={(event) => setEditor({ ...editor, title: event.target.value })}
          />
        </label>

        {editor.kind === 'text' ? (
          <TextEditorFields editor={editor} setEditor={setEditor} />
        ) : (
          <SubjectEditorFields editor={editor} setEditor={setEditor} />
        )}

        <div className="editor-actions">
          <button type="button" onClick={onCancel} disabled={saving}>
            取消
          </button>
          <button type="button" onClick={onSave} disabled={saving}>
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </aside>
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
      <label className="editor-field">
        <span>类型</span>
        <select
          value={editor.textType}
          onChange={(event) => setEditor({ ...editor, textType: event.target.value as TextType })}
        >
          {TEXT_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="editor-field">
        <span>语言（可选，如 zh / en）</span>
        <input
          value={editor.language}
          onChange={(event) => setEditor({ ...editor, language: event.target.value })}
        />
      </label>
      <label className="editor-field">
        <span>正文</span>
        <textarea
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
      <label className="editor-field">
        <span>主体类型</span>
        <select
          value={editor.subjectType}
          onChange={(event) =>
            setEditor({ ...editor, subjectType: event.target.value as SubjectType })
          }
        >
          {SUBJECT_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="editor-field">
        <span>显示名称</span>
        <input
          value={editor.displayName}
          onChange={(event) => setEditor({ ...editor, displayName: event.target.value })}
        />
      </label>
      <label className="editor-field">
        <span>身份提示词</span>
        <textarea
          rows={3}
          value={editor.identityPrompt}
          onChange={(event) => setEditor({ ...editor, identityPrompt: event.target.value })}
        />
      </label>
      <label className="editor-field">
        <span>外观提示词</span>
        <textarea
          rows={3}
          value={editor.appearancePrompt}
          onChange={(event) => setEditor({ ...editor, appearancePrompt: event.target.value })}
        />
      </label>
      <label className="editor-field">
        <span>负面提示词</span>
        <textarea
          rows={3}
          value={editor.negativePrompt}
          onChange={(event) => setEditor({ ...editor, negativePrompt: event.target.value })}
        />
      </label>
      <label className="editor-field">
        <span>一致性</span>
        <select
          value={editor.consistencyLevel}
          onChange={(event) =>
            setEditor({
              ...editor,
              consistencyLevel: event.target.value as 'low' | 'medium' | 'high',
            })
          }
        >
          {CONSISTENCY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
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
    <div className="confirm-backdrop" role="dialog" aria-label="删除确认">
      <div className="confirm-card">
        <p className="panel-kicker">确认删除</p>
        <h2>删除「{asset.title}」？</h2>
        <p>这个素材会从当前列表移除。之后的恢复能力会在资产回收站阶段加入。</p>
        <div className="editor-actions">
          <button type="button" onClick={onCancel}>
            取消
          </button>
          <button type="button" onClick={onConfirm}>
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
    <section className="empty-state">
      <p className="panel-kicker">空素材库</p>
      <h2>还没有资产</h2>
      <p>先上传一张参考图，或者写下第一段提示词，让这里变成你的创作素材库。</p>
      <div>
        <button type="button" onClick={filter === 'subject' ? onNewSubject : onNewText}>
          {filter === 'subject' ? '创建第一个主体' : '写第一段文本'}
        </button>
      </div>
    </section>
  )
}

function AssetSkeletons() {
  return (
    <section className="asset-grid" aria-label="资产加载中">
      {Array.from({ length: 8 }).map((_, index) => (
        <article className="asset-card skeleton" key={index}>
          <span className="asset-thumb" />
          <span />
          <span />
        </article>
      ))}
    </section>
  )
}

function StateScreen({ title, description }: { title: string; description: string }) {
  return (
    <main className="state-screen">
      <div>
        <p className="eyebrow">Super 素材库</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </main>
  )
}

function assetLabel(asset: AssetDto) {
  if (asset.files[0]?.width && asset.files[0]?.height) {
    return `${asset.kind} · ${asset.files[0].width}×${asset.files[0].height}`
  }

  return asset.kind
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
