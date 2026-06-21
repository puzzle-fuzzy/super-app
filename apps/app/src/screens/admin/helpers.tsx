import { RefreshCw, Search } from 'lucide-react'

import { clientEnv } from '@super-app/env/client'

/* -------------------------------------------------------------------------- */
/*  API client                                                                */
/* -------------------------------------------------------------------------- */

const API_BASE = clientEnv.SUPER_PUBLIC_API_BASE_URL

export class AdminFetchError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'AdminFetchError'
  }
}

export async function adminFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}/admin${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers as Record<string, string> | undefined),
    },
  })
  if (!res.ok) {
    let message = `HTTP ${res.status}`
    try {
      const body = await res.json()
      // Elysia error shape: { success: false, error: { code, message } }
      message = body?.error?.message || body?.message || message
    } catch {
      // keep default message
    }
    throw new AdminFetchError(res.status, message)
  }
  return res.json()
}

/* -------------------------------------------------------------------------- */
/*  Formatters                                                                */
/* -------------------------------------------------------------------------- */

export function formatCents(cents: number): string {
  return `¥${(cents / 100).toFixed(2)}`
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatFullDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('zh-CN')
}

export function statusBadge(status: string) {
  const map: Record<string, string> = {
    active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    succeeded: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    inactive: 'bg-[#666666]/10 text-[#999999] border-[#666666]/20',
    queued: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    running: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
    retrying: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    failed: 'bg-red-500/10 text-red-400 border-red-500/20',
    cancelled: 'bg-[#666666]/10 text-[#999999] border-[#666666]/20',
    healthy: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    degraded: 'bg-red-500/10 text-red-400 border-red-500/20',
  }
  const cls = map[status] ?? 'bg-[#666666]/10 text-[#999999] border-[#666666]/20'
  return (
    <span className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {status}
    </span>
  )
}

/* -------------------------------------------------------------------------- */
/*  Shared UI pieces                                                          */
/* -------------------------------------------------------------------------- */

export function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-[#2a2a2a] bg-[#1c1c1c] p-5">
      <div className="text-[13px] text-[#999999]">{label}</div>
      <div className="text-2xl font-semibold text-[#e5e5e5] mt-1.5">{value}</div>
      {sub && <div className="text-[12px] text-[#666666] mt-1">{sub}</div>}
    </div>
  )
}

export function LoadingState() {
  return (
    <div className="flex items-center justify-center py-16">
      <p className="text-sm text-[#999999]">加载中...</p>
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <p className="text-sm text-red-400">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 text-[13px] text-[#999999] hover:text-[#e5e5e5] transition-colors"
        >
          <RefreshCw size={13} />
          重试
        </button>
      )}
    </div>
  )
}

export function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div className="relative">
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#666666]" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? '搜索...'}
        className="w-64 pl-9 pr-3 py-2 rounded-lg border border-[#2a2a2a] bg-[#242424] text-sm text-[#e5e5e5] placeholder-[#666666] focus:outline-none focus:border-[#3a3a3a] transition-colors"
      />
    </div>
  )
}
