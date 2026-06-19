import { useEffect, useRef, useState } from 'react'

import type { AssetDto, AssetKind } from '@super-app/contracts/assets'
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
  disabled?: boolean
}

const FILTERS: FilterOption[] = [
  { value: 'all', label: '全部' },
  { value: 'image', label: '图片' },
  { value: 'video', label: '视频' },
  { value: 'audio', label: '音频' },
  { value: 'file', label: '文件' },
  { value: 'text', label: '文本' },
  { value: 'subject', label: '主体' },
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

export function AssetsApp() {
  const { user, isLoading, error } = useRequireAuth()
  const [filter, setFilter] = useState<FilterKind>('all')
  const [items, setItems] = useState<AssetDto[]>([])
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const [editor, setEditor] = useState<EditorState>(null)
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

  function openEditText(asset: AssetDto) {
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

  const isCreationFilter = filter === 'text' || filter === 'subject'

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="assets-header">
        <div>
          <p className="eyebrow">SUPER ASSETS</p>
          <h1>资产中心</h1>
          <p>管理图片、视频、音频、文件、文本和主体素材。风格、模板即将上线。</p>
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

      {isCreationFilter ? (
        <section className="upload-row">
          <button
            type="button"
            onClick={() =>
              setEditor(
                filter === 'text'
                  ? { kind: 'text', title: '', textType: 'prompt', content: '', language: '' }
                  : {
                      kind: 'subject',
                      title: '',
                      subjectType: 'person',
                      displayName: '',
                      identityPrompt: '',
                      appearancePrompt: '',
                      negativePrompt: '',
                      consistencyLevel: 'medium',
                    }
              )
            }
          >
            新建{filter === 'text' ? '文本' : '主体'}
          </button>
          <span>
            {filter === 'text'
              ? '创建提示词、备注、脚本等文本资产'
              : '创建人物、角色、商品等可复用主体'}
          </span>
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
          <p>上传素材或新建一个文本/主体吧。</p>
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
              {asset.kind === 'subject' ? (
                <button type="button" onClick={() => openEditSubject(asset)}>
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

      {editor ? (
        <div className="text-editor-overlay" role="dialog" aria-label="资产编辑器">
          <div className="text-editor">
            <h2>{(editor.id ? '编辑' : '新建') + (editor.kind === 'text' ? '文本' : '主体')}</h2>
            <label className="editor-field">
              <span>标题</span>
              <input
                value={editor.title}
                onChange={(e) => setEditor({ ...editor, title: e.target.value })}
              />
            </label>

            {editor.kind === 'text' ? (
              <>
                <label className="editor-field">
                  <span>类型</span>
                  <select
                    value={editor.textType}
                    onChange={(e) => setEditor({ ...editor, textType: e.target.value as TextType })}
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
                    value={editor.language}
                    onChange={(e) => setEditor({ ...editor, language: e.target.value })}
                  />
                </label>
                <label className="editor-field">
                  <span>正文</span>
                  <textarea
                    rows={10}
                    value={editor.content}
                    onChange={(e) => setEditor({ ...editor, content: e.target.value })}
                  />
                </label>
              </>
            ) : (
              <>
                <label className="editor-field">
                  <span>主体类型</span>
                  <select
                    value={editor.subjectType}
                    onChange={(e) =>
                      setEditor({ ...editor, subjectType: e.target.value as SubjectType })
                    }
                  >
                    {SUBJECT_TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="editor-field">
                  <span>显示名称</span>
                  <input
                    value={editor.displayName}
                    onChange={(e) => setEditor({ ...editor, displayName: e.target.value })}
                  />
                </label>
                <label className="editor-field">
                  <span>身份提示词</span>
                  <textarea
                    rows={3}
                    value={editor.identityPrompt}
                    onChange={(e) => setEditor({ ...editor, identityPrompt: e.target.value })}
                  />
                </label>
                <label className="editor-field">
                  <span>外观提示词</span>
                  <textarea
                    rows={3}
                    value={editor.appearancePrompt}
                    onChange={(e) => setEditor({ ...editor, appearancePrompt: e.target.value })}
                  />
                </label>
                <label className="editor-field">
                  <span>负面提示词</span>
                  <textarea
                    rows={3}
                    value={editor.negativePrompt}
                    onChange={(e) => setEditor({ ...editor, negativePrompt: e.target.value })}
                  />
                </label>
                <label className="editor-field">
                  <span>一致性</span>
                  <select
                    value={editor.consistencyLevel}
                    onChange={(e) =>
                      setEditor({
                        ...editor,
                        consistencyLevel: e.target.value as 'low' | 'medium' | 'high',
                      })
                    }
                  >
                    {CONSISTENCY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}

            <div className="editor-actions">
              <button type="button" onClick={() => setEditor(null)} disabled={saving}>
                取消
              </button>
              <button type="button" onClick={saveEditor} disabled={saving}>
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
