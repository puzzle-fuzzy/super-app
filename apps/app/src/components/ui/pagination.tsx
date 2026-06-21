import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo } from 'react'

import { cn } from '@/lib/utils'

interface PaginationProps {
  /** Total number of items */
  total: number
  /** Items per page */
  pageSize: number
  /** 1-based current page */
  currentPage: number
  /** Called with the new 1-based page number */
  onPageChange: (page: number) => void
  className?: string
}

function generatePages(current: number, totalPages: number): (number | 'ellipsis')[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }

  const pages: (number | 'ellipsis')[] = [1]

  if (current > 3) {
    pages.push('ellipsis')
  }

  const start = Math.max(2, current - 1)
  const end = Math.min(totalPages - 1, current + 1)

  for (let i = start; i <= end; i++) {
    pages.push(i)
  }

  if (current < totalPages - 2) {
    pages.push('ellipsis')
  }

  pages.push(totalPages)
  return pages
}

export function Pagination({
  total,
  pageSize,
  currentPage,
  onPageChange,
  className,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const pages = useMemo(() => generatePages(currentPage, totalPages), [currentPage, totalPages])

  const canPrev = currentPage > 1
  const canNext = currentPage < totalPages

  const linkBase = cn(
    'inline-flex items-center justify-center h-10 border border-[#2a2a2a] text-[13px]',
    'text-[#999999] transition-colors duration-150',
    'hover:bg-[#2a2a2a] hover:text-[#e5e5e5]',
  )

  return (
    <div className={cn('mt-6 text-[#999999]', className)} aria-label="Pagination">
      {/* ── Desktop ── */}
      <div className="hidden justify-center sm:flex">
        <ul className="flex items-center">
          <li>
            <button
              disabled={!canPrev}
              onClick={() => onPageChange(currentPage - 1)}
              className={cn(
                linkBase,
                'gap-1.5 px-3 rounded-tl-lg rounded-bl-lg border-r-0',
                !canPrev && 'opacity-30 cursor-not-allowed hover:bg-transparent hover:text-[#999999]',
              )}
            >
              <ChevronLeft size={16} />
              上一页
            </button>
          </li>

          {pages.map((item) => (
            <li key={item}>
              {item === 'ellipsis' ? (
                <span className={cn(linkBase, 'px-3 border-l-0 select-none')}>...</span>
              ) : (
                <button
                  onClick={() => onPageChange(item)}
                  aria-current={currentPage === item ? 'page' : undefined}
                  className={cn(
                    linkBase,
                    'px-4 border-l-0',
                    currentPage === item &&
                      'bg-[#2a2a2a] text-[#e5e5e5] font-medium',
                  )}
                >
                  {item}
                </button>
              )}
            </li>
          ))}

          <li>
            <button
              disabled={!canNext}
              onClick={() => onPageChange(currentPage + 1)}
              className={cn(
                linkBase,
                'gap-1.5 px-3 rounded-tr-lg rounded-br-lg border-l-0',
                !canNext && 'opacity-30 cursor-not-allowed hover:bg-transparent hover:text-[#999999]',
              )}
            >
              下一页
              <ChevronRight size={16} />
            </button>
          </li>
        </ul>
      </div>

      {/* ── Mobile ── */}
      <div className="flex items-center justify-between text-[13px] font-medium sm:hidden">
        <button
          disabled={!canPrev}
          onClick={() => onPageChange(currentPage - 1)}
          className={cn(
            'px-4 py-2 border border-[#2a2a2a] rounded-lg transition-colors duration-150',
            'hover:bg-[#2a2a2a] hover:text-[#e5e5e5]',
            !canPrev && 'opacity-30 cursor-not-allowed',
          )}
        >
          上一页
        </button>
        <span className="px-4 text-[#999999]">
          第 {currentPage}/{totalPages} 页
        </span>
        <button
          disabled={!canNext}
          onClick={() => onPageChange(currentPage + 1)}
          className={cn(
            'px-4 py-2 border border-[#2a2a2a] rounded-lg transition-colors duration-150',
            'hover:bg-[#2a2a2a] hover:text-[#e5e5e5]',
            !canNext && 'opacity-30 cursor-not-allowed',
          )}
        >
          下一页
        </button>
      </div>
    </div>
  )
}
