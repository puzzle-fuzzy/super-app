# Task Queue Foundation — Phase 5a Design

- **Date:** 2026-06-20
- **Scope:** Phase 5a — port excuse's unified task queue foundation into super-app: the `tasks` table, a pure `@super-app/task-engine` + `@super-app/error-recovery`, the `tasks` repository (claim/lock/retry/orphan-sweep), and a standalone `services/worker` process that polls DashScope video tasks. This is the foundation for SSE (5b), generation records + dedupe (5c), billing (5d), and rewiring video generation (5e).
- **Status:** Draft (pending review)

## Background

super-app (the "表现"/frontend-focused project) currently generates video by polling DashScope **inside the HTTP request** with a 60s cap — which always times out (videos take 2-5 min). excuse (the "内在"/backend) solved this with a standalone worker process + a unified `tasks` table. The goal across Phases 5a-5e is to merge excuse's backend infrastructure into super-app. This phase builds the foundation.

The port preserves excuse's implementation shape (pure-package + adapter pattern, raw-SQL claim, worker lifecycle) and only adapts: namespace (`@excuse/*` → `@super-app/*`), the user FK (`accounts.id` → `users.id`), and Drizzle conventions (super-app uses module-level exports).

## Non-Goals (deferred to later phases)

- SSE push (5b) — 5a's worker writes DB only, no push.
- `generation_records` table + dedupe/Idempotency-Key (5c).
- Credit/billing (5d).
- Rewiring the video generation endpoint to use tasks (5e) — 5a builds the foundation + a worker that *can* run `generate.video`; the endpoint is migrated in 5e.
- Canvas pipeline tasks (super-app's canvas has no multi-phase pipeline yet).
- OpenAI gateway domain (not applicable to super-app).

## Decisions (locked)

| # | Decision |
|---|----------|
| 1 | Standalone `services/worker` process (matches excuse's `apps/worker`), started separately from the API. |
| 2 | Port excuse's `tasks` table design in full: status/domain enums, priority, traceId, input/output/errorJson, claim/lock (lockedBy/lockedUntil), retry (attempts/maxAttempts/nextRunAt), orphan-sweep support. |
| 3 | Port `@excuse/error-recovery` (pure `classifyRecovery`) and `@excuse/task-engine` (pure decisions: priority/retry/backoff/state-machine) as `@super-app/*` pure packages with adapter interfaces — no `@super-app/db` imports inside them. |
| 4 | Port excuse's `tasks.repo.ts` (raw-SQL `claimNextTask` with `FOR UPDATE SKIP LOCKED`, heartbeat, mark-succeeded/failed/retrying, cancel, `sweepOrphanTasks`) as super-app's repository. |
| 5 | `tasks` table lives in the **`public` schema** (cross-domain infrastructure, not a business schema like `assets`). Matches excuse. |
| 6 | User FK adapts: `accountId` → `ownerId` referencing `identity.users.id`. |
| 7 | First worker iteration handles only `generate.video` tasks (poll DashScope, download, write result). Other task types error-log and skip. |

## 1. Data Layer

### 1.1 `tasks` table — `packages/db/src/schema/tasks.ts`

Port of excuse `packages/db/src/schema/tasks.ts`, adapted:

```ts
import { index, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { users } from './identity'

export const taskStatusEnum = pgEnum('task_status', [
  'queued', 'running', 'retrying', 'succeeded', 'failed', 'cancelled',
])

export const taskDomainEnum = pgEnum('task_domain', [
  'canvas', 'generate', 'subtitle', 'gateway',
])

export const tasks = pgTable('tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  ownerId: uuid('owner_id').references(() => users.id).notNull(),
  type: varchar('type', { length: 100 }).notNull(),
  domain: taskDomainEnum('domain').notNull(),
  priority: integer('priority').notNull().default(5),
  traceId: varchar('trace_id', { length: 64 }),
  targetType: varchar('target_type', { length: 50 }),
  targetId: uuid('target_id'),
  input: jsonb('input').$type<TaskInput>(),
  output: jsonb('output').$type<TaskOutput>(),
  errorJson: jsonb('error_json').$type<TaskErrorInfo>(),
  errorMessage: text('error_message'),
  generationRecordId: uuid('generation_record_id'), // nullable until 5c
  lockedBy: varchar('locked_by', { length: 100 }).default('').notNull(),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
  status: taskStatusEnum('status').notNull().default('queued'),
  attempts: integer('attempts').notNull().default(0),
  maxAttempts: integer('max_attempts').notNull().default(3),
  nextRunAt: timestamp('next_run_at', { withTimezone: true }).defaultNow().notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('idx_tasks_status_next_run').on(t.status, t.nextRunAt),
  index('idx_tasks_locked_until').on(t.lockedUntil),
  index('idx_tasks_domain_type').on(t.domain, t.type),
])
```

**Adaptations from excuse:**
- `accountId` → `ownerId`, FK → `identity.users.id` (super-app's user table; excuse's was `accounts`).
- `projectId` dropped (no canvas pipeline in 5a; can re-add when canvas pipeline lands).
- `pgTable` in `public` schema (matches excuse; super-app's business schemas use `pgSchema`, but `tasks` is infrastructure).
- Same 4 indexes (minus `idx_tasks_project`).

### 1.2 Domain types — `packages/db/src/domain-types.ts`

Port the JSONB-attached types `TaskInput`, `TaskOutput`, `TaskErrorInfo` from excuse's `packages/db/src/domain-types.ts` (they're plain interfaces, no runtime deps). `TaskErrorInfo` = `{ retriable: boolean; code?: string; message?: string; attempts?: number; maxAttempts?: number }`.

### 1.3 Migration

`packages/db/drizzle/0009_tasks.sql` (drizzle-generated). Creates the two enums + table + indexes. Purely additive — no destructive changes.

## 2. `@super-app/error-recovery` (pure package)

Port of excuse `packages/error-recovery/src/index.ts` (276 lines). Pure functions, zero deps:
- `classifyRecovery(input: RecoveryInput): RecoveryClassification` — classifies an error as retriable/permanent by code/message/status/source/billingMode, returns `{ action: 'retry'|'fail', retryAfterMs?, domain, reason }`.
- Types: `RecoveryInput`, `RecoveryClassification`, `FailureDomain`, `RecoveryAction`, `BillingMode`.
- **Adaptation**: none beyond the namespace (`@excuse` → `@super-app`). Pure logic, no IO.

## 3. `@super-app/task-engine` (pure package, adapter pattern)

Port of excuse `packages/task-engine/src/index.ts` (506 lines). Pure decision functions:
- `getTaskPriority({ type, domain })` — priority lookup.
- `classifyTaskError(error, context)` — wraps `classifyRecovery` for task context.
- `decideRetry(task, error)` — returns `{ action: 'retry'|'fail', nextRunAt? }` based on attempts/maxAttempts + error classification + backoff.
- State-machine guards: `canClaim`, `canComplete`, `canCancel`.

**Adapter pattern (critical):** declares a `TaskRepository` interface (the IO surface: `claimNextTask`, `extendTaskLock`, `markTaskSucceeded`, etc.) but does **NOT** import `@super-app/db`. Pure functions take the repo as a parameter. The app injects the real `tasks.repo` implementation. This matches excuse's "黄金法则" (pure packages declare adapter interfaces; app injects IO).

## 4. `tasks.repo` — `packages/db/src/repositories/tasks.ts`

Port of excuse's `tasks.repo.ts` (the adapter implementation). Uses super-app's db client. Key functions (raw SQL where needed for atomicity):
- `createTask(values)`, `getTaskById(id)`, `listTasksByOwner(ownerId, query)`.
- `claimNextTask(workerId, claimTtlMs)` — `FOR UPDATE SKIP LOCKED` UPDATE...RETURNING (exact port of the raw SQL; only column names adapt: `account_id` → `owner_id`).
- `extendTaskLock`, `releaseTaskLock` (heartbeat).
- `markTaskSucceeded`, `markTaskFailed`, `markTaskRetrying`, `cancelTask` (status-machine guarded updates).
- `sweepOrphanTasks(timeoutMinutes)` — recovers `running` tasks whose lock expired >5min back to `queued` (attempts-1).
- `notifyTaskStatusChange(task)` — stub for 5b (no-op in 5a; SSE arrives in 5b).

**`mapRowToTaskRow`** helper: raw-SQL `claimNextTask`/`sweepOrphanTasks` return snake_case rows; this maps to camelCase `TaskRow` (port from excuse).

## 5. `services/worker` (standalone process)

Port of excuse `apps/worker` structure, adapted:

### 5.1 `services/worker/src/index.ts` (entry)
- Loads env (`bun --env-file=../../.env`).
- Generates `workerId` (e.g. `worker-${hostname}-${pid}`).
- Calls `setupLifecycle(config)` → starts claim loop + orphan sweep + health server + graceful shutdown.

### 5.2 `services/worker/src/worker-lifecycle.ts`
Port of excuse's `worker-lifecycle.ts` (316 lines), simplified for 5a:
- **Claim loop**: `setInterval(pollIntervalMs)` → `claimNextTask(workerId, claimTtlMs)` → if task, `processTask(task)`; concurrent task cap (1 at a time per worker by default).
- **Heartbeat**: while a task runs, `extendTaskLock` every `heartbeatMs`.
- **Orphan sweep**: `setInterval` → `sweepOrphanTasks(5)`.
- **Health server**: tiny `Bun.serve` on a port returning `{ ok: true, workerId, lastClaimAt }` for liveness probes.
- **Graceful shutdown**: SIGTERM/SIGINT → stop claiming new tasks, wait for in-flight to finish (timeout), exit.

### 5.3 `services/worker/src/task-handlers.ts`
Dispatch by `task.type`:
- `generate.video` → port the DashScope video-poll logic from super-app's current `generate-image.ts` `waitForVideoTask` (poll `/tasks/{taskId}` every 3s until SUCCEEDED/FAILED, download, write result to `task.output`). For 5a, since `generation_records` doesn't exist yet, the handler writes the video URL + assetId into `task.output` JSONB (the 5e rewrite will also create the asset/record).
- Unknown type → log warning, `markTaskFailed` with a permanent error.

### 5.4 `services/worker/package.json`
- `"dev": "bun --env-file=../../.env src/index.ts"`, `"typecheck"`, `"lint"`.
- Deps: `@super-app/db`, `@super-app/task-engine`, `@super-app/error-recovery`, `@super-app/env`, `@super-app/storage`, `@super-app/contracts` (for types). `bun-types`.
- Added to `pnpm-workspace` (covered by `services/*` glob).

### 5.5 Config (`worker.config.ts`)
- `pollIntervalMs` (default 2000), `claimTtlMs` (30000), `heartbeatMs` (10000), `orphanSweepIntervalMs` (60000), `orphanTimeoutMin` (5), `healthPort` (5201), `maxConcurrent` (1).
- Reads from env with sensible defaults.

## 6. Env additions

- `WORKER_POLL_INTERVAL_MS`, `WORKER_CLAIM_TTL_MS`, `WORKER_HEARTBEAT_MS`, `WORKER_HEALTH_PORT` (all optional, defaults in config).
- `.env.example` documents them.

## 7. turbo / dev workflow

- Add a `worker` task to turbo (`dev` pipeline starts both API + worker). For local dev: `pnpm --filter @super-app/worker dev`.
- The worker is a separate process from the API — both connect to the same Postgres.

## 8. Testing

| Layer | Test | Coverage |
|---|---|---|
| task-engine (pure) | `packages/task-engine/src/index.test.ts` | `getTaskPriority`, `decideRetry` (retriable within maxAttempts → retry + backoff; permanent → fail; exceeds maxAttempts → fail), state guards. Pure unit, no DB. |
| error-recovery (pure) | `packages/error-recovery/src/index.test.ts` | `classifyRecovery` for retriable codes (5xx, timeout) vs permanent (4xx validation, "invalid_api_key"). Pure unit. |
| tasks.repo (integration) | `packages/db/test/tasks.repo.test.ts` (bun:test against real PG) | createTask → claimNextTask (returns the task, status=running, attempts+1) → second claim returns null (locked) → markSucceeded → re-claim returns null (terminal). orphan sweep: simulate expired lock → task recovered to queued. |
| worker (integration) | `services/worker/src/worker.test.ts` | processTask dispatch: `generate.video` polls a stub DashScope; unknown type → failed. (Mock the HTTP, assert task status transitions.) |

## 9. Acceptance Criteria

1. `pnpm typecheck` green across all packages (new `@super-app/task-engine`, `@super-app/error-recovery`, `services/worker`, updated `@super-app/db`).
2. `pnpm db:migrate` applies `0009_tasks.sql` cleanly on a fresh DB; `public.tasks` table exists with all columns + indexes.
3. `@super-app/task-engine` and `@super-app/error-recovery` have **zero** `@super-app/db` imports (enforced by package boundary — they import nothing IO).
4. `tasks.repo.test.ts`: `claimNextTask` is atomic (concurrent claims don't double-claim), `markTaskSucceeded` only transitions from `running`, orphan sweep recovers expired locks.
5. `services/worker` starts (`pnpm --filter @super-app/worker dev`), health endpoint responds, claims a seeded `generate.video` task, polls DashScope, and writes the result to `task.output`.
6. `task-engine`/`error-recovery` unit tests pass; tasks.repo integration tests pass.
7. The worker is a separate process (starting/stopping the API does not start/stop the worker).

## 10. File Change Summary

**New packages:**
- `packages/error-recovery/{package.json,tsconfig.json,src/index.ts,src/index.test.ts}`
- `packages/task-engine/{package.json,tsconfig.json,src/index.ts,src/index.test.ts}`

**New service:**
- `services/worker/{package.json,tsconfig.json,src/{index,worker-lifecycle,task-handlers,worker.config}.ts,src/worker.test.ts}`

**New schema/repo:**
- `packages/db/src/schema/tasks.ts`
- `packages/db/src/domain-types.ts` (TaskInput/TaskOutput/TaskErrorInfo)
- `packages/db/src/repositories/tasks.ts`
- `packages/db/test/tasks.repo.test.ts`
- `packages/db/drizzle/0009_tasks.sql` (+ meta)

**Modified:**
- `packages/db/src/schema/index.ts` (export `tasks`)
- `packages/db/src/index.ts` (export repo + types as needed)
- `.env.example` (worker env vars)
- `turbo.json` (worker dev task)
- `pnpm` workspace already covers `services/*` and `packages/*`.

## 11. Phase Roadmap (context)

- **5a (this):** tasks table + task-engine + error-recovery + repos + worker (generate.video only).
- **5b:** SSE (PostgreSQL LISTEN/NOTIFY + server SSE endpoint + frontend SSEClient).
- **5c:** generation_records + dedupe + Idempotency-Key + retry/cancel endpoints.
- **5d:** credit/billing (accounts/transactions + reserve/settle/refund).
- **5e:** rewire video generation endpoint to use tasks (immediate `processing` return → worker → SSE).
