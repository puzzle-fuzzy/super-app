# DeepSeek Follow-up Execution Plan

> Date: 2026-06-21  
> Repository: `/Users/yxswy/Documents/super-app`  
> Coding rules: `/Users/yxswy/Documents/super-app/docs/03-development/coding-preferences.md`  
> Purpose: fix the remaining misunderstood or only partially completed TODO items after the recent DeepSeek implementation pass.

## Current Situation

Recent commits claim that the asset origin, AI generation info dialog, Canvas node details, Pipeline artifact details, and TODO items are complete. A quick audit shows that several items are marked complete while their own notes still say "remaining", "follow-up", "needs backend support", or "needs product scheduling". Treat those as unfinished.

The highest-risk gap is not the visual dialog itself. The risky part is whether a Canvas node still knows its `assetId`, `assetOrigin`, `generationRecordId`, prompt, model, provider, and task ID after refresh, SSE updates, and drag/drop flows. If the UI button exists but the data chain is not durable, the core requirement is not complete.

## Non-negotiable Rules

1. Do not mark a TODO item complete if any sub-bullet says "remaining", "follow-up", "needs support", or "scheduled later".
2. Do not rely on `asset.metadata?.provider === 'dashscope'` to identify AI-generated assets. Use typed `asset.origin.kind`.
3. Do not store only URLs for references when an asset exists. Preserve `assetId` and an origin snapshot.
4. Do not direct-cast drag/drop JSON with `as AssetDto`; parse it through a schema.
5. Do not finish without running:

```bash
pnpm lint
pnpm typecheck
pnpm test
```

## Phase 0 - Repair the Quality Gate

### Task 0.1 Fix Current Lint Failure

Observed failure:

- `packages/contracts/tests/assets.test.ts`
- `UploadedOriginSchema` is imported but unused.
- `AiGeneratedOriginSchema` is imported but unused.

Actions:

1. Open `packages/contracts/tests/assets.test.ts`.
2. Either remove the unused imports or add direct tests for those schemas.
3. Prefer adding tests if these schemas are part of the public contract.
4. Run `pnpm lint`.

Acceptance:

- `pnpm lint` passes.

### Task 0.2 Re-run the Full Verification Chain

Actions:

```bash
pnpm lint
pnpm typecheck
pnpm test
```

Acceptance:

- All three commands pass.
- Paste or record the final successful command outputs in the implementation summary.

## Phase 1 - Correct TODO.md State

### Task 1.1 Stop Marking Partial Work as Complete

Current `TODO.md` has crossed-out completed headings that still contain unfinished notes. Restore unfinished items to an open state.

Reopen these items if the listed remaining work is not actually implemented:

- #2 Canvas Pipeline asset origin construction.
- #3 SSE backfill of `assetId` and `origin`.
- #4 AssetCard "view details" action.
- #6 external asset drag/drop into Pipeline nodes saving `assetId` and `originSnapshot`.
- #7 `PipelineAssetSidebar` and `PipelineAssetDropHandler` split, if still inside a large page-level component.
- #10 JSON.parse schema parsing and `user!` concentration.
- #14 frontend component test infrastructure.
- #15 unified asset detail view across AssetInfoDialog, PipelineArtifactInfoDialog, and AssetCard.
- #16 asset reference usage index.
- #17 reuse generation parameters for regeneration.

Acceptance:

- TODO headings are only crossed out when fully done.
- Partial items use "已完成" and "剩余" sections without strikethrough.
- Deferred product items are marked "待排期", not "done".

## Phase 2 - Finish Asset Origin Data Chain

### Task 2.1 Audit AssetOrigin Coverage

Files to inspect:

- `packages/contracts/src/assets.ts`
- `services/api/src/modules/assets/service.ts`
- `services/api/src/modules/canvas/generate-image.ts`
- `packages/db/src/schema/assets.ts`
- `packages/db/src/schema/generation-records.ts`
- `packages/db/src/schema/canvas-pipeline-assets.ts`

Actions:

1. Verify `AssetOrigin` is a discriminated union with explicit variants.
2. Verify `AssetDtoSchema.origin` exists and is required or intentionally backward-compatible.
3. Verify `toAssetDto()` builds typed origins for all asset sources:
   - uploaded
   - ai_generated
   - canvas_pipeline
   - canvas_export
   - transfer
   - manual
   - imported
4. Verify origin fields are populated from real records where possible, not placeholder metadata.

Acceptance:

- `AssetDto.origin.kind` is available for every returned asset.
- No UI feature needs to guess origin from raw metadata.

### Task 2.2 Complete AI Generation Record Linking

Files to inspect:

- `services/api/src/modules/canvas/index.ts`
- `services/api/src/modules/canvas/generate-image.ts`
- `services/api/src/modules/records/index.ts`
- `packages/contracts/src/canvas.ts`
- `packages/contracts/src/assets.ts`

Actions:

1. Confirm Canvas image/video generation creates a `generation_records` row before or during generation.
2. Confirm generated asset metadata/origin includes:
   - `generationRecordId`
   - `taskId`
   - `providerTaskId` or request/task ID from provider
   - `model`
   - `provider`
   - `prompt`
   - `negativePrompt`
   - `seed`
   - `promptExtend`
   - `watermark`
   - `cost` if available
3. Confirm `generation_records.outputResult` or equivalent stores the final `assetId`.
4. If there are synchronous and asynchronous generation paths, make both return the same `CanvasGenerateImageData` shape.

Acceptance:

- From an AI-generated asset, the app can find the corresponding generation record.
- From a generation record, the app can find the final asset.
- The asset info dialog can show status, cost, trace/task IDs, and error data without guessing.

### Task 2.3 Complete Canvas Pipeline Asset Origins

Files to inspect:

- `packages/db/src/schema/canvas-pipeline-assets.ts`
- `packages/db/src/repositories/canvas-pipeline-assets.repo.ts`
- `services/api/src/modules/canvas-pipeline/service.ts`
- `services/api/src/modules/assets/service.ts`
- `packages/contracts/src/pipeline.ts`
- `packages/contracts/src/assets.ts`

Actions:

1. Decide how unified assets map to `canvas_pipeline_assets`.
2. Ensure `canvas_pipeline` origin contains:
   - `projectId`
   - `projectTitle` when available
   - `phase`
   - `targetEntityType`
   - `targetEntityId`
   - `pipelineRunId`
   - `canvasPipelineAssetId`
   - `model`
   - `cost`
   - `providerUrl`
   - `publicUrl`
3. If `toAssetDto()` cannot access this data with the current query, add a dedicated mapper/query path instead of returning incomplete origins.

Acceptance:

- Pipeline-generated character refs, location refs, shot videos, and final exports can display full origin information.

## Phase 3 - Make Canvas Nodes Persist Complete Asset Info

### Task 3.1 Persist Origin Snapshots on Node Creation

Files to inspect:

- `apps/canvas/src/types.ts`
- `apps/canvas/src/hooks/useNodeActions.ts`
- `apps/canvas/src/hooks/useCanvasGeneration.ts`
- `apps/canvas/src/components/EditorView.tsx`
- `packages/contracts/src/canvas-document.ts`

Actions:

1. Ensure image/video/doc node data supports:
   - `assetId`
   - `assetSource`
   - `assetOrigin`
   - `originSnapshot`
   - `generationRecordId`
   - `canvasPipelineAssetId`
   - `taskId`
   - `generationStatus`
   - `errorMessage`
2. When dragging from asset sidebar into Canvas, write `asset.origin` into the node.
3. When adding generated media, write the returned asset origin into the node.
4. Ensure the Canvas document schema validates these fields.

Acceptance:

- Refreshing a Canvas project preserves the node's asset origin and generation details.

### Task 3.2 Fix SSE Completion Backfill

Files to inspect:

- `apps/canvas/src/screens/CanvasApp.tsx`
- `apps/canvas/src/hooks/useCanvasGeneration.ts`
- `services/api/src/services/sse-manager.ts`
- `services/api/src/modules/sse/index.ts`
- `packages/types/src/sse.ts`
- `packages/runtime/src/sse.ts`

Actions:

1. Confirm current SSE success handler does not only set `src`.
2. Extend task success payload to include:
   - `assetId`
   - `assetOrigin`
   - `generationRecordId`
   - `taskId`
   - `imageUrl` or `videoUrl`
3. If the SSE event cannot include the full origin, add a client follow-up fetch by `taskId` or `generationRecordId`.
4. Update Canvas node data with the same fields used by drag/drop and synchronous generation.

Acceptance:

- An async-generated node has full origin data after SSE completion.
- Refresh after SSE completion still shows the info button and full details.

## Phase 4 - Finish UI Details Instead of Only Showing a Button

### Task 4.1 Unify Asset Detail Rendering

Files to inspect:

- `apps/canvas/src/components/AssetInfoDialog.tsx`
- `apps/canvas/src/components/PipelineArtifactInfo.tsx`
- `apps/assets/src/components/AssetCard.tsx`
- `apps/canvas/src/components/MediaNode.tsx`

Actions:

1. Extract a reusable `AssetDetailView` if one does not exist.
2. Use it from:
   - Canvas node dialog
   - Asset card detail action
   - Pipeline artifact dialog where applicable
3. Keep modal shells separate if needed, but make the detail content consistent.

Acceptance:

- The same asset shows the same core data from Canvas, Assets, and Pipeline.

### Task 4.2 Add AssetCard "View Details"

Files to inspect:

- `apps/assets/src/components/AssetCard.tsx`
- `apps/assets/src/hooks/useAssetsData.ts`
- `apps/assets/src/screens/AssetsApp.tsx`

Actions:

1. Add a menu item named "查看详情".
2. Open the shared asset detail dialog/drawer.
3. Show different sections for upload, AI generation, Pipeline, and manual/imported assets.

Acceptance:

- Users can inspect full asset origin from the asset library without dragging it into Canvas.

### Task 4.3 Finish Pipeline External Asset Drop Metadata

Files to inspect:

- `apps/canvas/src/screens/PipelineEditor.tsx`
- `apps/canvas/src/components/PipelineDetailPanel.tsx`
- `apps/canvas/src/hooks/usePipelineAssets.ts`
- `apps/canvas/src/hooks/usePipelineGraph.ts`
- `services/api/src/modules/canvas-pipeline/index.ts`
- `services/api/src/modules/canvas-pipeline/service.ts`
- `packages/contracts/src/pipeline.ts`
- `packages/types/src/domain/canvas-layout.ts`

Actions:

1. When an asset is dropped onto a character/location/shot node, do not store only a URL.
2. Store:
   - `assetId`
   - `url`
   - `role`
   - `source: 'asset_library'`
   - `originSnapshot`
3. Update API contracts for patching character/location/shot references if needed.
4. Update Pipeline detail panel to show origin from dropped external assets.

Acceptance:

- A Pipeline node reference can explain whether it came from AI generation, upload, Pipeline generation, or external URL.

## Phase 5 - Tighten Type Safety Around Drag/Drop and Auth

### Task 5.1 Replace Direct JSON Casts

Search:

```bash
rg -n "JSON\\.parse\\(raw\\).*as|as AssetDto|as SignalingMessage" apps packages services
```

Actions:

1. Parse `application/super-asset` drag payload through `AssetDtoSchema`.
2. Parse WebRTC signaling messages through an explicit schema or safe validator.
3. Return early on parse failure.

Acceptance:

- Business paths do not trust drag/drop JSON by direct cast.

### Task 5.2 Concentrate `user!`

Search:

```bash
rg -n "user!" services/api/src
```

Actions:

1. Add or reuse a small `getRequiredUser(user)` helper where practical.
2. Replace repeated `user!` in route handlers where it does not make code worse.
3. Leave framework-limitation comments only where unavoidable.

Acceptance:

- New code does not add scattered `user!`.
- Existing auth assertions are either removed or centralized.

## Phase 6 - Tests and Verification

### Task 6.1 Add Focused Tests for Data Chain

Minimum tests:

1. Contract tests:
   - each `AssetOrigin` variant parses
   - invalid origin kind is rejected
   - `AssetDto` requires or normalizes origin
2. API tests:
   - upload returns uploaded origin
   - AI generation returns ai_generated origin with generationRecordId
   - list assets supports `source=ai_generation`
3. Canvas tests:
   - drag asset into Canvas stores origin snapshot
   - generated asset node stores generation origin
4. Pipeline tests:
   - dropping an asset onto a Pipeline node persists `assetId` and `originSnapshot`

Acceptance:

- The data chain is tested independently from visual behavior.

### Task 6.2 Add UI Tests Where Infrastructure Exists

If Vitest + Testing Library is not configured yet, either:

1. add the minimal infrastructure, or
2. extract pure helpers and cover those with `bun test`.

Priority components:

- `MediaNode`
- `AssetInfoDialog` or `AssetDetailView`
- `AssetCard`
- `PipelineDetailPanel`
- `GeneratedImageHistory`

Acceptance:

- AI-generated assets show details controls.
- Uploaded assets do not show AI generation parameters.

## Phase 7 - Final TODO Cleanup

### Task 7.1 Rewrite TODO.md as Truthful Status

Rules:

- Fully complete items may be crossed out and include commit hash.
- Partial items must stay open and include "completed" and "remaining" subsections.
- Deferred product enhancements are "待排期", not completed.
- Blocked items must state the blocker and next concrete step.

Acceptance:

- There are no crossed-out headings with "remaining" bullets underneath.
- `rg -n "剩余|后续|需|⏸️" TODO.md` only matches intentionally open items.

## Final Verification Checklist

Before reporting completion, run:

```bash
pnpm lint
pnpm typecheck
pnpm test
```

Then manually verify:

1. Generate an image in Canvas.
2. Confirm the node shows the details control.
3. Open details and confirm prompt, model, provider, task ID, generation record ID, and asset ID are visible.
4. Refresh the page.
5. Confirm the same node still has the details control and complete origin information.
6. Upload an image manually.
7. Confirm its node shows file/upload info, not AI generation parameters.
8. Drag an AI-generated asset into a Pipeline node.
9. Confirm Pipeline detail shows the asset's origin, not only a URL.

If any refresh loses origin data, the implementation is not complete.
