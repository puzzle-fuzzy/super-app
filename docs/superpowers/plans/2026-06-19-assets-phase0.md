# Assets Module Phase 0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the foundation of Super's unified asset platform and ship upload-class assets (image, video, audio, file) end to end: contracts, DB migration, shared auth plugin, storage abstraction, assets API + tests, assets frontend app, and browser E2E.

**Architecture:** New `AssetKind` 8-enum + rewritten `assets.assets` main table + new `assets.asset_files` table. A new `@super-app/storage` package provides a `StorageProvider` interface with a local-disk implementation (swappable for Aliyun OSS later). A shared `authPlugin` extracts session resolution from the auth module so assets (and future modules) reuse `requireUser`. The assets module mirrors the auth module's structure (`service.ts` + `index.ts` + `assets.test.ts`). A new `apps/assets` Vite app mirrors `apps/auth`.

**Tech Stack:** TypeScript, Elysia 1.4.x, Drizzle ORM + Postgres, Bun (runtime + test), Zod, React 19 + Vite 7 + Tailwind v4, Playwright.

**Spec:** `docs/superpowers/specs/2026-06-19-assets-phase0-design.md`

**Reference patterns (read these before starting):**

- Module shape: `services/api/src/modules/auth/{index.ts,service.ts,auth.test.ts}`
- Response helpers: `services/api/src/shared/response.ts` → `ok`/`fail` from `@super-app/contracts/api`
- Errors: `services/api/src/shared/errors.ts` → `AppError(status, code, message, details?)`
- Plugin shape: `services/api/src/plugins/db.ts`
- Package layout: `packages/api-client/{package.json,tsconfig.json,src/index.ts}` (src-direct exports, no build)
- App layout: `apps/auth/{package.json,vite.config.ts,src/main.tsx,src/screens/AuthApp.tsx}`

**Conventions:**

- `bun test` reads `.env` via `--env-file=../../.env` (see `services/api/package.json`).
- Env vars are validated: server vars in `packages/env/src/server.ts`, public/browser vars in `packages/env/src/public.ts`, both must be added together, plus `.env.example` + `.env` + `playwright.config.ts` `localEnv`.
- All API responses use the unified `{ success, data|error }` shape via `ok`/`fail`.
- Commit after each task. Use Conventional Commits (`feat:`, `test:`, `chore:`, `refactor:`).

---

## File Structure

**New packages/apps/modules:**

- `packages/storage/` — `StorageProvider` interface + `LocalStorageProvider` (new package `@super-app/storage`)
- `apps/assets/` — Vite frontend app (new app `@super-app/assets`)
- `services/api/src/shared/session.ts` — extracted session helpers
- `services/api/src/plugins/auth.ts` — shared auth plugin (`user` + `requireUser`)
- `services/api/src/plugins/storage.ts` — storage provider plugin
- `services/api/src/modules/assets/` — `index.ts` (routes) + `service.ts` (business logic) + `assets.test.ts`
- `packages/db/drizzle/0001_assets_redesign.sql` — migration
- `tests/e2e/assets.spec.ts` + `tests/e2e/fixtures/sample.png` — E2E

**Modified files:**

- `packages/contracts/src/assets.ts` — new enums + DTOs
- `packages/db/src/schema/assets.ts` — rewritten main table + `asset_files`
- `packages/db/src/index.ts` — export `assetFiles`
- `packages/env/src/{public,server}.ts` — storage env vars
- `.env.example`, `.env`, `playwright.config.ts` — storage env values
- `packages/api-client/src/index.ts` — `assetsApi`
- `services/api/src/app.ts` — assets module + static storage route
- `services/api/src/modules/auth/{service,index}.ts` — session helpers extracted; `me` route uses plugin
- `turbo.json` `globalEnv` — add `SUPER_PUBLIC_STORAGE_BASE_URL`

---

## Task 1: Extend contracts with new asset enums and DTOs

**Files:**

- Modify: `packages/contracts/src/assets.ts`

**Why first:** Everything downstream (db schema, api, client, frontend) imports these types. Define the contract once.

- [ ] **Step 1: Rewrite `packages/contracts/src/assets.ts`**

Replace the entire file contents with:

```ts
import { z } from 'zod'

export const AssetKindSchema = z.enum([
  'subject',
  'image',
  'video',
  'audio',
  'text',
  'file',
  'style',
  'template',
])

export type AssetKind = z.infer<typeof AssetKindSchema>

export const AssetSourceSchema = z.enum([
  'upload',
  'ai_generation',
  'canvas_export',
  'transfer',
  'manual',
  'import',
])

export type AssetSource = z.infer<typeof AssetSourceSchema>

export const AssetStatusSchema = z.enum(['active', 'archived', 'deleted'])
export type AssetStatus = z.infer<typeof AssetStatusSchema>

export const AssetVisibilitySchema = z.enum(['private', 'shared', 'public'])
export type AssetVisibility = z.infer<typeof AssetVisibilitySchema>

export const AssetFileRoleSchema = z.enum([
  'original',
  'thumbnail',
  'preview',
  'cover',
  'subtitle',
  'waveform',
  'attachment',
])

export type AssetFileRole = z.infer<typeof AssetFileRoleSchema>

export const AssetFileDtoSchema = z.object({
  id: z.string(),
  role: AssetFileRoleSchema,
  storageBucket: z.string(),
  storageKey: z.string(),
  url: z.string(),
  mimeType: z.string().optional(),
  size: z.number().int().nonnegative().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  duration: z.number().int().positive().optional(),
  createdAt: z.string(),
})

export type AssetFileDto = z.infer<typeof AssetFileDtoSchema>

export const AssetDtoSchema = z.object({
  id: z.string(),
  kind: AssetKindSchema,
  title: z.string(),
  description: z.string().optional(),
  status: AssetStatusSchema,
  visibility: AssetVisibilitySchema,
  source: AssetSourceSchema,
  thumbnailUrl: z.string().url().optional(),
  previewUrl: z.string().url().optional(),
  metadata: z.record(z.unknown()),
  files: z.array(AssetFileDtoSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type AssetDto = z.infer<typeof AssetDtoSchema>

export const AssetListResponseSchema = z.object({
  items: z.array(AssetDtoSchema),
  nextCursor: z.string().nullable(),
})

export type AssetListResponse = z.infer<typeof AssetListResponseSchema>

/**
 * Reserved for a future OSS pre-upload register flow (client uploads to OSS,
 * then registers metadata). Not used by the Phase 0 multipart upload endpoint.
 */
export const CreateAssetRequestSchema = z.object({
  kind: AssetKindSchema,
  title: z.string().min(1),
  description: z.string().optional(),
  mimeType: z.string().optional(),
  size: z.number().optional(),
  storageBucket: z.string().min(1),
  storageKey: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
})

export type CreateAssetRequest = z.infer<typeof CreateAssetRequestSchema>
```

- [ ] **Step 2: Verify contracts typecheck**

Run: `pnpm --filter @super-app/contracts typecheck`
Expected: PASS (the old `AssetDtoSchema` with flat fields is gone; nothing in the repo imports the removed fields yet — confirm no other file references them).

If typecheck fails because some file references the old `AssetDtoSchema` flat fields (`mimeType`, `size`, etc.), grep for `AssetDto` / `AssetKind` usages and confirm they only use the type, not removed fields. (At time of writing, only `packages/contracts/src/index.ts` re-exports these.)

- [ ] **Step 3: Commit**

```bash
git add packages/contracts/src/assets.ts
git commit -m "feat(contracts): redefine AssetKind to 8 creation kinds with file-backed DTOs"
```

---

## Task 2: Rewrite the assets DB schema

**Files:**

- Modify: `packages/db/src/schema/assets.ts`
- Modify: `packages/db/src/index.ts`

- [ ] **Step 1: Rewrite `packages/db/src/schema/assets.ts`**

Replace the entire file with:

```ts
import { relations, sql } from 'drizzle-orm'
import {
  bigint,
  index,
  integer,
  jsonb,
  pgSchema,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

import { createdAtColumn, deletedAtColumn, idColumn, updatedAtColumn } from './common'
import { users } from './identity'

export const assetsSchema = pgSchema('assets')

export const assetKindEnum = assetsSchema.enum('asset_kind', [
  'subject',
  'image',
  'video',
  'audio',
  'text',
  'file',
  'style',
  'template',
])

export const assetStatusEnum = assetsSchema.enum('asset_status', ['active', 'archived', 'deleted'])

export const assetVisibilityEnum = assetsSchema.enum('asset_visibility', [
  'private',
  'shared',
  'public',
])

export const assetSourceEnum = assetsSchema.enum('asset_source', [
  'upload',
  'ai_generation',
  'canvas_export',
  'transfer',
  'manual',
  'import',
])

export const assetFileRoleEnum = assetsSchema.enum('asset_file_role', [
  'original',
  'thumbnail',
  'preview',
  'cover',
  'subtitle',
  'waveform',
  'attachment',
])

export const assets = assetsSchema.table(
  'assets',
  {
    id: idColumn(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: assetKindEnum('kind').notNull(),
    title: varchar('title', { length: 240 }).notNull(),
    description: text('description'),
    status: assetStatusEnum('status').notNull().default('active'),
    visibility: assetVisibilityEnum('visibility').notNull().default('private'),
    source: assetSourceEnum('source').notNull().default('manual'),
    coverAssetId: uuid('cover_asset_id').references((): AnyPgColumn => assets.id, {
      onDelete: 'set null',
    }),
    thumbnailKey: text('thumbnail_key'),
    previewKey: text('preview_key'),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
    deletedAt: deletedAtColumn(),
  },
  (table) => ({
    ownerIdIndex: index('assets_owner_id_idx').on(table.ownerId),
    ownerKindIndex: index('assets_owner_kind_idx').on(table.ownerId, table.kind),
    ownerStatusCreatedIndex: index('assets_owner_status_created_idx').on(
      table.ownerId,
      table.status,
      table.createdAt
    ),
  })
)

export const assetTags = assetsSchema.table(
  'asset_tags',
  {
    id: idColumn(),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    tag: varchar('tag', { length: 80 }).notNull(),
    createdAt: createdAtColumn(),
  },
  (table) => ({
    assetIdIndex: index('asset_tags_asset_id_idx').on(table.assetId),
    assetTagUnique: uniqueIndex('asset_tags_asset_tag_unique').on(table.assetId, table.tag),
  })
)

export const assetFiles = assetsSchema.table(
  'asset_files',
  {
    id: idColumn(),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    role: assetFileRoleEnum('role').notNull(),
    storageBucket: varchar('storage_bucket', { length: 120 }).notNull(),
    storageKey: text('storage_key').notNull(),
    mimeType: varchar('mime_type', { length: 255 }),
    size: bigint('size', { mode: 'number' }),
    width: integer('width'),
    height: integer('height'),
    duration: integer('duration'),
    checksum: text('checksum'),
    createdAt: createdAtColumn(),
  },
  (table) => ({
    assetIdIndex: index('asset_files_asset_id_idx').on(table.assetId),
    storageUnique: uniqueIndex('asset_files_storage_unique').on(
      table.storageBucket,
      table.storageKey
    ),
  })
)

export const assetsRelations = relations(assets, ({ one, many }) => ({
  owner: one(users, {
    fields: [assets.ownerId],
    references: [users.id],
  }),
  coverAsset: one(assets, {
    fields: [assets.coverAssetId],
    references: [assets.id],
    relationName: 'asset_cover',
  }),
  tags: many(assetTags),
  files: many(assetFiles),
}))

export const assetTagsRelations = relations(assetTags, ({ one }) => ({
  asset: one(assets, {
    fields: [assetTags.assetId],
    references: [assets.id],
  }),
}))

export const assetFilesRelations = relations(assetFiles, ({ one }) => ({
  asset: one(assets, {
    fields: [assetFiles.assetId],
    references: [assets.id],
  }),
}))

export type Asset = typeof assets.$inferSelect
export type NewAsset = typeof assets.$inferInsert
export type AssetTag = typeof assetTags.$inferSelect
export type NewAssetTag = typeof assetTags.$inferInsert
export type AssetFile = typeof assetFiles.$inferSelect
export type NewAssetFile = typeof assetFiles.$inferInsert

// Self-reference type for the coverAssetId foreign key.
import type { AnyPgColumn } from 'drizzle-orm/pg-core'
```

> Note on the self-reference: `coverAssetId` references `assets.id` within the same table. Drizzle requires the column type via `AnyPgColumn`. The `import type { AnyPgColumn }` is placed at the bottom of the file (type-only imports are hoisted); if your ESLint config complains about import placement, move it to the top of the file with the other imports — functionally equivalent.

- [ ] **Step 2: Update `packages/db/src/index.ts`**

No change needed — it already does `export * from './schema'`, and `schema/index.ts` does `export * from './assets'`, so `assetFiles` is automatically exported. Verify by reading the file; it should be:

```ts
export * from './client'
export * from './schema'
```

- [ ] **Step 3: Verify db typecheck**

Run: `pnpm --filter @super-app/db typecheck`
Expected: PASS. If it fails on the `AnyPgColumn` import placement, move that import to the top of `assets.ts` with the other `drizzle-orm/pg-core` imports.

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/schema/assets.ts
git commit -m "feat(db): redesign assets table and add asset_files"
```

---

## Task 3: Generate and apply the assets redesign migration

**Files:**

- Create: `packages/db/drizzle/0001_assets_redesign.sql` (generated)
- Modify: `.env`, `.env.example`, `playwright.config.ts` (add storage env — needed before migrate runs cleanly, do it here)

- [ ] **Step 1: Add storage env vars to `.env.example`**

In `.env.example`, find the `SUPER_PUBLIC_API_BASE_URL` line and add after it:

```
SUPER_PUBLIC_STORAGE_BASE_URL=http://localhost:5200/storage
```

Find the `S3_*` block and add after the `ASSETS_ALLOWED_MIME_TYPES` line:

```
STORAGE_DIR=./storage
```

- [ ] **Step 2: Mirror the same additions in `.env`**

Apply the identical two additions to `.env` (same values).

- [ ] **Step 3: Add the public storage URL to `playwright.config.ts` localEnv**

In `playwright.config.ts`, inside the `localEnv` object, after `SUPER_PUBLIC_API_BASE_URL: 'http://localhost:5200/api',` add:

```ts
  SUPER_PUBLIC_STORAGE_BASE_URL: 'http://localhost:5200/storage',
```

- [ ] **Step 4: Add the storage env to the env schemas**

Modify `packages/env/src/public.ts` — add inside `publicEnvSchema` after `SUPER_PUBLIC_API_BASE_URL`:

```ts
  SUPER_PUBLIC_STORAGE_BASE_URL: z.string().url(),
```

Modify `packages/env/src/server.ts` — inside `serverEnvSchema` (which extends `publicEnvSchema`), after the `S3_FORCE_PATH_STYLE` line add:

```ts
  STORAGE_DIR: z.string().min(1).default('./storage'),
```

- [ ] **Step 5: Add `SUPER_PUBLIC_STORAGE_BASE_URL` to turbo globalEnv**

Modify `turbo.json` — in the `globalEnv` array, after `"SUPER_PUBLIC_API_BASE_URL"` add:

```json
"SUPER_PUBLIC_STORAGE_BASE_URL"
```

- [ ] **Step 6: Verify env packages typecheck**

Run: `pnpm --filter @super-app/env typecheck`
Expected: PASS.

- [ ] **Step 7: Start local Postgres**

Run: `pnpm db:local:up`
Expected: docker compose starts postgres.

- [ ] **Step 8: Generate the migration**

Run: `pnpm db:generate`
Expected: Drizzle Kit detects the assets schema changes and writes a new migration file under `packages/db/drizzle/` (named like `0001_*.sql`). **Review the generated SQL** — open the new file and confirm it:

1. Drops the old flat columns from `assets.assets` (`mime_type`, `size`, `storage_bucket`, `storage_key`, `width`, `height`, `duration`) and the old `assets_storage_unique` index.
2. Recreates the `asset_kind` enum with the 8 new values.
3. Adds `asset_status`, `asset_visibility`, `asset_source`, `asset_file_role` enums.
4. Adds `status`, `visibility`, `source`, `cover_asset_id` columns to `assets.assets`.
5. Creates the `assets.asset_files` table with its indexes.

If Drizzle generated a rename instead of drop+recreate for the enum, that's fine as long as the final state matches. Rename the file to `0001_assets_redesign.sql` if Drizzle gave it a random name (so it's deterministic and matches the spec).

- [ ] **Step 9: Apply the migration**

Run: `pnpm db:migrate`
Expected: migration applies cleanly. If it errors on the enum change (because the old enum type is in use), the migration SQL may need a `DROP TYPE` — Drizzle usually handles this; if not, the generated SQL is the source of truth and should be run as-is.

- [ ] **Step 10: Commit**

```bash
git add packages/db/drizzle packages/env/src/public.ts packages/env/src/server.ts .env.example .env playwright.config.ts turbo.json
git commit -m "feat(db): add assets redesign migration and storage env vars"
```

---

## Task 4: Create the @super-app/storage package

**Files:**

- Create: `packages/storage/package.json`
- Create: `packages/storage/tsconfig.json`
- Create: `packages/storage/src/index.ts`
- Create: `packages/storage/src/types.ts`
- Create: `packages/storage/src/local.ts`
- Create: `packages/storage/src/client.ts`

- [ ] **Step 1: Create `packages/storage/package.json`**

```json
{
  "name": "@super-app/storage",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix"
  },
  "dependencies": {
    "@super-app/env": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.8.3"
  }
}
```

- [ ] **Step 2: Create `packages/storage/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "types": ["bun-types"]
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `packages/storage/src/types.ts`**

```ts
export interface StoragePutInput {
  key: string
  body: Buffer
  mimeType: string
}

export interface StoragePutResult {
  key: string
  bucket: string
  url: string
  size: number
}

export interface StorageProvider {
  put(input: StoragePutInput): Promise<StoragePutResult>
  delete(key: string): Promise<void>
}
```

- [ ] **Step 4: Create `packages/storage/src/local.ts`**

```ts
import { mkdir, readFile, rm, stat } from 'node:fs/promises'
import path from 'node:path'

import type { StorageProvider, StoragePutInput, StoragePutResult } from './types'

const LOCAL_BUCKET = 'local'

export interface LocalStorageOptions {
  storageDir: string
  publicBaseUrl: string
}

export class LocalStorageProvider implements StorageProvider {
  private readonly storageDir: string
  private readonly publicBaseUrl: string

  constructor(options: LocalStorageOptions) {
    this.storageDir = options.storageDir
    this.publicBaseUrl = options.publicBaseUrl.replace(/\/$/, '')
  }

  async put(input: StoragePutInput): Promise<StoragePutResult> {
    const filePath = this.resolvePath(input.key)
    await mkdir(path.dirname(filePath), { recursive: true })
    await Bun.write(filePath, input.body)

    const size = await stat(filePath).then((info) => info.size)

    return {
      key: input.key,
      bucket: LOCAL_BUCKET,
      url: this.urlFor(input.key),
      size,
    }
  }

  async delete(key: string): Promise<void> {
    const filePath = this.resolvePath(key)
    await rm(filePath, { force: true })
  }

  async read(key: string): Promise<Buffer> {
    return readFile(this.resolvePath(key))
  }

  urlFor(key: string): string {
    return `${this.publicBaseUrl}/${key}`
  }

  resolvePath(key: string): string {
    const resolved = path.resolve(this.storageDir, key)
    const normalizedRoot = path.resolve(this.storageDir)
    // Prevent path traversal: resolved path must stay under storageDir.
    if (resolved !== normalizedRoot && !resolved.startsWith(normalizedRoot + path.sep)) {
      throw new Error(`Storage key escapes storage dir: ${key}`)
    }
    return resolved
  }
}
```

- [ ] **Step 5: Create `packages/storage/src/client.ts`**

```ts
import { serverEnv } from '@super-app/env/server'

import { LocalStorageProvider } from './local'
import type { StorageProvider } from './types'

export function createStorage(): StorageProvider {
  return new LocalStorageProvider({
    storageDir: serverEnv.STORAGE_DIR,
    publicBaseUrl: serverEnv.SUPER_PUBLIC_STORAGE_BASE_URL,
  })
}
```

- [ ] **Step 6: Create `packages/storage/src/index.ts`**

```ts
export { createStorage } from './client'
export { LocalStorageProvider } from './local'
export type { StorageProvider, StoragePutInput, StoragePutResult } from './types'
```

- [ ] **Step 7: Install dependencies and verify typecheck**

Run: `pnpm install`
Then: `pnpm --filter @super-app/storage typecheck`
Expected: PASS. (Bun globals like `Bun.write` are typed via `bun-types` in tsconfig.)

If `bun-types` is not resolvable from this package, add `"bun-types": "latest"` to `devDependencies` and re-run `pnpm install`.

- [ ] **Step 8: Commit**

```bash
git add packages/storage
git add pnpm-lock.yaml
git commit -m "feat(storage): add @super-app/storage with local-disk provider"
```

---

## Task 5: Extract shared session helpers

**Files:**

- Create: `services/api/src/shared/session.ts`
- Modify: `services/api/src/modules/auth/service.ts`

**Why:** The assets module needs to resolve the current user. The logic currently lives privately in the auth module's `service.ts`. Extract it to a shared location without changing auth behavior.

- [ ] **Step 1: Create `services/api/src/shared/session.ts`**

```ts
import type { Db } from '@super-app/db'
import { sessions, users } from '@super-app/db/schema'
import type { CurrentUser } from '@super-app/contracts/auth'
import { and, eq, gt } from 'drizzle-orm'
import { Buffer } from 'node:buffer'

import { serverEnv } from '@super-app/env/server'

export function getSessionTokenFromCookie(cookieHeader: string | undefined) {
  if (!cookieHeader) {
    return null
  }

  const cookies = cookieHeader.split(';').map((item) => item.trim())
  const prefix = `${serverEnv.SESSION_COOKIE_NAME}=`
  const sessionCookie = cookies.find((item) => item.startsWith(prefix))

  if (!sessionCookie) {
    return null
  }

  return decodeURIComponent(sessionCookie.slice(prefix.length))
}

export async function getCurrentUser(db: Db, token: string | null): Promise<CurrentUser | null> {
  if (!token) {
    return null
  }

  const tokenHash = await hashSessionToken(token)
  const [session] = await db
    .select({
      userId: users.id,
      email: users.email,
      name: users.name,
      avatarUrl: users.avatarUrl,
      status: users.status,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, new Date())))
    .limit(1)

  if (!session || session.status !== 'active') {
    return null
  }

  return {
    id: session.userId,
    email: session.email,
    name: session.name ?? undefined,
    avatarUrl: session.avatarUrl ?? undefined,
    roles: ['user'],
  }
}

async function hashSessionToken(token: string) {
  const data = new TextEncoder().encode(`${token}.${serverEnv.SESSION_SECRET}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Buffer.from(digest).toString('hex')
}
```

- [ ] **Step 2: Remove the extracted functions from `services/api/src/modules/auth/service.ts`**

In `services/api/src/modules/auth/service.ts`:

a) Delete the `getSessionTokenFromCookie` function (lines defining it) and the `getCurrentUser` function and the `hashSessionToken` helper — these now live in `shared/session.ts`.

b) Add an import at the top:

```ts
import { getCurrentUser, getSessionTokenFromCookie } from '../../shared/session'
```

c) The file must still export `createSessionCookie`, `createExpiredSessionCookie`, `registerUser`, `loginUser`, `logoutUser`, and `createSessionForUser`. `createSessionForUser` calls `getCurrentUser` — now imported. `hashSessionToken` was used by both `createSessionForUser` and `logoutUser` in the old file; since it's now in `shared/session.ts` (not exported), `createSessionForUser` and `logoutUser` need the hash too.

After editing, the relevant parts of `service.ts` should look like this (the session-token hashing for insert/delete stays here as a small local helper, OR you export `hashSessionToken` from `shared/session.ts`). **Choose: export `hashSessionToken` from `shared/session.ts`** and import it here, to avoid duplication.

Update `shared/session.ts` to also export `hashSessionToken`:

```ts
export async function hashSessionToken(token: string) {
  const data = new TextEncoder().encode(`${token}.${serverEnv.SESSION_SECRET}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Buffer.from(digest).toString('hex')
}
```

Then in `service.ts`, the full resulting file is:

```ts
import type { Db } from '@super-app/db'
import { sessions, users } from '@super-app/db/schema'
import type { CurrentUser, LoginRequest, RegisterRequest } from '@super-app/contracts/auth'
import { eq } from 'drizzle-orm'

import { serverEnv } from '@super-app/env/server'

import { AppError } from '../../shared/errors'
import { getCurrentUser, getSessionTokenFromCookie, hashSessionToken } from '../../shared/session'

export type { CurrentUser } from '@super-app/contracts/auth'

const sessionCookiePath = '/'

export interface SessionCookieOptions {
  expires?: Date
  maxAge?: number
}

export function createSessionCookie(token: string, options: SessionCookieOptions = {}) {
  const parts = [
    `${serverEnv.SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=' + sessionCookiePath,
    'HttpOnly',
    `SameSite=${serverEnv.COOKIE_SAME_SITE}`,
  ]

  if (serverEnv.COOKIE_SECURE) {
    parts.push('Secure')
  }

  if (options.expires) {
    parts.push(`Expires=${options.expires.toUTCString()}`)
  }

  if (typeof options.maxAge === 'number') {
    parts.push(`Max-Age=${options.maxAge}`)
  }

  return parts.join('; ')
}

export function createExpiredSessionCookie() {
  return createSessionCookie('', {
    expires: new Date(0),
    maxAge: 0,
  })
}

// Re-exported so existing imports of these from the auth service still resolve.
export { getCurrentUser, getSessionTokenFromCookie }

export async function registerUser(db: Db, input: RegisterRequest) {
  const email = normalizeEmail(input.email)
  const existingUser = await findUserByEmail(db, email)

  if (existingUser) {
    throw new AppError(409, 'CONFLICT', 'Email is already registered')
  }

  const passwordHash = await Bun.password.hash(input.password)
  const [user] = await db
    .insert(users)
    .values({
      email,
      passwordHash,
      name: input.name,
    })
    .returning()

  if (!user) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to create user')
  }

  return createSessionForUser(db, user.id)
}

export async function loginUser(db: Db, input: LoginRequest) {
  const email = normalizeEmail(input.email)
  const user = await findUserByEmail(db, email)

  if (!user || user.status !== 'active') {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid email or password')
  }

  const passwordMatches = await Bun.password.verify(input.password, user.passwordHash)

  if (!passwordMatches) {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid email or password')
  }

  return createSessionForUser(db, user.id)
}

export async function logoutUser(db: Db, token: string | null) {
  if (!token) {
    return
  }

  const tokenHash = await hashSessionToken(token)

  await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash))
}

async function createSessionForUser(db: Db, userId: string) {
  const token = createSessionToken()
  const tokenHash = await hashSessionToken(token)
  const expiresAt = new Date(Date.now() + serverEnv.SESSION_TTL_SECONDS * 1000)

  await db.insert(sessions).values({
    userId,
    tokenHash,
    expiresAt,
  })

  const currentUser = await getCurrentUser(db, token)

  if (!currentUser) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to create session')
  }

  return {
    token,
    expiresAt,
    user: currentUser,
  }
}

function createSessionToken() {
  const randomBytes = crypto.getRandomValues(new Uint8Array(32))
  return Buffer.from(randomBytes).toString('base64url')
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

async function findUserByEmail(db: Db, email: string) {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)
  return user ?? null
}
```

- [ ] **Step 3: Verify auth still typechecks and tests pass**

Run: `pnpm --filter @super-app/api typecheck`
Expected: PASS.

Run: `pnpm --filter @super-app/api test`
Expected: PASS — `auth.test.ts` must still be green (behavior unchanged, pure refactor).

- [ ] **Step 4: Commit**

```bash
git add services/api/src/shared/session.ts services/api/src/modules/auth/service.ts
git commit -m "refactor(api): extract session helpers to shared module"
```

---

## Task 6: Create the shared auth plugin

**Files:**

- Create: `services/api/src/plugins/auth.ts`
- Modify: `services/api/src/modules/auth/index.ts`
- Modify: `services/api/src/app.ts`

- [ ] **Step 1: Create `services/api/src/plugins/auth.ts`**

> **Verified approach (do not use macros):** In Elysia 1.4.29 the `.macro()` + `{ auth: 'requireUser' }` route option does **not** fire its `resolve`. This was tested empirically against the installed version — unauthenticated requests returned 200 instead of 401. The `.guard({ beforeHandle })` pattern **does** work correctly. Therefore the auth plugin derives `user`, and a separate exported `requireUser` guard is applied via `.guard()` wrapping the route group. This is the form used below and in Task 8.

```ts
import type { CurrentUser } from '@super-app/contracts/auth'
import { Elysia } from 'elysia'

import { fail } from '../shared/response'
import { getCurrentUser, getSessionTokenFromCookie } from '../shared/session'
import { dbPlugin } from './db'

export interface AuthContext {
  user: CurrentUser | null
}

// Derives `user` (null when unauthenticated) into every handler under this plugin's scope.
export const authPlugin = new Elysia({ name: 'auth' })
  .use(dbPlugin)
  .derive({ as: 'scoped' }, async ({ db, headers }): Promise<AuthContext> => {
    const token = getSessionTokenFromCookie(headers.cookie)
    const user = await getCurrentUser(db, token)
    return { user }
  })

// Guard that rejects unauthenticated requests with 401 + unified error shape.
// Apply by wrapping a group: `.guard({ beforeHandle: requireUser }, (g) => g.group('/assets', ...))`
export function requireUser({ user, set }: { user: CurrentUser | null; set: any }) {
  if (!user) {
    set.status = 401
    return fail('UNAUTHORIZED', 'Unauthorized')
  }
}
```

- [ ] **Step 2: Refactor `services/api/src/modules/auth/index.ts` to use the plugin**

Replace the entire file with:

```ts
import { LoginRequestSchema, RegisterRequestSchema } from '@super-app/contracts/auth'
import { Elysia } from 'elysia'

import { authPlugin } from '../../plugins/auth'
import {
  createExpiredSessionCookie,
  createSessionCookie,
  logoutUser,
  registerUser,
  loginUser,
} from './service'

export const authModule = new Elysia({ name: 'auth' }).use(authPlugin).group('/auth', (auth) =>
  auth
    .post(
      '/register',
      async ({ body, db, set }) => {
        const session = await registerUser(db, body)
        set.headers['Set-Cookie'] = createSessionCookie(session.token, {
          expires: session.expiresAt,
        })

        return ok(session.user)
      },
      {
        body: RegisterRequestSchema,
      }
    )
    .post(
      '/login',
      async ({ body, db, set }) => {
        const session = await loginUser(db, body)
        set.headers['Set-Cookie'] = createSessionCookie(session.token, {
          expires: session.expiresAt,
        })

        return ok(session.user)
      },
      {
        body: LoginRequestSchema,
      }
    )
    .post('/logout', async ({ db, headers, set }) => {
      const token = getSessionTokenFromCookie(headers.cookie)
      await logoutUser(db, token)
      set.headers['Set-Cookie'] = createExpiredSessionCookie()

      return ok({ loggedOut: true })
    })
    .get('/me', async ({ user, set }) => {
      if (!user) {
        set.status = 401
        return fail('UNAUTHORIZED', 'Unauthorized')
      }

      return ok(user)
    })
)

import { getSessionTokenFromCookie } from '../../shared/session'
import { fail, ok } from '../../shared/response'
```

> The trailing imports are hoisted in ESM; if your linter flags them, move all imports to the top of the file (preferred). The behavioral change: `/me` now reads `user` from the plugin derive instead of manually resolving the cookie.

- [ ] **Step 3: Verify auth tests still pass**

Run: `pnpm --filter @super-app/api typecheck && pnpm --filter @super-app/api test`
Expected: PASS. The `/me` route now uses the plugin-derived `user`; the test asserts the same 200/401 behavior.

Note: `auth/index.ts` here does **not** apply `requireUser` (register/login/logout are public, and `/me` already returns 401 manually when `user` is null). The `requireUser` guard is only consumed in Task 8's assets routes.

- [ ] **Step 4: Commit**

```bash
git add services/api/src/plugins/auth.ts services/api/src/modules/auth/index.ts
git commit -m "feat(api): add shared auth plugin and adopt it in auth module"
```

---

## Task 7: Create the storage plugin and assets API service

**Files:**

- Create: `services/api/src/plugins/storage.ts`
- Create: `services/api/src/modules/assets/service.ts`

- [ ] **Step 1: Create `services/api/src/plugins/storage.ts`**

```ts
import { createStorage } from '@super-app/storage'
import { Elysia } from 'elysia'

export const storagePlugin = new Elysia({ name: 'storage' }).decorate('storage', createStorage())
```

- [ ] **Step 2: Create `services/api/src/modules/assets/service.ts`**

```ts
import type { CurrentUser } from '@super-app/contracts/auth'
import type {
  AssetDto,
  AssetFileDto,
  AssetKind,
  AssetListResponse,
} from '@super-app/contracts/assets'
import type { Db } from '@super-app/db'
import { assetFiles, assets } from '@super-app/db/schema'
import type { StorageProvider } from '@super-app/storage'
import { and, desc, eq, lt, or } from 'drizzle-orm'

import { serverEnv } from '@super-app/env/server'

import { AppError } from '../../shared/errors'

const MAX_LIMIT = 50
const DEFAULT_LIMIT = 20

export function inferKindFromMimeType(mimeType: string): AssetKind {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('audio/')) return 'audio'
  return 'file'
}

export function parseAllowedMimeTypes(): Set<string> {
  return new Set(
    serverEnv.ASSETS_ALLOWED_MIME_TYPES.split(',')
      .map((value) => value.trim())
      .filter(Boolean)
  )
}

export function maxUploadBytes(): number {
  return serverEnv.ASSETS_MAX_UPLOAD_SIZE_MB * 1024 * 1024
}

export interface UploadAssetInput {
  db: Db
  storage: StorageProvider
  owner: CurrentUser
  fileName: string
  mimeType: string
  size: number
  body: Buffer
}

export async function uploadAsset(input: UploadAssetInput): Promise<AssetDto> {
  const { db, storage, owner, fileName, mimeType, size, body } = input
  const kind = inferKindFromMimeType(mimeType)

  const [asset] = await db
    .insert(assets)
    .values({
      ownerId: owner.id,
      kind,
      title: fileName,
      source: 'upload',
      status: 'active',
      visibility: 'private',
    })
    .returning()

  if (!asset) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to create asset')
  }

  const storageKey = `${owner.id}/${asset.id}/original/${sanitizeFileName(fileName)}`
  const stored = await storage.put({ key: storageKey, body, mimeType })

  await db.insert(assetFiles).values({
    assetId: asset.id,
    role: 'original',
    storageBucket: stored.bucket,
    storageKey: stored.key,
    mimeType,
    size,
  })

  const withFiles = await loadAssetWithFiles(db, asset.id)
  if (!withFiles) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to load created asset')
  }
  return withFiles
}

export interface ListAssetsInput {
  db: Db
  owner: CurrentUser
  kind?: AssetKind
  limit?: number
  cursor?: string | null
}

export async function listAssets(input: ListAssetsInput): Promise<AssetListResponse> {
  const { db, owner, kind, limit, cursor } = input
  const effectiveLimit = Math.min(Math.max(limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT)
  const cursorTuple = decodeCursor(cursor)

  const conditions = [eq(assets.ownerId, owner.id), eq(assets.status, 'active')]
  if (kind) {
    conditions.push(eq(assets.kind, kind))
  }
  if (cursorTuple) {
    const [cursorCreatedAt, cursorId] = cursorTuple
    conditions.push(
      or(
        lt(assets.createdAt, cursorCreatedAt),
        and(eq(assets.createdAt, cursorCreatedAt), lt(assets.id, cursorId))
      )
    )
  }

  const rows = await db
    .select()
    .from(assets)
    .where(and(...conditions))
    .orderBy(desc(assets.createdAt), desc(assets.id))
    .limit(effectiveLimit + 1)

  const hasMore = rows.length > effectiveLimit
  const page = hasMore ? rows.slice(0, effectiveLimit) : rows

  const fileResults = await Promise.all(page.map((row) => loadFilesForAsset(db, row.id)))
  const items: AssetDto[] = page.map((row, index) => toAssetDto(row, fileResults[index]))

  const nextCursor =
    hasMore && page.length > 0
      ? encodeCursor(page[page.length - 1].createdAt, page[page.length - 1].id)
      : null

  return { items, nextCursor }
}

export async function getAsset(input: {
  db: Db
  owner: CurrentUser
  id: string
}): Promise<AssetDto> {
  const { db, owner, id } = input
  const [asset] = await db
    .select()
    .from(assets)
    .where(and(eq(assets.id, id), eq(assets.ownerId, owner.id)))
    .limit(1)

  if (!asset) {
    throw new AppError(404, 'NOT_FOUND', 'Asset not found')
  }

  const files = await loadFilesForAsset(db, id)
  return toAssetDto(asset, files)
}

export async function deleteAsset(input: {
  db: Db
  owner: CurrentUser
  id: string
}): Promise<void> {
  const { db, owner, id } = input
  const [updated] = await db
    .update(assets)
    .set({ status: 'deleted', deletedAt: new Date() })
    .where(and(eq(assets.id, id), eq(assets.ownerId, owner.id)))
    .returning({ id: assets.id })

  if (!updated) {
    throw new AppError(404, 'NOT_FOUND', 'Asset not found')
  }
}

async function loadAssetWithFiles(db: Db, assetId: string): Promise<AssetDto | null> {
  const [asset] = await db.select().from(assets).where(eq(assets.id, assetId)).limit(1)
  if (!asset) {
    return null
  }
  const files = await loadFilesForAsset(db, assetId)
  return toAssetDto(asset, files)
}

async function loadFilesForAsset(
  db: Db,
  assetId: string
): Promise<(typeof assetFiles.$inferSelect)[]> {
  return db
    .select()
    .from(assetFiles)
    .where(eq(assetFiles.assetId, assetId))
    .orderBy(desc(assetFiles.createdAt))
}

export function toAssetDto(
  asset: typeof assets.$inferSelect,
  files: (typeof assetFiles.$inferSelect)[]
): AssetDto {
  const baseUrl = serverEnv.SUPER_PUBLIC_STORAGE_BASE_URL.replace(/\/$/, '')
  const fileDtos: AssetFileDto[] = files.map((file) => ({
    id: file.id,
    role: file.role,
    storageBucket: file.storageBucket,
    storageKey: file.storageKey,
    url: `${baseUrl}/${file.storageKey}`,
    mimeType: file.mimeType ?? undefined,
    size: file.size ?? undefined,
    width: file.width ?? undefined,
    height: file.height ?? undefined,
    duration: file.duration ?? undefined,
    createdAt: file.createdAt.toISOString(),
  }))

  return {
    id: asset.id,
    kind: asset.kind,
    title: asset.title,
    description: asset.description ?? undefined,
    status: asset.status,
    visibility: asset.visibility,
    source: asset.source,
    thumbnailUrl: asset.thumbnailKey ? `${baseUrl}/${asset.thumbnailKey}` : undefined,
    previewUrl: asset.previewKey ? `${baseUrl}/${asset.previewKey}` : undefined,
    metadata: asset.metadata,
    files: fileDtos,
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
  }
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_')
}

function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.toISOString()}|${id}`).toString('base64url')
}

function decodeCursor(cursor: string | null | undefined): [Date, string] | null {
  if (!cursor) {
    return null
  }
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8')
    const [createdAt, id] = decoded.split('|')
    const date = new Date(createdAt)
    if (isNaN(date.getTime()) || !id) {
      return null
    }
    return [date, id]
  } catch {
    return null
  }
}
```

> `or(...)` returns a valid SQL expression (not null), so no `!` assertion is needed. `listAssets` now loads files per-page via `loadFilesForAsset` and maps in lockstep (no `.filter(Boolean)` — every page row yields a dto). `getAsset` does its own owner-scoped asset lookup (the `and(...ownerId...)` where clause enforces ownership → 404 for other users' assets).

- [ ] **Step 3: Verify the service typechecks**

Run: `pnpm --filter @super-app/api typecheck`
Expected: PASS. (Routes not wired yet, but the service module must compile.)

- [ ] **Step 4: Commit**

```bash
git add services/api/src/plugins/storage.ts services/api/src/modules/assets/service.ts
git commit -m "feat(api): add storage plugin and assets service"
```

---

## Task 8: Wire the assets API routes

**Files:**

- Create: `services/api/src/modules/assets/index.ts`
- Modify: `services/api/src/app.ts`

- [ ] **Step 1: Create `services/api/src/modules/assets/index.ts`**

> **Auth form (verified):** `.guard({ beforeHandle: requireUser }, (g) => g.group('/assets', ...))`. The guard wraps the group at the top level so every route inside is protected. `user` is non-null inside handlers because `requireUser` already returned 401 otherwise; `user!` is safe.

```ts
import { Elysia, t } from 'elysia'

import { authPlugin, requireUser } from '../../plugins/auth'
import { storagePlugin } from '../../plugins/storage'
import { AppError } from '../../shared/errors'
import { ok } from '../../shared/response'
import {
  deleteAsset,
  getAsset,
  listAssets,
  maxUploadBytes,
  parseAllowedMimeTypes,
  uploadAsset,
} from './service'

export const assetsModule = new Elysia({ name: 'assets' })
  .use(authPlugin)
  .use(storagePlugin)
  .guard({ beforeHandle: requireUser }, (guarded) =>
    guarded.group('/assets', (assets) =>
      assets
        .post(
          '/upload',
          async ({ user, db, storage, body }) => {
            const file = body.file
            const allowed = parseAllowedMimeTypes()
            const max = maxUploadBytes()

            if (file.size > max) {
              throw new AppError(413, 'VALIDATION_ERROR', 'File too large')
            }
            if (!allowed.has(file.type)) {
              throw new AppError(415, 'VALIDATION_ERROR', 'Unsupported file type')
            }

            const asset = await uploadAsset({
              db,
              storage,
              owner: user!,
              fileName: file.name,
              mimeType: file.type,
              size: file.size,
              body: Buffer.from(await file.arrayBuffer()),
            })

            return ok(asset)
          },
          {
            body: t.Object({
              file: t.File(),
            }),
          }
        )
        .get(
          '/',
          async ({ user, db, query }) => {
            const result = await listAssets({
              db,
              owner: user!,
              kind: query.kind,
              limit: query.limit,
              cursor: query.cursor,
            })
            return ok(result)
          },
          {
            query: t.Object({
              kind: t.Optional(
                t.Enum({
                  subject: 'subject',
                  image: 'image',
                  video: 'video',
                  audio: 'audio',
                  text: 'text',
                  file: 'file',
                  style: 'style',
                  template: 'template',
                })
              ),
              limit: t.Optional(t.Number({ minimum: 1, maximum: 50 })),
              cursor: t.Optional(t.String()),
            }),
          }
        )
        .get('/:id', async ({ user, db, params }) => {
          const asset = await getAsset({ db, owner: user!, id: params.id })
          return ok(asset)
        })
        .delete('/:id', async ({ user, db, params }) => {
          await deleteAsset({ db, owner: user!, id: params.id })
          return ok({ deleted: true })
        })
    )
  )
```

- [ ] **Step 2: Register the assets module in `services/api/src/app.ts`**

Modify `services/api/src/app.ts` — add the storage static route + the assets module. Replace the entire file with:

```ts
import { openapi } from '@elysia/openapi'
import { Elysia, t } from 'elysia'
import { stat } from 'node:fs/promises'
import path from 'node:path'
import { createReadStream } from 'node:fs'

import { serverEnv } from '@super-app/env/server'

import { authModule } from './modules/auth'
import { assetsModule } from './modules/assets'
import { systemModule } from './modules/system'
import { corsPlugin } from './plugins/cors'
import { errorHandler } from './middlewares/error-handler'

const storageRoot = path.resolve(serverEnv.STORAGE_DIR)

export const app = new Elysia()
  .use(
    openapi({
      path: '/api/openapi',
    })
  )
  .use(corsPlugin)
  .use(errorHandler)
  .group('/api', (api) => api.use(systemModule).use(authModule).use(assetsModule))
  // Dev-only static serving of uploaded asset files.
  .get('/storage/*', async ({ params, set }) => {
    const relative = (params as { '*': string })['*']
    const resolved = path.resolve(storageRoot, relative)
    const normalizedRoot = path.resolve(storageRoot)
    if (resolved !== normalizedRoot && !resolved.startsWith(normalizedRoot + path.sep)) {
      set.status = 404
      return 'Not found'
    }
    try {
      const info = await stat(resolved)
      if (info.isDirectory()) {
        set.status = 404
        return 'Not found'
      }
    } catch {
      set.status = 404
      return 'Not found'
    }
    set.headers['Content-Type'] = mimeTypeForExt(path.extname(resolved))
    return createReadStream(resolved) as unknown as ReadableStream
  })

export type App = typeof app

function mimeTypeForExt(ext: string): string {
  const map: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.pdf': 'application/pdf',
  }
  return map[ext.toLowerCase()] ?? 'application/octet-stream'
}
```

- [ ] **Step 3: Verify typecheck**

Run: `pnpm --filter @super-app/api typecheck`
Expected: PASS. Resolve any macro/group typing issues by adjusting the macro usage per Elysia 1.4.29's API (e.g., apply `requireUser` via `.guard` if macro doesn't typecheck).

- [ ] **Step 4: Commit**

```bash
git add services/api/src/modules/assets/index.ts services/api/src/app.ts
git commit -m "feat(api): wire assets upload/list/detail/delete routes"
```

---

## Task 9: Write the assets API integration tests

**Files:**

- Create: `services/api/src/modules/assets/assets.test.ts`

- [ ] **Step 1: Write `services/api/src/modules/assets/assets.test.ts`**

```ts
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { db } from '@super-app/db'
import { assetFiles, assets, sessions, users } from '@super-app/db/schema'
import { eq } from 'drizzle-orm'
import { rm } from 'node:fs/promises'
import path from 'node:path'

import { serverEnv } from '@super-app/env/server'

import { app } from '../../app'

const createdUserIds: string[] = []

describe('assets module', () => {
  let cookie: string
  let userId: string

  beforeAll(async () => {
    const email = `assets-${Date.now()}-${crypto.randomUUID()}@example.test`
    const res = await app.handle(
      new Request('http://localhost/api/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password: 'correct-horse-battery', name: 'Assets Tester' }),
      })
    )
    const body = await res.json()
    userId = body.data.id
    createdUserIds.push(userId)
    cookie = res.headers.get('set-cookie')!.split(';')[0]
  })

  afterAll(async () => {
    for (const id of createdUserIds) {
      await db
        .delete(assetFiles)
        .where(
          eq(
            assetFiles.assetId,
            (await db.select({ id: assets.id }).from(assets).where(eq(assets.ownerId, id)))[0]
              ?.id ?? ''
          )
        )
      await db.delete(sessions).where(eq(sessions.userId, id))
      await db.delete(assets).where(eq(assets.ownerId, id))
      await db.delete(users).where(eq(users.id, id))
    }
  })

  it('uploads an image, lists it, gets detail, and deletes it', async () => {
    const uploadRes = await app.handle(
      new Request('http://localhost/api/assets/upload', {
        method: 'POST',
        headers: { cookie },
        body: multipartBody(pngBytes(), 'sample.png', 'image/png'),
      })
    )
    expect(uploadRes.status).toBe(200)
    const uploaded = await uploadRes.json()
    expect(uploaded.success).toBe(true)
    expect(uploaded.data.kind).toBe('image')
    expect(uploaded.data.files).toHaveLength(1)
    expect(uploaded.data.files[0].role).toBe('original')

    const assetId = uploaded.data.id

    // file exists on disk
    const filePath = path.join(serverEnv.STORAGE_DIR, uploaded.data.files[0].storageKey)
    const fileStat = await Bun.file(filePath).exists()
    expect(fileStat).toBe(true)

    // list
    const listRes = await app.handle(
      new Request('http://localhost/api/assets/', { headers: { cookie } })
    )
    expect(listRes.status).toBe(200)
    const listBody = await listRes.json()
    expect(listBody.data.items.some((a: { id: string }) => a.id === assetId)).toBe(true)

    // list filtered by kind
    const imageListRes = await app.handle(
      new Request('http://localhost/api/assets/?kind=image', { headers: { cookie } })
    )
    const imageList = await imageListRes.json()
    expect(imageList.data.items.every((a: { kind: string }) => a.kind === 'image')).toBe(true)

    // detail
    const detailRes = await app.handle(
      new Request(`http://localhost/api/assets/${assetId}`, { headers: { cookie } })
    )
    expect(detailRes.status).toBe(200)
    const detail = await detailRes.json()
    expect(detail.data.id).toBe(assetId)

    // delete
    const deleteRes = await app.handle(
      new Request(`http://localhost/api/assets/${assetId}`, {
        method: 'DELETE',
        headers: { cookie },
      })
    )
    expect(deleteRes.status).toBe(200)
    const deleteBody = await deleteRes.json()
    expect(deleteBody.data.deleted).toBe(true)

    // excluded from list after delete
    const listAfterDelete = await app.handle(
      new Request('http://localhost/api/assets/', { headers: { cookie } })
    )
    const afterDelete = await listAfterDelete.json()
    expect(afterDelete.data.items.some((a: { id: string }) => a.id === assetId)).toBe(false)
  })

  it('rejects an oversized file with 413', async () => {
    const tooBig = new Uint8Array(maxUploadBytes() + 1)
    const res = await app.handle(
      new Request('http://localhost/api/assets/upload', {
        method: 'POST',
        headers: { cookie },
        body: multipartBody(tooBig, 'big.png', 'image/png'),
      })
    )
    expect(res.status).toBe(413)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('rejects an unsupported mime type with 415', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/assets/upload', {
        method: 'POST',
        headers: { cookie },
        body: multipartBody(new Uint8Array([1, 2, 3]), 'weird.exe', 'application/x-msdownload'),
      })
    )
    expect(res.status).toBe(415)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 404 for another user asset', async () => {
    // create an asset owned by a different user
    const otherEmail = `other-${Date.now()}-${crypto.randomUUID()}@example.test`
    const otherRes = await app.handle(
      new Request('http://localhost/api/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: otherEmail, password: 'correct-horse-battery' }),
      })
    )
    const otherBody = await otherRes.json()
    const otherId = otherBody.data.id
    createdUserIds.push(otherId)
    const otherCookie = otherRes.headers.get('set-cookie')!.split(';')[0]

    const uploadRes = await app.handle(
      new Request('http://localhost/api/assets/upload', {
        method: 'POST',
        headers: { cookie: otherCookie },
        body: multipartBody(pngBytes(), 'other.png', 'image/png'),
      })
    )
    const uploaded = await uploadRes.json()
    const otherAssetId = uploaded.data.id

    // primary user tries to read it -> 404
    const res = await app.handle(
      new Request(`http://localhost/api/assets/${otherAssetId}`, { headers: { cookie } })
    )
    expect(res.status).toBe(404)
  })

  it('returns 401 for unauthenticated upload', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/assets/upload', {
        method: 'POST',
        body: multipartBody(pngBytes(), 'anon.png', 'image/png'),
      })
    )
    expect(res.status).toBe(401)
  })
})

function pngBytes(): Uint8Array {
  // minimal 1x1 PNG
  return new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
    0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x62, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
    0x42, 0x60, 0x82,
  ])
}

function maxUploadBytes(): number {
  return serverEnv.ASSETS_MAX_UPLOAD_SIZE_MB * 1024 * 1024
}

function multipartBody(bytes: Uint8Array, fileName: string, mimeType: string): FormData {
  const form = new FormData()
  form.append('file', new Blob([bytes], { type: mimeType }), fileName)
  return form
}
```

- [ ] **Step 2: Ensure the storage dir is writable and the DB is migrated**

Run: `pnpm db:local:up && pnpm db:migrate`
Expected: postgres up, migrations applied.

- [ ] **Step 3: Run the assets tests**

Run: `pnpm --filter @super-app/api test`
Expected: all tests PASS (both `auth.test.ts` and `assets.test.ts`).

If the 413 test fails because the server reads `file.size` as 0 (Bun's `t.File()` may not populate size from a Blob), check how Elysia 1.4.29 reports multipart file size — you may need to read `await file.arrayBuffer().byteLength` for the size check instead of `file.size`. Adjust `service.ts` `uploadAsset` input accordingly: pass the actual byte length from `arrayBuffer` as `size`, and validate against `maxUploadBytes()` using that length.

- [ ] **Step 4: Commit**

```bash
git add services/api/src/modules/assets/assets.test.ts
git commit -m "test(api): add assets module integration tests"
```

---

## Task 10: Extend the api-client with assetsApi

**Files:**

- Modify: `packages/api-client/src/index.ts`

- [ ] **Step 1: Add imports and `assetsApi` to `packages/api-client/src/index.ts`**

At the top of the file, add to the existing imports:

```ts
import type { AssetDto, AssetKind, AssetListResponse } from '@super-app/contracts/assets'
```

At the bottom of the file (after the `authApi` object), add:

```ts
export const assetsApi = {
  upload(file: File) {
    const form = new FormData()
    form.append('file', file)
    return apiFetch<AssetDto>('/assets/upload', {
      method: 'POST',
      body: form,
    })
  },
  list(params?: { kind?: AssetKind; limit?: number; cursor?: string }) {
    const qs = new URLSearchParams()
    if (params?.kind) qs.set('kind', params.kind)
    if (params?.limit) qs.set('limit', String(params.limit))
    if (params?.cursor) qs.set('cursor', params.cursor)
    const query = qs.toString()
    return apiFetch<AssetListResponse>(`/assets/${query ? `?${query}` : ''}`)
  },
  get(id: string) {
    return apiFetch<AssetDto>(`/assets/${id}`)
  },
  remove(id: string) {
    return apiFetch<{ deleted: true }>(`/assets/${id}`, { method: 'DELETE' })
  },
}
```

> Critical: `mergeHeaders` in the existing api-client forces `Content-Type: application/json`. For the FormData upload this is wrong — the browser must set the multipart boundary. **Update `mergeHeaders`** so that when the body is a `FormData` instance, the default `Content-Type` header is omitted.

Replace the `mergeHeaders` function with:

```ts
function mergeHeaders(
  headers: HeadersInit | undefined,
  body?: BodyInit | null
): Record<string, string> {
  const base: Record<string, string> = {}
  // Do not force JSON content-type for FormData; the browser sets the multipart boundary.
  if (!(body instanceof FormData)) {
    base['Content-Type'] = 'application/json'
  }
  return {
    ...base,
    ...headersToObject(headers),
  }
}
```

And update the call site in `apiFetch` to pass `body`:

```ts
const response = await fetch(`${clientEnv.SUPER_PUBLIC_API_BASE_URL}${path}`, {
  ...requestOptions,
  credentials: 'include',
  headers: mergeHeaders(requestOptions.headers, requestOptions.body),
})
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm --filter @super-app/api-client typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/api-client/src/index.ts
git commit -m "feat(api-client): add assetsApi and fix FormData content-type handling"
```

---

## Task 11: Scaffold the apps/assets frontend

**Files:**

- Create: `apps/assets/package.json`
- Create: `apps/assets/tsconfig.json`
- Create: `apps/assets/vite.config.ts`
- Create: `apps/assets/index.html`
- Create: `apps/assets/src/main.tsx`
- Create: `apps/assets/src/styles.css`

- [ ] **Step 1: Create `apps/assets/package.json`**

```json
{
  "name": "@super-app/assets",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 0.0.0.0 --port 5105",
    "build": "tsc --noEmit && vite build",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "typecheck": "tsc --noEmit",
    "test": "echo \"No tests yet\""
  },
  "dependencies": {
    "@super-app/api-client": "workspace:*",
    "@super-app/auth-client": "workspace:*",
    "@super-app/design-tokens": "workspace:*",
    "@super-app/env": "workspace:*",
    "react": "^19.1.0",
    "react-dom": "^19.1.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.1.17",
    "@types/react": "^19.1.8",
    "@types/react-dom": "^19.1.6",
    "@vitejs/plugin-react": "^4.7.0",
    "tailwindcss": "^4.1.17",
    "typescript": "^5.8.3",
    "vite": "^7.0.0"
  }
}
```

- [ ] **Step 2: Create `apps/assets/tsconfig.json`**

Copy from `apps/auth/tsconfig.json` exactly (read it first, then replicate). It references React JSX and extends root tsconfig.

- [ ] **Step 3: Create `apps/assets/vite.config.ts`**

```ts
import path from 'node:path'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  envDir: path.resolve(__dirname, '../..'),
  envPrefix: 'SUPER_PUBLIC_',
  base: '/assets/',
  build: {
    assetsDir: '_assets',
  },
  server: {
    port: 5105,
  },
})
```

- [ ] **Step 4: Create `apps/assets/index.html`**

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" href="https://cdn.jsdmirror.com/gh/puzzle-fuzzy/cdn@main/super/logo.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Super · 资产</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create `apps/assets/src/main.tsx`**

Mirror `apps/auth/src/main.tsx`. Read it first, then create `apps/assets/src/main.tsx` with the same structure but importing `AssetsApp` instead of `AuthApp`:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { AssetsApp } from './screens/AssetsApp'
import './styles.css'

const container = document.getElementById('root')
if (!container) {
  throw new Error('Root container not found')
}

createRoot(container).render(
  <StrictMode>
    <AssetsApp />
  </StrictMode>
)
```

- [ ] **Step 6: Create `apps/assets/src/styles.css`**

Copy the import line and any shared base from `apps/auth/src/styles.css`. Read it first. The file imports the design tokens and tailwind; mirror it. A minimal version:

```css
@import '@super-app/design-tokens/src/tokens.css';
@import 'tailwindcss';

body {
  margin: 0;
}
```

(Confirm the exact import path used by `apps/auth/src/styles.css` and replicate it.)

- [ ] **Step 7: Install and verify the app builds/typechecks**

Run: `pnpm install`
Then: `pnpm --filter @super-app/assets typecheck`
Expected: typecheck may fail because `AssetsApp` doesn't exist yet — that's fine, created in Task 12. But the config files should be valid. Run `pnpm --filter @super-app/assets build` only after Task 12.

- [ ] **Step 8: Commit**

```bash
git add apps/assets
git add pnpm-lock.yaml
git commit -m "feat(assets): scaffold assets frontend app"
```

---

## Task 12: Implement the AssetsApp component

**Files:**

- Create: `apps/assets/src/screens/AssetsApp.tsx`

- [ ] **Step 1: Create `apps/assets/src/screens/AssetsApp.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react'

import type { AssetDto, AssetKind } from '@super-app/contracts/assets'
import { assetsApi } from '@super-app/api-client'
import { clientEnv } from '@super-app/env/client'
import { logout } from '@super-app/auth-client'
import { useRequireAuth } from '@super-app/auth-client/react'

type FilterKind = 'all' | AssetKind

interface FilterOption {
  value: FilterKind
  label: string
  disabled?: boolean
}

const FILTERS: FilterOption[] = [
  { value: 'all', label: '全部' },
  { value: 'image', label: '图片' },
  { value: 'video', label: '视频' },
  { value: 'audio', label: '音频' },
  { value: 'file', label: '文件' },
  { value: 'subject', label: '主体', disabled: true },
  { value: 'text', label: '文本', disabled: true },
  { value: 'style', label: '风格', disabled: true },
  { value: 'template', label: '模板', disabled: true },
]

export function AssetsApp() {
  const { user, isLoading, error } = useRequireAuth()
  const [filter, setFilter] = useState<FilterKind>('all')
  const [items, setItems] = useState<AssetDto[]>([])
  const [uploading, setUploading] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const kind = filter === 'all' ? undefined : filter

  useEffect(() => {
    if (!user) return
    setListError(null)
    assetsApi
      .list({ kind })
      .then((res) => setItems(res.items))
      .catch((err) => setListError(err instanceof Error ? err.message : '加载资产失败'))
  }, [user, kind])

  if (isLoading) {
    return <StateScreen title="正在确认登录状态" description="Super 正在连接资产中心。" />
  }

  if (error || !user) {
    return <StateScreen title="需要登录" description="正在跳转到统一登录中心。" />
  }

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setUploading(true)
    setListError(null)
    try {
      const created = await assetsApi.upload(file)
      if (kind && created.kind !== kind) {
        // uploaded kind doesn't match current filter; refetch to be safe
        const res = await assetsApi.list({ kind })
        setItems(res.items)
      } else {
        setItems((prev) => [created, ...prev])
      }
    } catch (err) {
      setListError(err instanceof Error ? err.message : '上传失败')
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  async function handleDelete(id: string) {
    try {
      await assetsApi.remove(id)
      setItems((prev) => prev.filter((item) => item.id !== id))
    } catch (err) {
      setListError(err instanceof Error ? err.message : '删除失败')
    }
  }

  async function handleLogout() {
    await logout()
    window.location.assign(clientEnv.SUPER_PUBLIC_AUTH_APP_URL)
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="assets-header">
        <div>
          <p className="eyebrow">SUPER ASSETS</p>
          <h1>资产中心</h1>
          <p>管理图片、视频、音频和文件素材。主体、文本、风格、模板即将上线。</p>
        </div>
        <button type="button" onClick={handleLogout}>
          退出登录
        </button>
      </header>

      <section className="filter-bar" role="tablist" aria-label="资产类型">
        {FILTERS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={filter === option.value}
            disabled={option.disabled}
            className={filter === option.value ? 'active' : ''}
            onClick={() => !option.disabled && setFilter(option.value)}
          >
            {option.label}
            {option.disabled ? ' · 即将上线' : ''}
          </button>
        ))}
      </section>

      <section className="upload-row">
        <input ref={fileInput} type="file" onChange={handleUpload} disabled={uploading} />
        <span>{uploading ? '上传中...' : '选择文件上传到资产中心'}</span>
      </section>

      {listError ? <p className="list-error">{listError}</p> : null}

      {items.length === 0 ? (
        <section className="empty-state">
          <h2>还没有资产</h2>
          <p>上传第一个素材吧。</p>
        </section>
      ) : (
        <section className="asset-grid" aria-label="资产列表">
          {items.map((asset) => (
            <article className="asset-card" key={asset.id}>
              <div className="asset-thumb">
                {asset.kind === 'image' ? (
                  <img src={asset.files[0]?.url} alt={asset.title} />
                ) : (
                  <span className="asset-kind-badge">{asset.kind}</span>
                )}
              </div>
              <div className="asset-meta">
                <h3>{asset.title}</h3>
                <p>{asset.kind}</p>
              </div>
              <button type="button" onClick={() => handleDelete(asset.id)}>
                删除
              </button>
            </article>
          ))}
        </section>
      )}
    </main>
  )
}

function StateScreen({ title, description }: { title: string; description: string }) {
  return (
    <main className="state-screen">
      <div>
        <p className="eyebrow">SUPER ASSETS</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Verify the app typechecks and builds**

Run: `pnpm --filter @super-app/assets typecheck && pnpm --filter @super-app/assets build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/assets/src/screens/AssetsApp.tsx
git commit -m "feat(assets): implement AssetsApp upload/list/delete UI"
```

---

## Task 13: Write the assets E2E test

**Files:**

- Create: `tests/e2e/fixtures/sample.png`
- Create: `tests/e2e/assets.spec.ts`
- Modify: `playwright.config.ts`

- [ ] **Step 1: Create the PNG fixture**

Generate a minimal valid PNG at `tests/e2e/fixtures/sample.png`. Use Node to write the same 1x1 PNG bytes from the API test:

Run this command (writes the fixture file):

```bash
node -e "const fs=require('fs');fs.writeFileSync('tests/e2e/fixtures/sample.png',Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0x00,0x00,0x00,0x0d,0x49,0x48,0x44,0x52,0x00,0x00,0x00,0x01,0x00,0x00,0x00,0x01,0x08,0x06,0x00,0x00,0x00,0x1f,0x15,0xc4,0x89,0x00,0x00,0x00,0x0d,0x49,0x44,0x41,0x54,0x78,0x9c,0x62,0x00,0x01,0x00,0x00,0x05,0x00,0x01,0x0d,0x0a,0x2d,0xb4,0x00,0x00,0x00,0x00,0x49,0x45,0x4e,0x44,0xae,0x42,0x60,0x82]))"
```

Verify it's a valid PNG: `file tests/e2e/fixtures/sample.png` should report a PNG image.

- [ ] **Step 2: Add the assets webServer to `playwright.config.ts`**

In `playwright.config.ts`, add a new entry to the `webServer` array (after the workspace entry):

```ts
    {
      command: `${loadLocalEnv} pnpm --filter @super-app/assets dev`,
      env: localEnv,
      url: 'http://localhost:5105/assets/',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
```

- [ ] **Step 3: Create `tests/e2e/assets.spec.ts`**

```ts
import { expect, test } from '@playwright/test'
import path from 'node:path'

const authUrl = 'http://localhost:5100/auth/'
const assetsUrl = 'http://localhost:5105/assets/'
const samplePng = path.resolve(__dirname, 'fixtures/sample.png')

test('uploads an asset from the assets app after registering', async ({ page }) => {
  const email = `e2e-assets-${Date.now()}-${test.info().parallelIndex}@super.test`
  const password = 'super-e2e-password'
  const name = 'E2E Assets User'

  await page.goto(assetsUrl)
  await expect(page).toHaveURL(new RegExp(`^${authUrl}login\\?return_to=`))

  await page.getByRole('tab', { name: '注册' }).click()
  await page.getByLabel('名称').fill(name)
  await page.getByLabel('邮箱').fill(email)
  await page.getByLabel('密码').fill(password)
  await page.getByRole('button', { name: '创建并进入' }).click()

  await expect(page).toHaveURL(assetsUrl)
  await expect(page.getByRole('heading', { name: '资产中心' })).toBeVisible()

  // empty state
  await expect(page.getByRole('heading', { name: '还没有资产' })).toBeVisible()

  // upload
  await page.getByRole('button', { name: '删除' }).count() // ensure grid not present yet
  await page.setInputFiles('input[type=file]', samplePng)

  // card appears under 全部 and 图片
  await expect(page.getByText('sample.png').first()).toBeVisible()
  await page.getByRole('button', { name: '图片', exact: true }).click()
  await expect(page.getByText('sample.png').first()).toBeVisible()

  // delete
  const deleteButton = page.getByRole('button', { name: '删除' }).first()
  await deleteButton.click()
  await expect(page.getByText('sample.png')).toHaveCount(0)

  // persists after reload
  await page.reload()
  await expect(page.getByText('sample.png')).toHaveCount(0)
})
```

- [ ] **Step 4: Run the E2E test**

Run: `pnpm test:e2e`
Expected: the assets spec passes (alongside the existing auth spec). The webServers bring up postgres+api, auth, workspace, and assets apps.

If the upload step times out, debug by: confirming the API and assets app are running (`curl http://localhost:5200/api/health`, `curl http://localhost:5105/assets/`), and checking the Playwright trace. Common issue: the upload `input[type=file]` selector — confirm there's exactly one file input; if the assets app renders multiple, scope with `.upload-row input[type=file]`.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/assets.spec.ts tests/e2e/fixtures/sample.png playwright.config.ts
git commit -m "test(e2e): add assets upload/list/delete browser flow"
```

---

## Task 14: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Full typecheck**

Run: `pnpm typecheck`
Expected: all packages green.

- [ ] **Step 2: Full unit/integration tests**

Run: `pnpm test`
Expected: auth + assets tests pass.

- [ ] **Step 3: Full E2E**

Run: `pnpm test:e2e`
Expected: auth + assets specs pass.

- [ ] **Step 4: Lint and format check**

Run: `pnpm lint && pnpm format`
Expected: clean. Run `pnpm lint:fix && pnpm format:fix` if there are issues, then commit.

- [ ] **Step 5: Verify acceptance criteria from spec §8**

Walk through the 11 acceptance criteria in `docs/superpowers/specs/2026-06-19-assets-phase0-design.md` and confirm each is met by the running system. Specifically test these against a running API (`pnpm --filter @super-app/api dev`):

1. Upload a valid image via `curl -F file=@tests/e2e/fixtures/sample.png http://localhost:5200/api/assets/upload -H 'Cookie: <session>'` returns an AssetDto.
2. The file exists under `./storage/<ownerId>/<assetId>/original/sample.png`.
3. `GET /api/assets/?kind=image` filters correctly.
4. Unauthenticated upload returns 401 in the unified error shape.

- [ ] **Step 6: Final commit (if lint/format changed anything)**

```bash
git add -A
git commit -m "chore: format and lint assets phase 0"
```

---

## Notes for the implementer

1. **Elysia auth mechanism (Tasks 6, 8) — VERIFIED:** `.macro()` + `{ auth: 'requireUser' }` does **not** fire in Elysia 1.4.29 (tested empirically: unauthenticated requests returned 200). The plan therefore uses `.guard({ beforeHandle: requireUser }, (g) => g.group(...))`, which **does** correctly return 401 + the unified error shape. Do not "improve" this to a macro. The guard wraps the group at the top level so all routes inside are protected.

2. **Multipart file size (Task 9):** Bun's `t.File()` / multipart parsing may report `file.size` as the Blob size or 0 depending on how the request was constructed. The robust approach: validate using `await file.arrayBuffer()` byte length, and use that length for both the size-limit check and the `asset_files.size` column.

3. **Migration safety (Task 3):** The dev DB is assumed empty. If `pnpm db:migrate` fails on the enum change, inspect the generated SQL — Drizzle may need the enum recreated via `DROP TYPE ... CASCADE` + `CREATE TYPE`. The generated `0001_assets_redesign.sql` is the source of truth; do not hand-edit it beyond renaming.

4. **After the plan:** Phase 0 is complete. Subsequent phases (text → subject → style → template + relations + collections) each get their own spec/plan. The foundation (8-kind enum, asset_files, storage abstraction, auth plugin) is designed to make those additions additive only.
