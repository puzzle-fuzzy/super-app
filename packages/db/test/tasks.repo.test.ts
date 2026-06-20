import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { eq, sql } from 'drizzle-orm'

import { db } from '../src/client'
import { users } from '../src/schema/identity'
import {
  cancelTask,
  claimNextTask,
  createTask,
  extendTaskLock,
  getTaskById,
  markTaskFailed,
  markTaskRetrying,
  markTaskSucceeded,
  releaseTaskLock,
  sweepOrphanTasks,
} from '../src/repositories/tasks'

let ownerId: string

beforeAll(async () => {
  // 直接插入一个测试用户（绕过 auth 流程，只为满足 tasks.owner_id FK）
  const [user] = await db
    .insert(users)
    .values({
      email: `task-repo-${Date.now()}-${crypto.randomUUID()}@test.super`,
      passwordHash: 'test-only-no-real-auth',
      name: 'Task Repo Test',
    })
    .returning()
  ownerId = user!.id
})

afterAll(async () => {
  // 清理：删该用户的 tasks 和 user 行
  await db.execute(sql`DELETE FROM tasks WHERE owner_id = ${ownerId}`)
  await db.delete(users).where(eq(users.id, ownerId))
})

describe('tasks.repo', () => {
  it('createTask → getTaskById round-trip', async () => {
    const task = await createTask({
      ownerId,
      type: 'generate.video',
      domain: 'generate',
      input: { providerTaskId: 'tsk-1', model: 'wanx', prompt: 'a cat', ownerId },
    })
    expect(task.id).toBeTruthy()
    expect(task.status).toBe('queued')
    expect(task.attempts).toBe(0)

    const fetched = await getTaskById(task.id)
    expect(fetched?.id).toBe(task.id)
    expect(fetched?.type).toBe('generate.video')
  })

  it('claimNextTask claims a queued task (status=running, attempts+1)', async () => {
    const task = await createTask({
      ownerId,
      type: 'generate.video',
      domain: 'generate',
      priority: 1, // 高优先级，确保被先 claim
      input: { providerTaskId: 'tsk-2' },
    })

    const claimed = await claimNextTask('worker-test-1', 30_000)
    expect(claimed).not.toBeNull()
    expect(claimed!.status).toBe('running')
    expect(claimed!.lockedBy).toBe('worker-test-1')
    expect(claimed!.attempts).toBe(1)
    expect(claimed!.lockedUntil).toBeTruthy()
    // 确认 claim 到的是我们刚创建的高优先级任务（或至少是 running 状态）
    expect(claimed!.lockedUntil! instanceof Date || typeof claimed!.lockedUntil === 'string').toBe(true)

    // 第二次 claim（无新 eligible，因为该 task 已 running；除非有其他 queued）
    // 注意：可能 claim 到其他 test 的 task，所以只验证不重复 claim 同一个 running task
    const fetched = await getTaskById(task.id)
    expect(fetched!.status).toBe('running')
  })

  it('markTaskSucceeded only transitions from running', async () => {
    const task = await createTask({
      ownerId,
      type: 'test.succeed',
      domain: 'generate',
      input: {},
    })
    // 未 claim 直接 markSucceeded → 应返回 null（status 不是 running）
    const noTransition = await markTaskSucceeded(task.id, { result: 'x' })
    expect(noTransition).toBeNull()

    // claim 后再 markSucceeded → 成功
    await claimNextTask('worker-test-2', 30_000)
    // 上面 claim 可能拿到别的 task；直接用 SQL 把这个 task 设成 running 模拟已 claim
    await db.execute(
      sql`UPDATE tasks SET status='running', locked_by='worker-test-2', attempts=1 WHERE id=${task.id}`
    )
    const succeeded = await markTaskSucceeded(task.id, { result: 'done' })
    expect(succeeded).not.toBeNull()
    expect(succeeded!.status).toBe('succeeded')
    expect(succeeded!.finishedAt).toBeTruthy()
  })

  it('markTaskRetrying sets nextRunAt and status=retrying', async () => {
    const task = await createTask({
      ownerId,
      type: 'test.retry',
      domain: 'generate',
      input: {},
    })
    await db.execute(
      sql`UPDATE tasks SET status='running', locked_by='w', attempts=1 WHERE id=${task.id}`
    )
    const nextRunAt = new Date(Date.now() + 5000)
    const retrying = await markTaskRetrying(task.id, nextRunAt)
    expect(retrying).not.toBeNull()
    expect(retrying!.status).toBe('retrying')
    expect(retrying!.finishedAt).toBeNull()
  })

  it('cancelTask transitions from queued', async () => {
    const task = await createTask({
      ownerId,
      type: 'test.cancel',
      domain: 'generate',
      input: {},
    })
    const cancelled = await cancelTask(task.id)
    expect(cancelled).not.toBeNull()
    expect(cancelled!.status).toBe('cancelled')
    expect(cancelled!.lockedBy).toBe('')
  })

  it('extendTaskLock only on running + correct workerId', async () => {
    const task = await createTask({
      ownerId,
      type: 'test.extend',
      domain: 'generate',
      input: {},
    })
    await db.execute(
      sql`UPDATE tasks SET status='running', locked_by='worker-x', locked_until=now(), attempts=1 WHERE id=${task.id}`
    )
    const extended = await extendTaskLock(task.id, 'worker-x', 60_000)
    expect(extended).not.toBeNull()

    // 错误的 workerId → null
    const wrongWorker = await extendTaskLock(task.id, 'wrong-worker', 60_000)
    expect(wrongWorker).toBeNull()
  })

  it('sweepOrphanTasks recovers expired running tasks to queued', async () => {
    const task = await createTask({
      ownerId,
      type: 'test.orphan',
      domain: 'generate',
      input: {},
    })
    // 模拟一个已过期 10 分钟的 lock（孤儿）
    await db.execute(
      sql`UPDATE tasks SET status='running', locked_by='dead-worker', locked_until=now() - interval '10 minutes', attempts=2 WHERE id=${task.id}`
    )

    const recovered = await sweepOrphanTasks(5)
    expect(recovered).toBeGreaterThanOrEqual(1)

    const fetched = await getTaskById(task.id)
    expect(fetched!.status).toBe('queued')
    expect(fetched!.lockedBy).toBe('')
    // attempts 减 1（crash 的那次不计入）
    expect(fetched!.attempts).toBe(1)
  })
})
