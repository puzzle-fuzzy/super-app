import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeftRight,
  Grid3X3,
  Images,
  Key,
  LogOut,
  PenTool,
  UserRound,
} from 'lucide-react'

import { SSEClient } from '@super-app/api-client'
import type { CurrentUser } from '@super-app/contracts/auth'
import { clientEnv } from '@super-app/env/client'
import { AssetCard } from '../components/assets/AssetCard'
import { AssetDetailDialog } from '../components/assets/AssetDetailDialog'
import { EditorPanel, DeleteConfirm } from '../components/assets/AssetEditorDialogs'
import { EmptyState } from '../components/assets/EmptyState'
import { LoadingState } from '../components/assets/LoadingState'
import { TransferNoticeDialog } from '../components/assets/TransferNoticeDialog'
import { useAssetsData } from '../hooks/useAssetsData'
import { FILTERS, menuItem } from '../utils/asset-helpers'

export function AssetsApp({ user }: { user: CurrentUser }) {
  const sseRef = useRef<SSEClient | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  // SSE connection
  useEffect(() => {
    if (!user) return
    const sse = new SSEClient()
    sse.on('task_status', (data) => {
      console.log('[SSE] task_status:', data)
    })
    sse.connect()
    sseRef.current = sse
    return () => {
      sse.disconnect()
      sseRef.current = null
    }
  }, [user])

  const {
    filter,
    setFilter,
    isListLoading,
    listError,
    uploading,
    saving,
    editor,
    setEditor,
    pendingDelete,
    setPendingDelete,
    transferNotice,
    setTransferNotice,
    sharingAssetId,
    transferringAssetId,
    visibleItems,
    activeFilter,
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
  } = useAssetsData()

  const [openActionAssetId, setOpenActionAssetId] = useState<string | null>(null)
  const [detailAssetId, setDetailAssetId] = useState<string | null>(null)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  // close action menu on outside click / Escape
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

  // close user menu on outside click / Escape
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

  return (
    <>
      <section
        className="mx-auto w-full max-w-[1800px] px-8 py-8 pb-16 max-[920px]:px-[18px] max-[920px]:py-6 max-[620px]:px-3.5 max-[620px]:py-5"
        aria-label="资产中心"
      >

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
                className={`inline-flex min-h-12 cursor-pointer items-center whitespace-nowrap border-b-2 bg-transparent px-5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${filter === option.value
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
                  onViewDetails={() => setDetailAssetId(asset.id)}
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

      {(() => {
        const detailAsset = detailAssetId ? visibleItems.find((a) => a.id === detailAssetId) : null
        return detailAsset ? (
          <AssetDetailDialog
            open
            asset={detailAsset}
            onClose={() => setDetailAssetId(null)}
          />
        ) : null
      })()}
    </>
  )
}
