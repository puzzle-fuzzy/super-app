import { useCallback, useState } from 'react'
import { Check, Copy, RefreshCw, Search } from 'lucide-react'

import { Input } from '@/components/ui/input'
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
  const styleMap: Record<string, string> = {
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
  const cls = styleMap[status] ?? 'bg-[#666666]/10 text-[#999999] border-[#666666]/20'
  return (
    <span className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {t(status)}
    </span>
  )
}

/* -------------------------------------------------------------------------- */
/*  Chinese translations                                                      */
/* -------------------------------------------------------------------------- */

const STATUS_CN: Record<string, string> = {
  active: '活跃',
  completed: '已完成',
  succeeded: '成功',
  inactive: '停用',
  queued: '排队中',
  running: '运行中',
  retrying: '重试中',
  failed: '失败',
  cancelled: '已取消',
  healthy: '健康',
  degraded: '降级',
  generating: '生成中',
  draft: '草稿',
  pending: '待处理',
  processing: '处理中',
}

const TASK_TYPE_CN: Record<string, string> = {
  'generate.image': '图片生成',
  'generate.video': '视频生成',
  'canvas.analyze': '画布分析',
  'canvas.generate': '画布生成',
  'pipeline.analyze': '流水线-分析',
  'pipeline.characters': '流水线-角色',
  'pipeline.locations': '流水线-场景',
  'pipeline.character-refs': '流水线-角色参考',
  'pipeline.location-refs': '流水线-场景参考',
  'pipeline.storyboard': '流水线-分镜',
  'pipeline.continuity': '流水线-连续性',
  'pipeline.rebuild': '流水线-重建',
  'pipeline.dialogue': '流水线-对白',
  'pipeline.videos': '流水线-视频',
  'pipeline.bgm': '流水线-配乐',
  'pipeline.assemble': '流水线-合成',
}

const DOMAIN_CN: Record<string, string> = {
  generation: '生成',
  canvas: '画布',
  pipeline: '流水线',
  subtitle: '字幕',
  transfer: '传输',
}

const FAILURE_KIND_CN: Record<string, string> = {
  generation: '生成',
  task: '任务',
  canvas_pipeline: '画布流水线',
}

const PROVIDER_CATEGORY_CN: Record<string, string> = {
  image: '图片',
  video: '视频',
  text: '文本',
  audio: '音频',
}

const CREDIT_TYPE_CN: Record<string, string> = {
  credit: '充值',
  reserve: '冻结',
  debit: '扣款',
  refund: '退款',
  admin_adjust: '管理员调整',
}

const AUDIT_ACTION_CN: Record<string, string> = {
  admin_action: '管理员操作',
  api_key_revoke: '撤销 Key',
  login: '登录',
  register: '注册',
}

/** Translate a single key to Chinese. Supports status, domain, kind, category, credit type, audit action. */
export function t(key: string): string {
  return (
    STATUS_CN[key] ??
    TASK_TYPE_CN[key] ??
    DOMAIN_CN[key] ??
    FAILURE_KIND_CN[key] ??
    PROVIDER_CATEGORY_CN[key] ??
    CREDIT_TYPE_CN[key] ??
    AUDIT_ACTION_CN[key] ??
    key
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
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#666666] pointer-events-none" />
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? '搜索...'}
        className="w-64 pl-9"
      />
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  CopyButton                                                                */
/* -------------------------------------------------------------------------- */

export function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // fallback silently
    }
  }, [text])

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`shrink-0 inline-flex items-center justify-center align-middle rounded transition-colors hover:text-[#e5e5e5] ${copied ? 'text-emerald-400' : 'text-[#666666]'} ${className ?? ''}`}
      title="复制"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  )
}
