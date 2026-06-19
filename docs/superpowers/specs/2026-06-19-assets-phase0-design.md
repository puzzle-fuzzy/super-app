# Assets Module — Phase 0 Design

- **Date:** 2026-06-19
- **Scope:** Phase 0 of the Super asset platform — foundation + upload-class assets (image, video, audio, file)
- **Status:** Draft (pending review)

## Goal

Build the foundation of Super's unified asset platform and ship the upload-class asset types (image, video, audio, file) end to end: API, frontend app, and browser E2E.

This phase establishes the **统一资产主表 + 文件表 + 存储抽象 + 共享鉴权** foundation that all later phases (text, subject, style, template, relations, collections) build on. It deliberately ships only the asset types that share a single "multipart upload → persist → index" pipeline, so the foundation is proven by a working product before the heavier creation-type assets are layered on.

## Non-Goals (deferred to later phases)

The following are part of the long-term asset-platform vision but are **explicitly out of scope** for Phase 0:

- Type extension tables (`subject_assets`, `image_assets`, `video_assets`, `audio_assets`, `text_assets`, `file_assets`, `style_assets`, `template_assets`)
- `text` / `subject` / `style` / `template` asset types (creation-type assets)
- `asset_relations` relationship table and relation management API
- `asset_collections` / `asset_collection_items`
- `workspace_id` column and a workspaces concept (assets are owned by `owner_id` only in Phase 0)
- Aliyun OSS storage provider (Phase 0 uses local-disk; the `Storage` interface makes the swap a later, isolated change)
- Auto thumbnail/preview generation for images (Phase 0 stores only the `original` file; the `role` field on `asset_files` is in place for future generated files)
- Sharing / `public` visibility behavior (the `visibility` column exists with default `private`; sharing flows are deferred)
- Asset checksum/dedup (the `checksum` column exists but is left null in Phase 0)
- Full-text / faceted search (basic kind filter + cursor pagination only)

## Decisions (locked)

| #   | Decision                                                                                                                                                                          |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Storage = API direct multipart upload in Phase 0, with a `Storage` abstraction so Aliyun OSS swaps in later as a single implementation change.                                    |
| 2   | E2E = build the `apps/assets` frontend app + Playwright browser E2E.                                                                                                              |
| 3   | Operation set = upload / list / detail / delete (no update, no tags, no relations in Phase 0).                                                                                    |
| 4   | Auth = new shared `auth` plugin extracting session resolution from the auth module; all modules reuse it.                                                                         |
| 5   | `AssetKind` enum replaced with 8 creation-oriented kinds (`subject, image, video, audio, text, file, style, template`).                                                           |
| 6   | Migration = a new migration `0001_assets_redesign.sql` that rebuilds the assets tables against the new structure (dev DB has effectively no data).                                |
| 7   | `workspace_id` is **not** added in Phase 0.                                                                                                                                       |
| 8   | Type extension / relation / collection tables are **not** built in Phase 0; type-specific fields live in the main table's `metadata` jsonb until a dedicated phase extracts them. |

## 1. Data Layer

### 1.1 `AssetKind` redefinition — `packages/contracts/src/assets.ts`

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
```

This replaces the old `['image','video','audio','text','document','model','canvas','other']` enum. `canvas` is removed as a kind (canvas projects are a separate domain); `document`/`model`/`other` collapse into `file`; new creation kinds `subject`/`style`/`template` are added for future phases (Phase 0 only writes `image`/`video`/`audio`/`file`, but the enum is complete from day one so the schema never needs a breaking change).

### 1.2 `AssetSource` redefinition — `packages/contracts/src/assets.ts`

```ts
export const AssetSourceSchema = z.enum([
  'upload',
  'ai_generation',
  'canvas_export',
  'transfer',
  'manual',
  'import',
])

export type AssetSource = z.infer<typeof AssetSourceSchema>
```

### 1.3 Asset status enums — `packages/contracts/src/assets.ts`

```ts
export const AssetStatusSchema = z.enum(['active', 'archived', 'deleted'])
export type AssetStatus = z.infer<typeof AssetStatusSchema>

export const AssetVisibilitySchema = z.enum(['private', 'shared', 'public'])
export type AssetVisibility = z.infer<typeof AssetVisibilitySchema>
```

### 1.4 `AssetFileRole` — `packages/contracts/src/assets.ts`

```ts
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
```

### 1.5 DTO schemas — `packages/contracts/src/assets.ts`

```ts
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
```

The existing `CreateAssetRequestSchema` is **kept unchanged** in the file (it remains the contract for a future OSS pre-upload-register flow) but is **not used** by Phase 0 endpoints. A code comment notes it is reserved for the OSS flow.

### 1.6 DB schema — `packages/db/src/schema/assets.ts` (rewritten)

```ts
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
    coverAssetId: uuid('cover_asset_id').references(() => assets.id, { onDelete: 'set null' }),
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
```

`assetFileRoleEnum` = `assetsSchema.enum('asset_file_role', ['original','thumbnail','preview','cover','subtitle','waveform','attachment'])`.

The existing `asset_tags` table is **kept as-is** (its FK target `assets.id` survives the rebuild). `assetsRelations` is updated to reflect the new columns (drop the flat `mime_type/size/storage_bucket/storage_key/width/height/duration` columns and `storageUnique` index from `assets`; they now live on `asset_files`). A new `assetFilesRelations` is added (many-to-one back to `assets`).

> **Self-reference note:** `coverAssetId` references `assets.id` (the table being defined). Drizzle supports this via the function-form `references(() => assets.id)` within the same table definition, matching the pattern already used in `canvas.ts` (`coverAssetId` → `assets.id`).

### 1.7 Migration — `packages/db/drizzle/0001_assets_redesign.sql`

Generated by `pnpm db:generate`. Because the dev DB has effectively no real data and the initial migration (`0000_thin_satana.sql`) created the old structure, this migration:

1. Drops the old columns from `assets.assets` that moved to `asset_files` (`mime_type`, `size`, `storage_bucket`, `storage_key`, `thumbnail_key`, `preview_key`, `width`, `height`, `duration`).
2. Recreates the `asset_kind` enum with the 8 new values.
3. Adds the new enums (`asset_status`, `asset_visibility`, `asset_source`, `asset_file_role`).
4. Adds the new columns to `assets.assets` (`status`, `visibility`, `source`, `cover_asset_id`).
5. Creates `assets.asset_files`.
6. Recreates indexes to match the new schema.

Drizzle Kit generates the SQL; it is reviewed before applying. `pnpm db:migrate` applies it locally. `auth.test.ts` and the new `assets.test.ts` run against the migrated DB.

## 2. Shared Auth Plugin

### 2.1 Extract session helpers — `services/api/src/shared/session.ts`

Move `getSessionTokenFromCookie` and `getCurrentUser` from `modules/auth/service.ts` into `services/api/src/shared/session.ts` (pure functions taking `db` and headers/token). The auth module's `service.ts` imports them from there. Behavior is unchanged; this is a pure move so the auth plugin can reuse them.

`createSessionCookie` / `createExpiredSessionCookie` / `createSessionForUser` / `registerUser` / `loginUser` / `logoutUser` stay in `modules/auth/service.ts` (they are auth-flow-specific).

### 2.2 Auth plugin — `services/api/src/plugins/auth.ts`

```ts
import { Elysia } from 'elysia'
import { dbPlugin } from './db'
import { fail } from '../shared/response'
import { getCurrentUser, getSessionTokenFromCookie } from '../shared/session'

export const authPlugin = new Elysia({ name: 'auth' })
  .use(dbPlugin)
  .derive({ as: 'scoped' }, async ({ db, headers }) => {
    const token = getSessionTokenFromCookie(headers.cookie)
    const user = await getCurrentUser(db, token)
    return { user }
  })
  .macro({
    auth: {
      requireUser() {
        return {
          resolve({ user, set }) {
            if (!user) {
              set.status = 401
              return fail('UNAUTHORIZED', 'Unauthorized')
            }
          },
        }
      },
    },
  })
```

Routes opt into the guard via `{ auth: 'requireUser' }` on a `.group` or route. The `user` value (type `CurrentUser | null`) is available in every handler under the plugin scope.

### 2.3 Wire-up

- `modules/auth/index.ts`: the `GET /auth/me` route already manually checks `user`; it is refactored to use the plugin's `user` derive for consistency (optional, behavior-identical). Register/login/logout remain public.
- `modules/assets/index.ts`: uses `authPlugin` and `{ auth: 'requireUser' }` on all four routes.
- `app.ts`: `assetsModule` added to the `/api` group alongside `systemModule` and `authModule`.

## 3. Storage Abstraction

### 3.1 `packages/storage` (new package)

```
packages/storage/
  package.json   (@super-app/storage)
  tsconfig.json
  src/
    index.ts        (exports)
    types.ts        (StorageProvider interface)
    local.ts        (LocalStorageProvider)
    client.ts       (createStorage factory)
```

```ts
// types.ts
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

```ts
// local.ts — LocalStorageProvider
// writes to `${storageDir}/${key}`, returns url = `${publicBaseUrl}/${key}`
// bucket = 'local'
// size = body.byteLength
```

```ts
// client.ts
export function createStorage(): StorageProvider {
  // reads STORAGE_DIR + SUPER_PUBLIC_STORAGE_BASE_URL from serverEnv
  return new LocalStorageProvider({ storageDir, publicBaseUrl })
}
```

The package depends on `@super-app/env` for `serverEnv`.

### 3.2 Env additions — `packages/env`

- `server.ts`: add `STORAGE_DIR: z.string().min(1).default('./storage')`.
- `public.ts`: add `SUPER_PUBLIC_STORAGE_BASE_URL: z.string().url()`.
- `.env.example` + `.env`: set `STORAGE_DIR=./storage`, `SUPER_PUBLIC_STORAGE_BASE_URL=http://localhost:5200/storage`.
- `playwright.config.ts` `localEnv`: same two values.

### 3.3 Storage plugin — `services/api/src/plugins/storage.ts`

```ts
export const storagePlugin = new Elysia({ name: 'storage' }).decorate('storage', createStorage())
```

`authPlugin` (which assets use) sits on top of `dbPlugin`; `storagePlugin` is composed into the assets module group so handlers receive `storage: StorageProvider`.

### 3.4 Static serve route — `services/api/src/app.ts`

A dev-only static route serves files from `STORAGE_DIR` under `/storage/*` so the frontend can render uploaded images/video by URL. Implemented via Elysia `onRequest`/streaming read of the file path (or the `@elysia/static` plugin if available; otherwise a small manual handler that streams the file with the correct content-type from the extension). It is acceptable for this route to be dev-only; when OSS lands, `LocalStorageProvider.url` is replaced and this route is removed.

### 3.5 Key layout

```
<ownerId>/<assetId>/<role>/<filename>
```

`role` ∈ `original` (Phase 0), `thumbnail`, `preview` (future). `filename` preserves the user's original filename (sanitized). This layout keeps one asset's files grouped and avoids collisions.

## 4. Assets API

All routes under `/api/assets`, all guarded by `{ auth: 'requireUser' }`.

### 4.1 Endpoints

| Method | Path                 | Body / Query            | Response            |
| ------ | -------------------- | ----------------------- | ------------------- |
| POST   | `/api/assets/upload` | multipart `file: File`  | `AssetDto`          |
| GET    | `/api/assets`        | `?kind=&limit=&cursor=` | `AssetListResponse` |
| GET    | `/api/assets/:id`    | —                       | `AssetDto`          |
| DELETE | `/api/assets/:id`    | —                       | `{ deleted: true }` |

### 4.2 Upload — `POST /api/assets/upload`

- Body schema: `{ file: t.File() }` (Elysia typebox `File`).
- Reads `ASSETS_MAX_UPLOAD_SIZE_MB` and `ASSETS_ALLOWED_MIME_TYPES` from `serverEnv`. Allowed MIME set is parsed from the comma-separated env string into a `Set<string>`.
- Validation (in order):
  1. `file.size > maxBytes` → `throw new AppError(413, 'VALIDATION_ERROR', 'File too large')`.
  2. `!allowedMimes.has(file.type)` → `throw new AppError(415, 'VALIDATION_ERROR', 'Unsupported file type')`.
- Kind inference from MIME: `image/* → image`, `video/* → video`, `audio/* → audio`, else `file`.
- Flow:
  1. Insert `assets` row (`ownerId = user.id`, `kind`, `title = file.name`, `source = 'upload'`, `status = 'active'`, `visibility = 'private'`).
  2. Compute storage key `<ownerId>/<assetId>/original/<sanitized-name>`.
  3. `storage.put({ key, body: Buffer.from(await file.arrayBuffer()), mimeType })` → `{ bucket, url, size }`.
  4. Insert `asset_files` row (`role = 'original'`, `storageBucket = bucket`, `storageKey = key`, `mimeType`, `size`, `width`/`height` left null in Phase 0 — image dimension extraction is a future enhancement).
  5. Return `AssetDto` built from the asset + its files (see `toAssetDto`).

> Image/video dimension extraction is **out of scope** for Phase 0. `width`/`height`/`duration` on `asset_files` are left null; the values can be backfilled or captured in a later phase that adds media probing. The columns exist so the schema is forward-compatible.

### 4.3 List — `GET /api/assets`

- Query: `kind?` (one of the 8 kinds), `limit?` (default 20, clamped 1–50), `cursor?` (opaque base64).
- Filters: `ownerId = user.id`, `status = 'active'`, optional `kind`. `deleted`/`archived` excluded.
- Cursor pagination: cursor encodes `(createdAt, id)` of the last item; query uses `(createdAt, id) < (cursor.createdAt, cursor.id)` ordered `createdAt DESC, id DESC`. `nextCursor` is null when fewer than `limit` rows remain.
- Response: `AssetListResponse` (`{ items, nextCursor }`), each item is `AssetDto`.

### 4.4 Detail — `GET /api/assets/:id`

- Load asset by `id` where `ownerId = user.id` and `status = 'active'`.
- Not found / not owned → `throw new AppError(404, 'NOT_FOUND', 'Asset not found')`.
- Response: `AssetDto`.

### 4.5 Delete — `DELETE /api/assets/:id`

- Load asset by `id` where `ownerId = user.id` (any status except hard rule: must exist).
- Set `status = 'deleted'`, `deletedAt = now()`. **Soft delete** — the row and its files remain.
- (Optional, Phase 0 may skip) The file bytes on disk are **not** removed on soft delete; a future cleanup/garbage-collection task handles physical deletion after hard-delete or TTL.
- Response: `{ deleted: true }`.

### 4.6 `toAssetDto` mapper — `modules/assets/service.ts`

Builds `AssetDto` from an `assets` row + its `asset_files` rows. For each file, `url` is resolved via the storage provider's URL convention (`${SUPER_PUBLIC_STORAGE_BASE_URL}/${storageKey}` for local). `thumbnailUrl` / `previewUrl` on the DTO are populated from the main table's `thumbnail_key`/`preview_key` convenience columns when present (null in Phase 0 since auto-generation is deferred).

### 4.7 Error handling

All errors go through the existing global `errorHandler`, which already maps `AppError` to the unified `fail(...)` shape: it sets the HTTP status from `error.status` and uses `error.code` as the body's `error.code`. No new error middleware. Upload validation uses new HTTP statuses `413` (oversized) and `415` (unsupported MIME), both thrown as `AppError(413|415, 'VALIDATION_ERROR', message)` — the HTTP status differs but the body error code is `VALIDATION_ERROR` in both cases, which is an existing member of `ApiErrorCodeSchema`.

## 5. Frontend — `apps/assets`

### 5.1 Scaffold (mirrors `apps/auth`, `apps/workspace`)

- Vite + React + Tailwind v4 (same `@tailwindcss/vite` setup), port `5105`, base `/assets/`.
- `package.json` (`@super-app/assets`), `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/screens/AssetsApp.tsx`, `src/styles.css`.
- Depends on `@super-app/env`, `@super-app/auth-client`, `@super-app/api-client`.
- `index.html` favicon set to the super logo CDN URL (matching the `feat: set favicon` commit's pattern).

### 5.2 `AssetsApp.tsx` behavior

- `useRequireAuth()` guard — unauthenticated users redirect to the auth app (same `return_to` pattern as workspace).
- Top filter bar: 全部 / 图片 / 视频 / 音频 / 文件 (active); 主体 / 文本 / 风格 / 模板 rendered as disabled chips labeled "即将上线" (non-clickable, no route).
- Upload: a file `<input type="file">` (and drag-drop zone) → calls `assetsApi.upload(file)` → on success prepends to the list.
- Grid of asset cards: thumbnail (image/video poster via `files[].url`; fallback icon by kind for audio/file), title, kind badge, created time, delete button.
- Delete: calls `assetsApi.remove(id)` → removes from list.
- Empty state: "还没有资产，上传第一个素材吧。"
- Logout button → `logout()` → redirect to auth app (mirrors workspace).

### 5.3 `assetsApi` — `packages/api-client/src/index.ts` (extended)

```ts
export const assetsApi = {
  upload(file: File) {
    const form = new FormData()
    form.append('file', file)
    return apiFetch<AssetDto>('/assets/upload', {
      method: 'POST',
      body: form,
      // do NOT set Content-Type; browser sets multipart boundary
      headers: {}, // apiFetch merges; explicit empty avoids JSON header
    })
  },
  list(params?: { kind?: AssetKind; limit?: number; cursor?: string }) {
    const qs = new URLSearchParams()
    if (params?.kind) qs.set('kind', params.kind)
    if (params?.limit) qs.set('limit', String(params.limit))
    if (params?.cursor) qs.set('cursor', params.cursor)
    const q = qs.toString()
    return apiFetch<AssetListResponse>(`/assets${q ? `?${q}` : ''}`)
  },
  get(id: string) {
    return apiFetch<AssetDto>(`/assets/${id}`)
  },
  remove(id: string) {
    return apiFetch<{ deleted: true }>(`/assets/${id}`, { method: 'DELETE' })
  },
}
```

`apiFetch`'s `mergeHeaders` already spreads provided headers over the default `Content-Type: application/json`. For multipart upload the caller passes an empty headers object so the browser's multipart `Content-Type` (with boundary) is used; the `mergeHeaders` merge order (caller headers override default) must be confirmed to allow this — if `mergeHeaders` always forces JSON, it is adjusted so an explicit `Content-Type: undefined`/omitted header for FormData bodies is respected. (Implementation detail resolved during coding; the contract is "FormData upload works without a JSON content-type.")

## 6. E2E — `tests/e2e/assets.spec.ts`

### 6.1 Test flow

1. Go to `http://localhost:5105/assets/` → redirected to auth app login with `return_to`.
2. Register a new user (`e2e-assets-<ts>-<idx>@super.test`).
3. Return to assets app → asset grid shows empty state.
4. Upload a small PNG (a fixture `tests/e2e/fixtures/sample.png`, ~1KB, checked in) via the file input.
5. Assert the asset card appears under "全部" and "图片" filter with the title.
6. Click delete on the card → assert it disappears from the grid.
7. Reload → assert it stays gone (soft-deleted, excluded from list).

### 6.2 Playwright config — `playwright.config.ts`

Add a third `webServer` entry for the assets app:

```ts
{
  command: `${loadLocalEnv} pnpm --filter @super-app/assets dev`,
  env: localEnv,
  url: 'http://localhost:5105/assets/',
  reuseExistingServer: !process.env.CI,
  timeout: 60_000,
},
```

`localEnv` already includes `SUPER_PUBLIC_STORAGE_BASE_URL` (added in §3.2) and `SUPER_PUBLIC_ASSETS_APP_URL`.

### 6.3 Fixture

`tests/e2e/fixtures/sample.png` — a minimal valid PNG committed to the repo so the upload has a deterministic file.

## 7. Testing Strategy

| Layer                | Test                                                                                | What it covers                                                                                                                                                                                                                                       |
| -------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API unit/integration | `services/api/src/modules/assets/assets.test.ts` (bun:test, mirrors `auth.test.ts`) | Upload → list → detail → delete happy path against the real Postgres + local storage; size-limit (413) and MIME-reject (415) error paths; ownership (another user's asset → 404); pagination cursor. Cleans up created assets + files in `afterAll`. |
| Auth regression      | existing `auth.test.ts` still passes                                                | Confirms the session-helper extraction + auth-plugin refactor didn't break auth.                                                                                                                                                                     |
| E2E                  | `tests/e2e/assets.spec.ts` (Playwright)                                             | Full browser flow: register → upload → filter → delete, with real CORS + cookies across apps.                                                                                                                                                        |

`assets.test.ts` creates assets owned by a freshly registered test user (via the auth `/register` endpoint to get a real session cookie, like `auth.test.ts` does), uploads via `app.handle` with a multipart `Request`, and asserts on the JSON responses and the on-disk file existence. Files are written under a test-specific `STORAGE_DIR` (or cleaned up) to avoid polluting dev storage.

## 8. Acceptance Criteria

1. `pnpm typecheck` is green across all packages (new `@super-app/storage`, `@super-app/assets`, updated `@super-app/db`, `@super-app/contracts`, `@super-app/api-client`, `@super-app/env`, `@super-app/api`).
2. `pnpm test` (turbo) passes — `auth.test.ts` unchanged-green, `assets.test.ts` new-green.
3. `pnpm db:migrate` applies `0001_assets_redesign.sql` cleanly on a fresh local DB.
4. `POST /api/assets/upload` with a valid image returns `AssetDto` with one `original` file; the file exists on disk under `STORAGE_DIR/<ownerId>/<assetId>/original/<name>`.
5. `GET /api/assets?kind=image` returns only image assets owned by the caller.
6. `GET /api/assets/:id` returns 404 for another user's asset.
7. `DELETE /api/assets/:id` soft-deletes; subsequent `GET /api/assets` excludes it.
8. Upload of an oversized file returns 413; unsupported MIME returns 415 — both in the unified `{ success: false, error: {...} }` shape.
9. `apps/assets` loads, redirects unauthenticated users to auth, and after login shows the upload UI + grid.
10. `pnpm test:e2e` (Playwright) passes the assets flow end to end.
11. An unauthenticated `POST /api/assets/upload` returns 401 in the unified error shape.

## 9. File Change Summary

**New:**

- `packages/storage/{package.json,tsconfig.json,src/{index,types,local,client}.ts}`
- `services/api/src/shared/session.ts`
- `services/api/src/plugins/auth.ts`
- `services/api/src/plugins/storage.ts`
- `services/api/src/modules/assets/{index,service,assets.test}.ts`
- `packages/db/drizzle/0001_assets_redesign.sql`
- `apps/assets/{package.json,tsconfig.json,vite.config.ts,index.html,src/{main.tsx,screens/AssetsApp.tsx,styles.css}}`
- `tests/e2e/assets.spec.ts`
- `tests/e2e/fixtures/sample.png`

**Modified:**

- `packages/contracts/src/assets.ts` (new kinds/sources/statuses/roles + DTOs)
- `packages/db/src/schema/assets.ts` (rewritten main table + new `asset_files`)
- `packages/db/src/index.ts` (export `assetFiles`)
- `packages/env/src/{public,server}.ts` (+ storage env)
- `.env.example`, `.env` (+ storage env)
- `packages/api-client/src/index.ts` (+ `assetsApi`)
- `services/api/src/app.ts` (+ assets module, storage static route)
- `services/api/src/modules/auth/{service,index}.ts` (session helpers extracted; me route uses plugin)
- `playwright.config.ts` (+ assets webServer)
- `pnpm-workspace.yaml` (no change — `packages/*` and `apps/*` globs already cover new entries)
- `turbo.json` (no change expected; new packages inherit build/typecheck/lint/test tasks via their own `package.json` scripts and turbo's task inference)

## 10. Phase Roadmap (context, not Phase 0 work)

- **Phase 1:** `text` assets (creation-type: title + body + text_type).
- **Phase 2:** `subject` assets (`subject_assets` extension table + reference relations → introduces `asset_relations`).
- **Phase 3:** `style` assets (`style_assets`).
- **Phase 4:** `template` + generalized `asset_relations` + `asset_collections` + search.

Each phase is its own spec → plan → implementation cycle. The Phase 0 foundation (enum, main table, file table, storage abstraction, auth plugin) is designed so that adding a type later means: a new extension table, a new create endpoint, a new frontend page — without touching the shared upload/list/detail/delete machinery.
