// ===== 计费策略 =====

export type CreditLedgerLifecycle = 'reserve' | 'debit' | 'refund'

export interface CreditLedgerBillingPolicy {
  mode: 'credit-ledger'
  lifecycle: CreditLedgerLifecycle[]
  usageEventRequired: boolean
  generationRecordRequired: boolean
}

export interface FreeBillingPolicy {
  mode: 'free'
  lifecycle: []
  usageEventRequired: false
  generationRecordRequired: false
}

export interface CostOnlyBillingPolicy {
  mode: 'cost-only'
  lifecycle: []
  usageEventRequired: false
  generationRecordRequired: true
}

export type BillingPolicy = CreditLedgerBillingPolicy | FreeBillingPolicy | CostOnlyBillingPolicy

const BILLING_POLICIES: Record<string, BillingPolicy> = {
  'workspace.generate': {
    mode: 'credit-ledger',
    lifecycle: ['reserve', 'debit', 'refund'],
    usageEventRequired: true,
    generationRecordRequired: true,
  },
}

export function getBillingPolicy(surface: string): BillingPolicy {
  const policy = BILLING_POLICIES[surface]
  if (policy) return policy

  // 默认: free（未知 surface 不阻塞）
  return { mode: 'free', lifecycle: [], usageEventRequired: false, generationRecordRequired: false }
}

export function isCreditLedgerPolicy(
  policy: BillingPolicy
): policy is CreditLedgerBillingPolicy {
  return policy.mode === 'credit-ledger'
}
