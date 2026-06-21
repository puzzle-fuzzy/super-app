import {
  applyTaskFailureWithAdapter,
  claimNextTaskWithAdapter,
  completeTaskWithAdapter,
  extendTaskLockWithAdapter,
  sweepOrphanTasksWithAdapter,
} from '@super-app/task-engine'
import {
  claimNextTask,
  extendTaskLock,
  markTaskFailed,
  markTaskRetrying,
  markTaskSucceeded,
  notifyTaskStatusChange,
  sweepOrphanTasks,
} from '@super-app/db'
import { serverEnv } from '@super-app/env/server'
import { ASRClient, DashScopeClient } from '@super-app/provider'
import { registerProviderCallObserver } from '@super-app/provider'
import { createStorage } from '@super-app/storage'
import { MetricsCollector } from '@super-app/metrics'

import type { WorkerConfig } from './worker.config'
import { taskHandlers, type WorkerTaskContext } from './task-handlers'
import { startCreditReconciliation } from './credit-reconciliation'

// Repository adapter — 注入到 task-engine 的纯函数（adapter 模式：纯包不碰 IO）
const repoAdapter = {
  claimNextTask: (workerId: string, claimTtlMs: number) => claimNextTask(workerId, claimTtlMs),
  extendTaskLock: (id: string, workerId: string, claimTtlMs: number) =>
    extendTaskLock(id, workerId, claimTtlMs),
  markTaskSucceeded: (id: string, output?: unknown) => markTaskSucceeded(id, output as never),
  markTaskRetrying: (id: string, nextRunAt: Date) => markTaskRetrying(id, nextRunAt),
  markTaskFailed: (id: string, errorInfo?: unknown, errorMessage?: string) =>
    markTaskFailed(id, errorInfo as never, errorMessage),
  sweepOrphanTasks: (timeoutMinutes?: number) => sweepOrphanTasks(timeoutMinutes),
  notifyTaskStatusChange: (task: unknown) => notifyTaskStatusChange(task as never),
}

export interface WorkerLifecycle {
  stop: () => Promise<void>
}

/**
 * 启动 Worker 生命周期：claim 循环 + heartbeat + orphan sweep + health server + graceful shutdown。
 */
export function setupLifecycle(config: WorkerConfig): WorkerLifecycle {
  let running = true
  let inFlight = false
  const timers: ReturnType<typeof setInterval>[] = []
  let healthServer: ReturnType<typeof Bun.serve> | null = null

  const apiKey = process.env.DASHSCOPE_API_KEY || serverEnv.DASHSCOPE_API_KEY || ''
  const baseUrl = process.env.DASHSCOPE_BASE_URL || serverEnv.DASHSCOPE_BASE_URL || undefined
  const context: WorkerTaskContext = {
    workerId: config.workerId,
    config,
    llmClient: new DashScopeClient({ apiKey, baseUrl }),
    storage: createStorage(),
    asrClient: new ASRClient({ apiKey, baseUrl }),
  }

  // ── Provider metrics collector ──────────────────────
  const metricsCollector = new MetricsCollector()
  registerProviderCallObserver((model, durationMs, success) => {
    metricsCollector.recordProviderCall(model, durationMs, success)
  })

  /** 处理单个任务：启动 heartbeat → 执行 handler → 完成/失败 → 清除 heartbeat。 */
  const processTask = async (task: NonNullable<Awaited<ReturnType<typeof claimNextTask>>>) => {
    const heartbeat = setInterval(async () => {
      try {
        await extendTaskLockWithAdapter({
          taskId: task.id,
          workerId: config.workerId,
          claimTtlMs: config.claimTtlMs,
          adapter: repoAdapter,
        })
      } catch (err) {
        console.error('[worker] heartbeat error:', err)
      }
    }, config.heartbeatMs)

    try {
      const output = await taskHandlers.handle(task, context)
      await completeTaskWithAdapter({ task, output, adapter: repoAdapter })
      console.log(`[worker] task ${task.id} succeeded`)
    } catch (err) {
      const result = await applyTaskFailureWithAdapter({
        task: {
          id: task.id,
          type: task.type,
          attempts: task.attempts,
          maxAttempts: task.maxAttempts,
        },
        error: err,
        adapter: repoAdapter,
      })
      if (result.action === 'retry') {
        console.warn(
          `[worker] task ${task.id} failed (retriable), retry at ${result.nextRunAt.toISOString()}:`,
          err
        )
      } else {
        console.error(`[worker] task ${task.id} failed (permanent):`, err)
      }
    } finally {
      clearInterval(heartbeat)
    }
  }

  // ── Claim 循环 ──────────────────────────────────────
  const poll = async () => {
    if (!running || inFlight) return
    inFlight = true
    try {
      const task = await claimNextTaskWithAdapter({
        workerId: config.workerId,
        claimTtlMs: config.claimTtlMs,
        adapter: repoAdapter,
      })
      if (task) {
        console.log(
          `[worker] claimed task ${task.id} (type=${task.type}, attempt=${task.attempts})`
        )
        await processTask(task)
      }
    } catch (err) {
      console.error('[worker] poll error:', err)
    } finally {
      inFlight = false
    }
  }
  timers.push(setInterval(poll, config.pollIntervalMs))

  // ── Orphan sweep ────────────────────────────────────
  timers.push(
    setInterval(async () => {
      try {
        const recovered = await sweepOrphanTasksWithAdapter({
          timeoutMinutes: config.orphanTimeoutMin,
          adapter: repoAdapter,
        })
        if (recovered > 0) console.log(`[worker] recovered ${recovered} orphan task(s)`)
      } catch (err) {
        console.error('[worker] orphan sweep error:', err)
      }
    }, config.orphanSweepIntervalMs)
  )

  // ── Credit reconciliation ────────────────────────────
  const creditRecon = startCreditReconciliation({
    intervalMs: config.orphanSweepIntervalMs,
    staleThresholdMinutes: 60,
  })

  // ── Health server ───────────────────────────────────
  healthServer = Bun.serve({
    port: config.healthPort,
    fetch: (req) => {
      const url = new URL(req.url)
      if (url.pathname === '/provider-calls') {
        const snapshot = metricsCollector.snapshot(0, process.uptime())
        return Response.json({ ok: true, providerCalls: snapshot.providerCalls })
      }
      return Response.json({ ok: true, workerId: config.workerId, inFlight, running })
    },
  })
  console.log(`[worker] health server on http://localhost:${config.healthPort}`)

  // ── Graceful shutdown ───────────────────────────────
  const stop = async () => {
    if (!running) return
    running = false
    console.log('[worker] shutting down...')
    for (const t of timers) clearInterval(t)
    creditRecon.stop()
    healthServer?.stop(true)
    // 等待 in-flight 任务完成（最多 30s）
    for (let i = 0; i < 30 && inFlight; i++) {
      await Bun.sleep(1000)
    }
    if (inFlight) console.warn('[worker] in-flight task did not finish within shutdown timeout')
    console.log('[worker] stopped')
  }

  process.on('SIGTERM', () => {
    void stop().then(() => process.exit(0))
  })
  process.on('SIGINT', () => {
    void stop().then(() => process.exit(0))
  })

  return { stop }
}
