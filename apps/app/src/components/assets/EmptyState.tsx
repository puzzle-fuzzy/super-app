import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

import type { FilterKind } from '../../utils/asset-helpers'
import { panelKicker } from '../../utils/asset-helpers'

export function EmptyState({
  filter,
  onNewText,
  onNewSubject,
}: {
  filter: FilterKind
  onNewText: () => void
  onNewSubject: () => void
}) {
  return (
    <section className="grid min-h-105 place-items-center bg-transparent px-6 py-14 text-center">
      <div className="max-w-110">
        <p className={panelKicker}>空素材库</p>
        <h2 className="mt-2.5 text-[20px] font-semibold leading-tight tracking-[-0.02em] text-[#e5e5e5]">
          还没有资产
        </h2>
        <p className="text-sm leading-relaxed text-[#999999]">
          先上传一张参考图，或者写下第一段提示词，让这里变成你的创作素材库。
        </p>
        <div>
          <Button className="h-10 rounded-[10px] px-5 text-[13px] font-semibold mt-4.5" onClick={filter === 'subject' ? onNewSubject : onNewText}>
            <Plus size={16} aria-hidden="true" />
            {filter === 'subject' ? '创建第一个主体' : '写第一段文本'}
          </Button>
        </div>
      </div>
    </section>
  )
}
