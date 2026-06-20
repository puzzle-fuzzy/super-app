/**
 * Worker 进程配置 — 从环境变量读取，带合理默认值。
 */
export interface WorkerConfig {
  workerId: string
  pollIntervalMs: number
  claimTtlMs: number
  heartbeatMs: number
  orphanSweepIntervalMs: number
  orphanTimeoutMin: number
  healthPort: number
  maxConcurrent: number
}

export function loadWorkerConfig(): WorkerConfig {
  const num = (key: string, fallback: number) => {
    const raw = process.env[key]
    if (!raw) return fallback
    const n = Number(raw)
    return Number.isFinite(n) && n > 0 ? n : fallback
  }

  return {
    workerId: `worker-${process.env.HOSTNAME ?? 'local'}-${process.pid}`,
    pollIntervalMs: num('WORKER_POLL_INTERVAL_MS', 2000),
    claimTtlMs: num('WORKER_CLAIM_TTL_MS', 30_000),
    heartbeatMs: num('WORKER_HEARTBEAT_MS', 10_000),
    orphanSweepIntervalMs: 60_000,
    orphanTimeoutMin: 5,
    healthPort: num('WORKER_HEALTH_PORT', 5201),
    maxConcurrent: 1,
  }
}
