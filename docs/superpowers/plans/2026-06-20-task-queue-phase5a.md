# Task Queue Foundation (Phase 5a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Port excuse's unified task queue into super-app: `tasks` table, pure `@super-app/error-recovery` + `@super-app/task-engine` (adapter pattern), `tasks.repo` (raw-SQL claim/lock/retry/orphan-sweep), and a standalone `services/worker` process that runs `generate.video` tasks. Foundation for SSE (5b), generation records (5c), billing (5d), video rewire (5e).

**Architecture:** Port excuse's implementation shape — pure packages declare adapter interfaces (no DB imports); the app injects real repo implementations. `tasks` in `public` schema, FK to `identity.users.id` (adapted from excuse's `accounts.id`). Worker is a separate `services/worker` process polling via `claimNextTask` (`FOR UPDATE SKIP LOCKED`).

**Tech Stack:** TypeScript, Drizzle ORM + Postgres, Bun (runtime + test), `@microsoft/fetch-event-source` (5b, not this phase).

**Spec:** `docs/superpowers/specs/2026-06-20-task-queue-phase5a-design.md`

**Source of truth (excuse files to port — read these):**
- `excuse/packages/error-recovery/src/index.ts` (276 lines, pure)
- `excuse/packages/task-engine/src/index.ts` (506 lines, pure)
- `excuse/packages/db/src/schema/tasks.ts` (table)
- `excuse/packages/db/src/repositories/tasks.repo.ts` (repo, esp. lines 311-492: claim/lock/mark/sweep)

**Verified super-app conventions:**
- Pure packages: `packages/<name>/{package.json,tsconfig.json,src/index.ts}`, src-direct exports (no build), `types: ["bun-types"]` for Bun globals.
- DB schema: `packages/db/src/schema/*.ts`, exported via `schema/index.ts`.
- `bun test` reads `.env` via `--env-file=../../.env`.
- Conventional Commits. Commit after each task.

---

## Task 1: @super-app/error-recovery (pure package)

**Files:** Create `packages/error-recovery/{package.json,tsconfig.json,src/index.ts}`.

- [ ] **Step 1: `packages/error-recovery/package.json`** — name `@super-app/error-recovery`, `private:true`, `type:module`, `exports:{".":"./src/index.ts"}`, scripts `typecheck/lint/lint:fix`, devDeps `typescript ^5.8.3`. **No dependencies** (pure).

- [ ] **Step 2: `packages/error-recovery/tsconfig.json`** — `{ "extends":"../../tsconfig.json", "include":["src"] }`.

- [ ] **Step 3: `packages/error-recovery/src/index.ts`** — copy excuse's `packages/error-recovery/src/index.ts` **verbatim** (all 276 lines: types `BillingMode`/`FailureDomain`/`RecoveryAction`/`RecoveryInput`/`RecoveryClassification`, label/suggestion tables, `classifyRecovery`, `buildDiagnostics`). The file is pure with zero `@excuse` imports — copy as-is. The only change: none required (no namespace refs inside; it's self-contained). Verify by reading the file has no `@excuse`/`@super-app` imports.

- [ ] **Step 4: Verify + commit**
```bash
pnpm install
pnpm --filter @super-app/error-recovery typecheck   # PASS
git add packages/error-recovery
git commit -m "feat(error-recovery): port classifyRecovery pure package from excuse"
```

---

## Task 2: @super-app/task-engine (pure package, adapter pattern)

**Files:** Create `packages/task-engine/{package.json,tsconfig.json,src/index.ts}`.

- [ ] **Step 1: `packages/task-engine/package.json`** — name `@super-app/task-engine`, same shape as error-recovery. **Dependencies: `{ "@super-app/error-recovery": "workspace:*" }`** (task-engine imports `classifyRecovery` semantics via the shared error categories — but actually verify: excuse's task-engine is self-contained with its own `ERROR_CODE_REGISTRY`, NOT importing error-recovery. **Check**: grep excuse task-engine for `error-recovery` — if absent, task-engine has NO deps).

- [ ] **Step 2: `packages/task-engine/tsconfig.json`** — same as error-recovery.

- [ ] **Step 3: `packages/task-engine/src/index.ts`** — copy excuse's `packages/task-engine/src/index.ts` **verbatim** (all 506 lines). It is pure — no `@excuse/db`/`@excuse/provider` imports (verified in spec exploration). Contains: `TaskErrorCategory`, adapter interfaces (`TaskCompletionAdapter`/`TaskClaimAdapter`/`TaskFailureAdapter`/etc.), `TaskHandlerRegistry`, error classes (`TaskNotImplementedError`/`TaskInputError`/`TaskLockLostError`), `getTaskPriority`, `decideTaskFailureAction`, `classifyTaskError`, `computeRetryDelay`, `applyTaskFailureWithAdapter`, `completeTaskWithAdapter`, `claimNextTaskWithAdapter`, `sweepOrphanTasksWithAdapter`, `extendTaskLockWithAdapter`, `cancelTaskWithAdapter`, `DEFAULT_PRIORITY_POLICY`, `DEFAULT_BACKOFF_POLICY`. Verify by reading the file has no `@excuse` imports.

- [ ] **Step 4: Verify + commit**
```bash
pnpm install
pnpm --filter @super-app/task-engine typecheck   # PASS
# CRITICAL: confirm zero @super-app/db imports — pure package boundary
! grep -q "@super-app/db" packages/task-engine/src/index.ts && echo "pure OK" || echo "BOUNDARY VIOLATION"
git add packages/task-engine
git commit -m "feat(task-engine): port pure task decision engine from excuse"
```

---

## Task 3: tasks schema + domain types + migration

**Files:** Create `packages/db/src/schema/tasks.ts`, `packages/db/src/domain-types.ts`; Modify `packages/db/src/schema/index.ts`; generate migration.

- [ ] **Step 1: `packages/db/src/domain-types.ts`** — port excuse's JSONB-attached domain types. Minimal needed for 5a:
```ts
export interface TaskInput {
  [key: string]: unknown
}
export interface TaskOutput {
  [key: string]: unknown
}
export interface TaskErrorInfo {
  category: string
  retriable: boolean
  code?: string
  message: string
}
```
(These are plain interfaces attached to JSONB columns via `$type<>()`. Keep them permissive for 5a; tighten in later phases if needed.)

- [ ] **Step 2: `packages/db/src/schema/tasks.ts`** — port from excuse (spec §1.1), adapted: `accountId`→`ownerId` (FK `identity.users.id`), `pgTable` in `public`, drop `projectId`. Use super-app's `idColumn()`/timestamp helpers if they exist, else raw `uuid`/`timestamp` (check `packages/db/src/schema/common.ts` for `idColumn`/`createdAtColumn`). Include `taskStatusEnum`, `taskDomainEnum`, the 3 indexes.

- [ ] **Step 3: Export from `packages/db/src/schema/index.ts`** — add `export * from './tasks'`. Also export domain types from `packages/db/src/index.ts`: `export * from './domain-types'`.

- [ ] **Step 4: Generate + apply migration**
```bash
pnpm db:generate   # review 0009_tasks.sql — purely additive (enums + table + indexes)
pnpm db:migrate
docker compose -f infra/docker/compose.local.yml exec -T postgres psql -U postgres -d super -tAc "\d public.tasks"
```
Expected: table with all columns + 3 indexes.

- [ ] **Step 5: Verify + commit**
```bash
pnpm --filter @super-app/db typecheck
git add packages/db/src/schema/tasks.ts packages/db/src/domain-types.ts packages/db/src/schema/index.ts packages/db/src/index.ts packages/db/drizzle
git commit -m "feat(db): add unified tasks table (ported from excuse)"
```

---

## Task 4: tasks repository (claim/lock/mark/sweep)

**Files:** Create `packages/db/src/repositories/tasks.ts`.

- [ ] **Step 1: `packages/db/src/repositories/tasks.ts`** — port excuse's `tasks.repo.ts` (lines 33-492), adapted to super-app's db client + `ownerId`. Implement:
  - `createTask(values: TaskInsert)`, `getTaskById(id)`, `listTasksByOwner(ownerId, query?)`.
  - `claimNextTask(workerId, claimTtlMs)` — **raw SQL** `UPDATE tasks SET ... WHERE id = (SELECT ... FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *` (exact port, `account_id`→`owner_id`). Use `db.execute(sql\`...\`)`.
  - `extendTaskLock(id, workerId, claimTtlMs)`, `releaseTaskLock(id)`.
  - `markTaskSucceeded(id, output?)`, `markTaskFailed(id, errorInfo?, errorMessage?)`, `markTaskRetrying(id, nextRunAt)`, `cancelTask(id)` — all status-guarded (only transition from `running`, except cancel from `queued`/`running`).
  - `sweepOrphanTasks(timeoutMinutes=5)` — raw SQL recovering expired `running` tasks to `queued`, `attempts-1`.
  - `notifyTaskStatusChange(task)` — **no-op stub** for 5a (SSE in 5b will implement).
  - `mapRowToTaskRow(raw)` — snake_case → camelCase for raw-SQL results.

  Use super-app's db client import pattern (`import { db } from '@super-app/db'` or however the repo accesses the singleton — check an existing repo or `packages/db/src/index.ts`). If super-app has no repo layer yet (it uses `db` directly in services), expose `getDb()` or use the exported `db` singleton.

- [ ] **Step 2: Verify typecheck**
```bash
pnpm --filter @super-app/db typecheck
```

- [ ] **Step 3: Commit**
```bash
git add packages/db/src/repositories/tasks.ts
git commit -m "feat(db): add tasks repository (claim/lock/retry/orphan-sweep)"
```

---

## Task 5: Worker service (standalone process)

**Files:** Create `services/worker/{package.json,tsconfig.json,src/{index,worker-lifecycle,task-handlers,worker.config}.ts}`.

- [ ] **Step 1: `services/worker/package.json`** — name `@super-app/worker`, `private:true`, `type:module`, scripts `dev:"bun --env-file=../../.env src/index.ts"`, `typecheck`, `lint`. Deps: `@super-app/db`, `@super-app/task-engine`, `@super-app/error-recovery`, `@super-app/env`, `@super-app/storage`, `@super-app/contracts`, `bun-types` (dev). The `services/*` glob already covers it for pnpm workspace.

- [ ] **Step 2: `services/worker/tsconfig.json`** — `{ "extends":"../../tsconfig.json", "compilerOptions":{"types":["bun-types"]}, "include":["src"] }`.

- [ ] **Step 3: `services/worker/src/worker.config.ts`** — config from env with defaults:
```ts
import { serverEnv } from '@super-app/env/server'
export const workerConfig = {
  workerId: `worker-${process.env.HOSTNAME ?? 'local'}-${process.pid}`,
  pollIntervalMs: Number(process.env.WORKER_POLL_INTERVAL_MS ?? 2000),
  claimTtlMs: Number(process.env.WORKER_CLAIM_TTL_MS ?? 30_000),
  heartbeatMs: Number(process.env.WORKER_HEARTBEAT_MS ?? 10_000),
  orphanSweepIntervalMs: 60_000,
  orphanTimeoutMin: 5,
  healthPort: Number(process.env.WORKER_HEALTH_PORT ?? 5201),
  maxConcurrent: 1,
}
```

- [ ] **Step 4: `services/worker/src/worker-lifecycle.ts`** — port excuse's lifecycle (simplified): `setupLifecycle(config)` returning `{ stop() }`. Contains:
  - Claim loop: `setInterval` → `claimNextTaskWithAdapter({ workerId, claimTtlMs, adapter: tasksRepo })` → if task, `await processTaskWithHeartbeat(task)`.
  - `processTaskWithHeartbeat`: starts a heartbeat interval (`extendTaskLockWithAdapter`), runs `handleTask(task)`, clears heartbeat, then `completeTaskWithAdapter` (success) or `applyTaskFailureWithAdapter` (failure).
  - Orphan sweep loop: `setInterval` → `sweepOrphanTasksWithAdapter`.
  - Health server: `Bun.serve({ port, fetch: () => Response.json({ok:true,workerId}) })`.
  - Graceful shutdown: SIGTERM/SIGINT → `clearInterval`s, stop health server, wait for in-flight (with timeout), `process.exit(0)`.

- [ ] **Step 5: `services/worker/src/task-handlers.ts`** — dispatch by `task.type`:
  - `generate.video`: read `task.input` (`{ providerTaskId, model, recordId? }`), poll DashScope `/tasks/{providerTaskId}` every 3s (port the loop from super-app's current `generate-image.ts waitForVideoTask`, but write to `task.output` not generation_records), download the video, write `{ videoUrl, assetId? }` to output. (Asset creation: for 5a, store the downloaded video via `uploadAsset` to create an asset and put its id in output — keeps it self-contained; 5e will refine.)
  - Unknown type → throw `TaskNotImplementedError` (task-engine marks it failed/permanent).

- [ ] **Step 6: `services/worker/src/index.ts`** — entry: `checkWorkerEnvironment()` (verify DB reachable + DashScope key present, warn if missing), `setupLifecycle(workerConfig)`, log startup.

- [ ] **Step 7: Verify**
```bash
pnpm install
pnpm --filter @super-app/worker typecheck
pnpm --filter @super-app/worker lint
```

- [ ] **Step 8: Commit**
```bash
git add services/worker
git commit -m "feat(worker): standalone task worker process (generate.video)"
```

---

## Task 6: Env + turbo wiring

**Files:** Modify `.env.example`, `turbo.json`.

- [ ] **Step 1: `.env.example`** — append worker env vars:
```
# Worker process
WORKER_POLL_INTERVAL_MS=2000
WORKER_CLAIM_TTL_MS=30000
WORKER_HEARTBEAT_MS=10000
WORKER_HEALTH_PORT=5201
```
Mirror in `.env`.

- [ ] **Step 2: `turbo.json`** — add `worker` to the dev pipeline so `pnpm dev` starts it alongside API/apps. (Check existing `dev` task inputs; add `"worker"` to the apps the dev task runs, or add a dedicated task.)

- [ ] **Step 3: Commit**
```bash
git add .env.example turbo.json
git commit -m "chore: wire worker env vars and turbo dev task"
```

---

## Task 7: Tests (pure unit + repo integration)

**Files:** Create `packages/task-engine/src/index.test.ts`, `packages/error-recovery/src/index.test.ts`, `packages/db/test/tasks.repo.test.ts`.

- [ ] **Step 1: `packages/error-recovery/src/index.test.ts`** — pure unit: `classifyRecovery` for retriable codes (Throttling/timeout/5xx) vs permanent (validation/insufficient_balance); cancelled status → cancel domain; diagnostics includes traceId.

- [ ] **Step 2: `packages/task-engine/src/index.test.ts`** — pure unit: `getTaskPriority` (typeOverrides > domainFallbacks > default); `decideTaskFailureAction` (retriable within maxAttempts → retry + delay; permanent → fail; exceeds maxAttempts → fail); `classifyTaskError` (TaskInputError → permanent; TaskLockLostError → retriable); `computeRetryDelay` (fixedInterval for generate.video; exponential cap).

- [ ] **Step 3: `packages/db/test/tasks.repo.test.ts`** — integration against real PG:
  - createTask → claimNextTask returns it (status=running, attempts=1) → second claim returns null (locked) → markSucceeded → re-claim returns null (terminal).
  - orphan sweep: manually set `locked_until` to past+5min on a running task → sweepOrphanTasks → task back to queued, attempts unchanged or -1.
  - markFailed only from running; cancel from queued/running.
  - Cleanup: delete created tasks in afterAll.

- [ ] **Step 4: Run + commit**
```bash
pnpm --filter @super-app/error-recovery test   # or run via turbo
pnpm --filter @super-app/task-engine test
pnpm --filter @super-app/db test
# (ensure packages have "test":"bun test" scripts)
git add packages/error-recovery/src/index.test.ts packages/task-engine/src/index.test.ts packages/db/test/tasks.repo.test.ts
git commit -m "test(task-queue): pure unit + repo integration tests"
```

---

## Task 8: Final verification

- [ ] `pnpm typecheck` — all packages green (including worker).
- [ ] `pnpm test` — all pass (existing 54 + new task-queue tests).
- [ ] `pnpm lint` — clean for touched packages.
- [ ] **Manual worker smoke test**: seed a `generate.video` task row (status=queued) via SQL or a throwaway script, start `pnpm --filter @super-app/worker dev`, observe it claims + polls + writes output (or fails gracefully if DashScope task is fake). Check health endpoint `http://localhost:5201`.
- [ ] Verify worker is independent: stop API, worker keeps running; stop worker, API keeps running.
- [ ] `npx prettier --write` on changed files.
- [ ] Final commit if formatting changed.

---

## Notes for the implementer

1. **Pure package boundary is inviolable**: `@super-app/task-engine` and `@super-app/error-recovery` must NOT import `@super-app/db` or any IO. They declare adapter interfaces; the worker/repo injects implementations. This is excuse's "黄金法则" and AC #3 enforces it.

2. **`claimNextTask` MUST be raw SQL** (`FOR UPDATE SKIP LOCKED` in a subquery UPDATE) — Drizzle's query builder can't express this atomically. Port the raw SQL verbatim from excuse.

3. **`mapRowToTaskRow`**: raw SQL returns snake_case; the repo maps to camelCase. Port this helper.

4. **Worker is a separate process** — `bun --env-file=../../.env src/index.ts`. It shares the same Postgres as the API. Don't import the API app.

5. **5a doesn't wire video generation end-to-end** — the worker can *run* `generate.video` tasks, but nothing *creates* them yet (that's 5e). 5a is verified by seeding a task manually. This is correct and intentional.

6. **excuse's task-engine is self-contained** (does not import error-recovery — it has its own `ERROR_CODE_REGISTRY`). Verify with grep before deciding task-engine's deps; likely NO deps. error-recovery is used by the *frontend/server* for user-facing recovery classification, not by task-engine internally.
