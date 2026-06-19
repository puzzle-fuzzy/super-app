import { useEffect, useRef, useState } from 'react'

import type { AssetDto, AssetKind } from '@super-app/contracts/assets'
import { assetsApi } from '@super-app/api-client'
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
  { value: 'subject', label: '主体', disabled: true },
  { value: 'text', label: '文本', disabled: true },
  { value: 'style', label: '风格', disabled: true },
  { value: 'template', label: '模板', disabled: true },
]

export function AssetsApp() {
  const { user, isLoading, error } = useRequireAuth()
  const [filter, setFilter] = useState<FilterKind>('all')
  const [items, setItems] = useState<AssetDto[]>([])
  const [uploading, setUploading] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
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
        // Uploaded kind does not match the current filter; refetch to stay correct.
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
          <p>管理图片、视频、音频和文件素材。主体、文本、风格、模板即将上线。</p>
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

      <section className="upload-row">
        <input ref={fileInput} type="file" onChange={handleUpload} disabled={uploading} />
        <span>{uploading ? '上传中...' : '选择文件上传到资产中心'}</span>
      </section>

      {listError ? <p className="list-error">{listError}</p> : null}

      {items.length === 0 ? (
        <section className="empty-state">
          <h2>还没有资产</h2>
          <p>上传第一个素材吧。</p>
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
              <button type="button" onClick={() => handleDelete(asset.id)}>
                删除
              </button>
            </article>
          ))}
        </section>
      )}
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
