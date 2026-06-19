import { useEffect, useRef, useState } from 'react'

import type { AssetDto, AssetKind } from '@super-app/contracts/assets'
import type {
  CreateTextAssetRequest,
  TextAssetDetailDto,
  TextType,
  UpdateTextAssetRequest,
} from '@super-app/contracts/text-assets'
import { assetsApi, textsApi } from '@super-app/api-client'
import { logout } from '@super-app/auth-client'
import { useRequireAuth } from '@super-app/auth-client/react'
import { clientEnv } from '@super-app/env/client'

type FilterKind = 'all' | AssetKind

interface FilterOption {
  value: FilterKind
  label: string
  disabled?: boolean
}

const FILTERS: FilterOption[] = [
  { value: 'all', label: '全部' },
  { value: 'image', label: '图片' },
  { value: 'video', label: '视频' },
  { value: 'audio', label: '音频' },
  { value: 'file', label: '文件' },
  { value: 'text', label: '文本' },
  { value: 'subject', label: '主体', disabled: true },
  { value: 'style', label: '风格', disabled: true },
  { value: 'template', label: '模板', disabled: true },
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

interface TextEditorState {
  id?: string
  title: string
  textType: TextType
  content: string
  language: string
}

export function AssetsApp() {
  const { user, isLoading, error } = useRequireAuth()
  const [filter, setFilter] = useState<FilterKind>('all')
  const [items, setItems] = useState<AssetDto[]>([])
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const [editing, setEditing] = useState<TextEditorState | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const kind = filter === 'all' ? undefined : filter

  useEffect(() => {
    if (!user) return
    setListError(null)
    assetsApi
      .list({ kind })
      .then((res) => setItems(res.items))
      .catch((err) => setListError(err instanceof Error ? err.message : '加载资产失败'))
  }, [user, kind])

  if (isLoading) {
    return <StateScreen title="正在确认登录状态" description="Super 正在连接资产中心。" />
  }

  if (error || !user) {
    return <StateScreen title="需要登录" description="正在跳转到统一登录中心。" />
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

  async function handleDelete(id: string) {
    try {
      await assetsApi.remove(id)
      setItems((prev) => prev.filter((item) => item.id !== id))
    } catch (err) {
      setListError(err instanceof Error ? err.message : '删除失败')
    }
  }

  function openNewText() {
    setEditing({ title: '', textType: 'prompt', content: '', language: '' })
  }

  function openEditText(asset: AssetDto) {
    textsApi
      .get(asset.id)
      .then((detail: TextAssetDetailDto) => {
        setEditing({
          id: detail.id,
          title: detail.title,
          textType: detail.textType,
          content: detail.content,
          language: detail.language ?? '',
        })
      })
      .catch((err) => setListError(err instanceof Error ? err.message : '加载文本失败'))
  }

  async function saveText() {
    if (!editing) return
    if (!editing.title.trim() || !editing.content.trim()) {
      setListError('标题和正文不能为空')
      return
    }
    setSaving(true)
    setListError(null)
    try {
      if (editing.id) {
        const updated = await textsApi.update(editing.id, {
          title: editing.title,
          textType: editing.textType,
          content: editing.content,
          language: editing.language || undefined,
        } as UpdateTextAssetRequest)
        setItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)))
      } else {
        const created = await textsApi.create({
          title: editing.title,
          textType: editing.textType,
          content: editing.content,
          language: editing.language || undefined,
        } as CreateTextAssetRequest)
        if (!kind || created.kind === kind) {
          setItems((prev) => [created, ...prev])
        }
      }
      setEditing(null)
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
    <main className="min-h-screen bg-background text-foreground">
      <header className="assets-header">
        <div>
          <p className="eyebrow">SUPER ASSETS</p>
          <h1>资产中心</h1>
          <p>管理图片、视频、音频、文件和文本素材。主体、风格、模板即将上线。</p>
        </div>
        <button type="button" onClick={handleLogout}>
          退出登录
        </button>
      </header>

      <section className="filter-bar" role="tablist" aria-label="资产类型">
        {FILTERS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={filter === option.value}
            disabled={option.disabled}
            className={filter === option.value ? 'active' : ''}
            onClick={() => !option.disabled && setFilter(option.value)}
          >
            {option.label}
            {option.disabled ? ' · 即将上线' : ''}
          </button>
        ))}
      </section>

      {filter === 'text' ? (
        <section className="upload-row">
          <button type="button" onClick={openNewText}>
            新建文本
          </button>
          <span>创建提示词、备注、脚本等文本资产</span>
        </section>
      ) : (
        <section className="upload-row">
          <input ref={fileInput} type="file" onChange={handleUpload} disabled={uploading} />
          <span>{uploading ? '上传中...' : '选择文件上传到资产中心'}</span>
        </section>
      )}

      {listError ? <p className="list-error">{listError}</p> : null}

      {items.length === 0 ? (
        <section className="empty-state">
          <h2>还没有资产</h2>
          <p>上传第一个素材或新建一个文本吧。</p>
        </section>
      ) : (
        <section className="asset-grid" aria-label="资产列表">
          {items.map((asset) => (
            <article className="asset-card" key={asset.id}>
              <div className="asset-thumb">
                {asset.thumbnailUrl || asset.kind === 'image' ? (
                  <img
                    src={asset.thumbnailUrl ?? asset.files[0]?.url}
                    alt={asset.title}
                    loading="lazy"
                  />
                ) : (
                  <span className="asset-kind-badge">{asset.kind}</span>
                )}
              </div>
              <div className="asset-meta">
                <h3>{asset.title}</h3>
                <p>
                  {asset.kind}
                  {asset.files[0]?.width && asset.files[0]?.height
                    ? ` · ${asset.files[0].width}×${asset.files[0].height}`
                    : ''}
                </p>
              </div>
              {asset.kind === 'text' ? (
                <button type="button" onClick={() => openEditText(asset)}>
                  编辑
                </button>
              ) : null}
              <button type="button" onClick={() => handleDelete(asset.id)}>
                删除
              </button>
            </article>
          ))}
        </section>
      )}

      {editing ? (
        <div className="text-editor-overlay" role="dialog" aria-label="文本编辑器">
          <div className="text-editor">
            <h2>{editing.id ? '编辑文本' : '新建文本'}</h2>
            <label className="editor-field">
              <span>标题</span>
              <input
                value={editing.title}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
              />
            </label>
            <label className="editor-field">
              <span>类型</span>
              <select
                value={editing.textType}
                onChange={(e) => setEditing({ ...editing, textType: e.target.value as TextType })}
              >
                {TEXT_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="editor-field">
              <span>语言（可选，如 zh / en）</span>
              <input
                value={editing.language}
                onChange={(e) => setEditing({ ...editing, language: e.target.value })}
              />
            </label>
            <label className="editor-field">
              <span>正文</span>
              <textarea
                rows={10}
                value={editing.content}
                onChange={(e) => setEditing({ ...editing, content: e.target.value })}
              />
            </label>
            <div className="editor-actions">
              <button type="button" onClick={() => setEditing(null)} disabled={saving}>
                取消
              </button>
              <button type="button" onClick={saveText} disabled={saving}>
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}

function StateScreen({ title, description }: { title: string; description: string }) {
  return (
    <main className="state-screen">
      <div>
        <p className="eyebrow">SUPER ASSETS</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </main>
  )
}
