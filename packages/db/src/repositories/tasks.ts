import type { TaskErrorInfo, TaskOutput } from '../domain-types'
import type { NewTask, Task } from '../schema/tasks'
import { and, eq, getTableColumns, inArray, sql } from 'drizzle-orm'

import { tasks } from '../schema/tasks'

import { db } from '../client'

// 构建反向映射：snake_case 列名 → camelCase 属性名（raw SQL claim/sweep 返回 snake_case）
function buildSnakeToCamelMap() {
  const cols = getTableColumns(tasks)
  const map = new Map<string, string>()
  for (const [camelKey, info] of Object.entries(cols)) {
    map.set(info.name, camelKey)
  }
  return map
}
const SNAKE_TO_CAMEL = buildSnakeToCamelMap()

function mapRowToTask(row: Record<string, unknown>): Task {
  const mapped: Record<string, unknown> = {}
  for (const [snakeKey, val] of Object.entries(row)) {
    mapped[SNAKE_TO_CAMEL.get(snakeKey) ?? snakeKey] = val
  }
  return mapped as Task
}

/** sanitize 错误信息 — 去掉换行/控制字符，截断超长文案（移植自 @excuse/shared）。 */
function sanitizeErrorMessage(message: string): string {
  return message
    .replace(/[\r\n\t]+/g, ' ')
    .trim()
    .slice(0, 1000)
}

// ===== CRUD =====

/** 创建任务 — insert + returning */
export async function createTask(values: NewTask): Promise<Task> {
  const [task] = await db.insert(tasks).values(values).returning()
  return task!
}

/** 按 ID 查询单条任务 */
export async function getTaskById(id: string): Promise<Task | null> {
  const [task] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1)
  return task ?? null
}

/** 按 owner 查任务（基础列表，5c 引入完整 generation_records 关联后扩展） */
export async function listTasksByOwner(ownerId: string, limit = 50): Promise<Task[]> {
  return db.select().from(tasks).where(eq(tasks.ownerId, ownerId)).limit(limit)
}

// ===== Claim / Lock =====

/**
 * 原子 claim 下一个可执行任务 — FOR UPDATE SKIP LOCKED
 *
 * 多个 Worker 可并发调用，不会 race：SKIP LOCKED 跳过已被其他 Worker 锁定的行。
 *
 * @param workerId Worker 标识（如 'worker-1'）
 * @param claimTtlMs claim 锁定时长（毫秒），如 30_000（30 秒）
 * @returns 被 claim 的 task，或 null（无 eligible task）
 */
export async function claimNextTask(workerId: string, claimTtlMs: number): Promise<Task | null> {
  const result = (await db.execute(sql`
    UPDATE tasks
    SET status = 'running',
        locked_by = ${workerId},
        locked_until = now() + (${claimTtlMs} || ' milliseconds')::interval,
        attempts = attempts + 1,
        started_at = COALESCE(started_at, now()),
        updated_at = now()
    WHERE id = (
      SELECT id FROM tasks
      WHERE status IN ('queued', 'retrying')
        AND next_run_at <= now()
        AND (locked_until IS NULL OR locked_until < now())
      ORDER BY priority ASC, next_run_at ASC, created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING *
  `)) as unknown as Array<Record<string, unknown>>

  return result.length > 0 ? mapRowToTask(result[0]!) : null
}

/**
 * 延长任务锁定时间 — heartbeat 定期调用。
 * Worker 在执行长任务期间定期调用，防止 lockedUntil 过期导致任务被其他 Worker claim。
 */
export async function extendTaskLock(
  id: string,
  workerId: string,
  claimTtlMs: number
): Promise<Task | null> {
  const [updated] = await db
    .update(tasks)
    .set({
      lockedUntil: sql`now() + (${claimTtlMs} || ' milliseconds')::interval`,
      updatedAt: new Date(),
    })
    .where(and(eq(tasks.id, id), eq(tasks.lockedBy, workerId), eq(tasks.status, 'running')))
    .returning()
  return updated ?? null
}

/** 释放任务锁 — 清除 lockedBy/lockedUntil（取消时使用） */
export async function releaseTaskLock(id: string): Promise<void> {
  await db
    .update(tasks)
    .set({
      lockedBy: '',
      lockedUntil: null,
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, id))
}

// ===== 状态转换 =====

/** Mark task as succeeded — append-only guard：只在 status='running' 时生效 */
export async function markTaskSucceeded(id: string, output?: TaskOutput): Promise<Task | null> {
  const [updated] = await db
    .update(tasks)
    .set({
      status: 'succeeded',
      finishedAt: new Date(),
      ...(output && { output }),
      updatedAt: new Date(),
    })
    .where(and(eq(tasks.id, id), eq(tasks.status, 'running')))
    .returning()
  return updated ?? null
}

/**
 * Mark task as failed — 区分 retriable vs permanent。
 * 如果不可重试或超过 maxAttempts，直接调用本函数设 status='failed'。
 */
export async function markTaskFailed(
  id: string,
  errorInfo?: TaskErrorInfo,
  errorMessage?: string
): Promise<Task | null> {
  const sanitized = errorMessage ? sanitizeErrorMessage(errorMessage) : undefined
  const [updated] = await db
    .update(tasks)
    .set({
      status: 'failed',
      finishedAt: new Date(),
      ...(errorInfo && { errorJson: errorInfo }),
      ...(sanitized && { errorMessage: sanitized }),
      updatedAt: new Date(),
    })
    .where(and(eq(tasks.id, id), eq(tasks.status, 'running')))
    .returning()
  return updated ?? null
}

/**
 * Mark task as retrying — 设置 nextRunAt 推迟下次 claim。
 * Worker 判断 retriable 且 attempts < maxAttempts 时调用，
 * 任务进入 'retrying' 状态，等待 nextRunAt 后由 claimNextTask 重新 claim。
 */
export async function markTaskRetrying(id: string, nextRunAt: Date): Promise<Task | null> {
  const [updated] = await db
    .update(tasks)
    .set({
      status: 'retrying',
      nextRunAt,
      finishedAt: null,
      updatedAt: new Date(),
    })
    .where(and(eq(tasks.id, id), eq(tasks.status, 'running')))
    .returning()
  return updated ?? null
}

/** Mark task as cancelled — 只在 queued/running 状态时生效 */
export async function cancelTask(id: string): Promise<Task | null> {
  const [updated] = await db
    .update(tasks)
    .set({
      status: 'cancelled',
      finishedAt: new Date(),
      lockedBy: '',
      lockedUntil: null,
      updatedAt: new Date(),
    })
    .where(and(eq(tasks.id, id), inArray(tasks.status, ['queued', 'running'])))
    .returning()
  return updated ?? null
}

// ===== Orphan Sweep =====

/**
 * 恢复孤儿任务 — 找到 lock 过期 timeoutMinutes 分钟以上的 running 任务，恢复为 queued。
 * attempts 减 1（GREATEST(attempts-1, 0)）确保 crash 的那次 attempt 不计入 retry 预算。
 *
 * @param timeoutMinutes 锁过期多久才视为孤儿（默认 5 分钟）
 * @returns 恢复的任务数量
 */
export async function sweepOrphanTasks(timeoutMinutes = 5): Promise<number> {
  const result = (await db.execute(sql`
    UPDATE tasks
    SET status = 'queued',
        locked_by = '',
        locked_until = NULL,
        attempts = GREATEST(attempts - 1, 0),
        updated_at = now()
    WHERE status = 'running'
      AND locked_until < now() - (${timeoutMinutes} || ' minutes')::interval
  `)) as unknown as { count: number }
  return result.count
}

// ===== SSE 通知（5a stub，5b 实现 LISTEN/NOTIFY） =====

/**
 * 任务状态变更通知 — 通过 PG NOTIFY 推送到 SSE listener。
 */
export async function notifyTaskStatusChange(task: Task): Promise<void> {
  const { notifyTaskStatus } = await import('../notify')
  await notifyTaskStatus({
    taskId: task.id,
    ownerId: task.ownerId,
    status: task.status,
    output: task.output,
    error: task.errorMessage ? { message: task.errorMessage } : undefined,
  })
}
