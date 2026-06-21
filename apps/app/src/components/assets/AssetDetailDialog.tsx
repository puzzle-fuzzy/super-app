import type { AssetDto } from '@super-app/contracts/assets'
import { Modal } from '@super-app/ui-react'
import { AssetDetailView } from '@super-app/ui-react/asset-detail'

export function AssetDetailDialog({ open, onClose, asset }: { open: boolean; onClose: () => void; asset: AssetDto }) {
  const previewUrl = asset.thumbnailUrl ?? asset.files?.[0]?.url

  return (
    <Modal open={open} onClose={onClose}>
      <Modal.Header title={asset.title} />
      <Modal.Body>
        <AssetDetailView
          origin={asset.origin}
          previewUrl={previewUrl}
          title={asset.title}
          assetId={asset.id}
        />
      </Modal.Body>
    </Modal>
  )
}
