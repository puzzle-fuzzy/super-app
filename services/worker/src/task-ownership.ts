/**
 * Per-task lock ownership check — module-scoped accessor
 *
 * 长时间运行的 handler（assemble, burn-subtitle）在执行 FFmpeg 等重操作前
 * 调用 checkTaskOwnership() 确认心跳未丢失锁。若锁已丢失则抛 TaskLockLostError（可重试）。
 */
import { TaskLockLostError } from '@super-app/task-engine'

let currentCheck: (() => void) | null = null

export function setTaskOwnershipCheck(fn: (() => void) | null): void {
  currentCheck = fn
}

export function checkTaskOwnership(): void {
  currentCheck?.()
}

export function createOwnershipCheck(
  taskId: string,
  workerId: string,
  lostOwnership: () => boolean,
): () => void {
  return () => {
    if (lostOwnership()) {
      throw new TaskLockLostError(taskId, workerId)
    }
  }
}
