# Style Assets (Phase 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the `style` creation-type asset (CRUD) — a reusable generation-style configuration. Structurally identical to Phase 1 (text) and Phase 2 (subject).

**Architecture:** New `assets.style_assets` extension table (1:1 with main table), new `styles` API module mirroring `modules/subjects/`, `apps/assets` enables the 「风格」 filter with a style branch in the unified editor.

**Tech Stack:** TypeScript, Elysia 1.4.29, Drizzle ORM + Postgres, Bun, Zod, React 19 + Vite 7, Playwright.

**Spec:** `docs/superpowers/specs/2026-06-20-style-assets-phase3-design.md`

**Verified patterns (do NOT re-litigate — from Phase 1/2):**
- Guard wiring: `.guard({ beforeHandle: requireUser }, (g) => g.group('/path', ...))`.
- Extension table: NO reverse relation on `assetsRelations` (TDZ deadlock). Extension-side relation only.
- Drizzle enum==column-name bug: review generated SQL, qualify `"assets"."style_type"` if unqualified.
- Contracts package needs explicit `exports` map entry for the new subpath.
- `toAssetDto(asset, [])` reuse for the extension-less main-row DTO.

**Conventions:** `bun test` reads `.env` via `--env-file=../../.env`. Unified responses via `ok`/`fail`. Commit after each task. Conventional Commits.

---

## Task 1: style-assets contracts

**Files:** Create `packages/contracts/src/style-assets.ts`; Modify `packages/contracts/src/index.ts`, `packages/contracts/package.json`.

- [ ] Create `packages/contracts/src/style-assets.ts`:

```ts
import { z } from 'zod'

import { AssetDtoSchema } from './assets'

export const StyleTypeSchema = z.enum(['visual', 'video', 'writing', 'audio', 'ui', 'mixed'])

export type StyleType = z.infer<typeof StyleTypeSchema>

export const StyleAssetDetailDtoSchema = AssetDtoSchema.extend({
  styleType: StyleTypeSchema,
  positivePrompt: z.string().optional(),
  negativePrompt: z.string().optional(),
  colorPalette: z.record(z.unknown()),
  recommendedModel: z.string().optional(),
  recommendedParams: z.record(z.unknown()),
})

export type StyleAssetDetailDto = z.infer<typeof StyleAssetDetailDtoSchema>

export const CreateStyleAssetRequestSchema = z.object({
  title: z.string().min(1),
  styleType: StyleTypeSchema,
  positivePrompt: z.string().optional(),
  negativePrompt: z.string().optional(),
  colorPalette: z.record(z.unknown()).optional(),
  recommendedModel: z.string().optional(),
  recommendedParams: z.record(z.unknown()).optional(),
  description: z.string().optional(),
})

export type CreateStyleAssetRequest = z.infer<typeof CreateStyleAssetRequestSchema>

export const UpdateStyleAssetRequestSchema = z.object({
  title: z.string().min(1).optional(),
  styleType: StyleTypeSchema.optional(),
  positivePrompt: z.string().optional(),
  negativePrompt: z.string().optional(),
  colorPalette: z.record(z.unknown()).optional(),
  recommendedModel: z.string().optional(),
  recommendedParams: z.record(z.unknown()).optional(),
  description: z.string().optional(),
})

export type UpdateStyleAssetRequest = z.infer<typeof UpdateStyleAssetRequestSchema>
```

- [ ] Add `export * from './style-assets'` to `packages/contracts/src/index.ts`.
- [ ] Add `"./style-assets": "./src/style-assets.ts"` to `packages/contracts/package.json` `exports`.
- [ ] `pnpm --filter @super-app/contracts typecheck` → PASS. Commit `feat(contracts): add style asset type, detail DTO, and request schemas`.

---

## Task 2: style_assets DB schema + migration

**Files:** Create `packages/db/src/schema/style-assets.ts`; Modify `packages/db/src/schema/index.ts`; generate `packages/db/drizzle/0009_*.sql`.

- [ ] Create `packages/db/src/schema/style-assets.ts`:

```ts
import { relations, sql } from 'drizzle-orm'
import { jsonb, text, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core'

import { createdAtColumn, idColumn, updatedAtColumn } from './common'
import { assetsSchema, assets } from './assets'

export const styleTypeEnum = assetsSchema.enum('style_type', [
  'visual',
  'video',
  'writing',
  'audio',
  'ui',
  'mixed',
])

export const styleAssets = assetsSchema.table(
  'style_assets',
  {
    id: idColumn(),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    styleType: styleTypeEnum('style_type').notNull(),
    positivePrompt: text('positive_prompt'),
    negativePrompt: text('negative_prompt'),
    colorPalette: jsonb('color_palette')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    recommendedModel: varchar('recommended_model', { length: 120 }),
    recommendedParams: jsonb('recommended_params')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => ({
    assetIdUnique: uniqueIndex('style_assets_asset_id_unique').on(table.assetId),
  })
)

export const styleAssetsRelations = relations(styleAssets, ({ one }) => ({
  asset: one(assets, {
    fields: [styleAssets.assetId],
    references: [assets.id],
  }),
}))

export type StyleAssetRow = typeof styleAssets.$inferSelect
export type NewStyleAssetRow = typeof styleAssets.$inferInsert
```

- [ ] Add `export * from './style-assets'` to `packages/db/src/schema/index.ts`.
- [ ] `pnpm --filter @super-app/db typecheck` → PASS.
- [ ] `pnpm db:generate`. Review the new `0009_*.sql` — if `"style_type" style_type` is unqualified, fix to `"assets"."style_type"`.
- [ ] `pnpm db:migrate` → success. Verify `assets.style_assets` exists.
- [ ] Commit `feat(db): add style_assets extension table and migration`.

---

## Task 3: styles service + routes

**Files:** Create `services/api/src/modules/styles/service.ts`, `services/api/src/modules/styles/index.ts`; Modify `services/api/src/app.ts`.

- [ ] Create `services/api/src/modules/styles/service.ts` — mirror `modules/subjects/service.ts` but for style fields. Functions: `createStyleAsset`, `getStyleAsset`, `updateStyleAsset`, `deleteStyleAsset`, `toStyleAssetDetailDto`, plus `loadStyleAsset` helper. The extension insert uses `{ assetId, styleType, positivePrompt, negativePrompt, colorPalette, recommendedModel, recommendedParams }`. Compensating delete on failure (same as subjects/texts). `toStyleAssetDetailDto(asset, extension)` spreads `toAssetDto(asset, [])` + `{ styleType, positivePrompt: ext.positivePrompt ?? undefined, negativePrompt: ext.negativePrompt ?? undefined, colorPalette: ext.colorPalette, recommendedModel: ext.recommendedModel ?? undefined, recommendedParams: ext.recommendedParams }`.

- [ ] Create `services/api/src/modules/styles/index.ts` — mirror `modules/subjects/index.ts` but group is `/assets/styles`, bodies are `CreateStyleAssetRequestSchema`/`UpdateStyleAssetRequestSchema`, calls `createStyleAsset`/`getStyleAsset`/`updateStyleAsset`/`deleteStyleAsset`. Same `.guard({ beforeHandle: requireUser }, ...)` form.

- [ ] Register in `services/api/src/app.ts`: add `import { stylesModule } from './modules/styles'` and append `.use(stylesModule)` to the `/api` group.
- [ ] `pnpm --filter @super-app/api typecheck` → PASS. Commit `feat(api): add styles service and routes`.

---

## Task 4: styles integration tests

**Files:** Create `services/api/src/modules/styles/styles.test.ts`.

- [ ] Mirror `modules/subjects/subjects.test.ts`. Flow: create `{ title: '胶片街拍', styleType: 'visual', positivePrompt: '35mm film grain, street...' }` → assert `kind:'style'`, `styleType:'visual'`. Read, list(`?kind=style`), patch (update `negativePrompt` only, verify `styleType` unchanged), delete → 404. Also: default colorPalette/recommendedParams are `{}`. Cross-owner 404, 401, invalid style_type 400, empty title 400. Cleanup deletes `styleAssets` + `assets` + `sessions` + `users` in `afterAll`.
- [ ] `pnpm --filter @super-app/api test` → all pass. Commit `test(api): add styles module integration tests`.

---

## Task 5: stylesApi in api-client

**Files:** Modify `packages/api-client/src/index.ts`.

- [ ] Add imports `CreateStyleAssetRequest`, `StyleAssetDetailDto`, `UpdateStyleAssetRequest` from `@super-app/contracts/style-assets`.
- [ ] Add `stylesApi` object (create/get/update/remove) after `subjectsApi`, identical shape with `/assets/styles/` paths.
- [ ] `pnpm --filter @super-app/api-client typecheck` → PASS. Commit `feat(api-client): add stylesApi`.

---

## Task 6: frontend — enable style filter + editor branch

**Files:** Modify `apps/assets/src/screens/AssetsApp.tsx`.

- [ ] Enable the `style` filter: change `{ value: 'style', label: '风格', helper: '即将上线', disabled: true }` to `{ value: 'style', label: '风格' }`.
- [ ] Add imports for `CreateStyleAssetRequest`, `StyleAssetDetailDto`, `StyleType`, `UpdateStyleAssetRequest` from `@super-app/contracts/style-assets`, and `stylesApi` from `@super-app/api-client`.
- [ ] Add `STYLE_TYPE_OPTIONS` constant: visual→视觉, video→视频, writing→写作, audio→音频, ui→界面, mixed→混合.
- [ ] Add `StyleEditorState` to the `EditorState` union: `{ kind: 'style'; id?: string; title; styleType: StyleType; positivePrompt; negativePrompt; recommendedModel; colorPalette: string (JSON text); recommendedParams: string (JSON text) }`. JSON fields are edited as text (parsed on save; empty → `{}`).
- [ ] Extend `openEditSubject`-style `openEditStyle(asset)` + handle the `style` branch in `saveEditor` (parse JSON fields with try/catch → error if invalid JSON).
- [ ] The create button: when `filter === 'style'`, button label 「新建风格」, opens a fresh style editor.
- [ ] Style cards show edit button (like text/subject). Editor modal `style` branch: title, styleType select, positivePrompt/negativePrompt textareas, recommendedModel input, colorPalette/recommendedParams JSON textareas. Reuse existing editor CSS.
- [ ] `pnpm --filter @super-app/assets typecheck && pnpm --filter @super-app/assets build` → PASS. Commit `feat(assets): enable style filter and add style editor`.

---

## Task 7: styles E2E + final verification

**Files:** Create `tests/e2e/styles.spec.ts`.

- [ ] Mirror `tests/e2e/subjects.spec.ts`: register → 「风格」 tab → 「新建风格」 → fill 标题 + 正向提示词(`getByLabel('正向提示词')`) → save → assert card → edit 负面提示词 → save → delete → gone.
- [ ] `pnpm test:e2e` → all 5 specs pass (auth, assets, texts, subjects, styles).
- [ ] Final: `pnpm typecheck && pnpm test && pnpm lint` → green. `npx prettier --write` on changed files only.
- [ ] Commit `test(e2e): add styles create/edit/delete browser flow` (+ final format commit if needed).

---

## Notes for the implementer

1. **drizzle enum==column-name bug** may hit `style_type`. Review generated SQL. Phase 2's `subject_type` was generated correctly, so verify rather than assume.
2. **No reverse relation on `assetsRelations`** (Phase 1 TDZ lesson).
3. The `requireUser` guard `any` typing is intentional/verified.
4. Phase 3 is structurally identical to Phase 2 — when in doubt, mirror `modules/subjects/`.
5. JSON fields (`colorPalette`, `recommendedParams`) are edited as text in the frontend; parse on save, default to `{}` when empty, surface parse errors to the user.
