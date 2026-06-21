import { useEffect, useState } from 'react'
import type { AssetDto, AssetKind } from '@super-app/contracts/assets'
import { assetsApi } from '@super-app/api-client'

export function usePipelineAssets() {
  const [assets, setAssets] = useState<AssetDto[]>([])
  const [assetFilter, setAssetFilter] = useState<AssetKind | 'all'>('all')
  const [assetSidebarOpen, setAssetSidebarOpen] = useState(true)

  useEffect(() => {
    assetsApi.list({ limit: 50 }).then((res) => setAssets(res.items)).catch(() => {})
  }, [])

  return { assets, assetFilter, setAssetFilter, assetSidebarOpen, setAssetSidebarOpen }
}
