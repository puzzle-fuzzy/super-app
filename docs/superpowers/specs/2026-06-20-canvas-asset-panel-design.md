# Canvas Asset Panel + Drag-to-Canvas — Phase 4a Design

- **Date:** 2026-06-20
- **Scope:** Phase 4a — an asset sidebar in the canvas editor with HTML5 drag-to-canvas, creating typed asset nodes. Pure frontend; zero backend/DB change.
- **Status:** Draft (pending review)

## Goal

Make the canvas editor usable as a composition surface for assets: open a collapsible sidebar listing the current user's assets (all 7 kinds), drag any asset onto the canvas to create a typed node, and persist those nodes with the project (existing save mechanism). This is the real-world "资产拖入画布" workflow — it supersedes the earlier "asset_relations backend" idea for Phase 4a (relations are deferred).

## Decisions (locked)

| # | Decision |
|---|----------|
| 1 | All 7 asset kinds are draggable into the canvas (image, video, audio, file, text, subject, style). |
| 2 | The sidebar lists the current user's own assets only, via `assetsApi.list` (reused as-is). |
| 3 | Dragging creates a custom React Flow node storing `{ assetId, kind, title, thumbnailUrl? }`. Nodes persist in the project's `data.nodes` via the existing save — **no new table, no asset_relations**. |
| 4 | HTML5 drag/drop (draggable sidebar items + `dataTransfer` + `onDrop` with `screenToFlowPosition`). |
| 5 | Zero backend changes. |

## Non-Goals

- `asset_relations` table / relation API (deferred indefinitely; canvas nodes carry `assetId` directly).
- In-node media playback (video/audio nodes show an icon + title placeholder, no embedded player).
- Reverse editing (editing a canvas node does not write back to the asset).
- Edge/connection semantics between asset nodes (edges are purely visual, like the existing note-node edges).
- Canvas asset panel E2E (Playwright drag across a React Flow canvas is brittle; covered by typecheck + manual verification + existing canvas tests staying green).

## 1. Architecture

The change is entirely inside `apps/canvas/src/screens/CanvasApp.tsx` (the `EditorView` component) plus its `package.json` deps. The sidebar fetches assets via `@super-app/api-client`'s `assetsApi` and renders typed cards; each card is `draggable`. React Flow's `onDrop` reads the asset payload from `dataTransfer`, converts the drop point via `screenToFlowPosition`, and appends a node of a kind-specific type. Each kind has a registered custom node component in `nodeTypes`.

### Data flow

```
assetsApi.list({ kind })  →  Sidebar (draggable cards)
                                  │ onDragStart → dataTransfer.setData('application/super-asset', JSON)
                                  ▼
ReactFlow onDrop → screenToFlowPosition(event) → setNodes(append { type: 'asset-<kind>', data: {assetId,kind,title,thumbnailUrl}, position })
                                  │
                                  ▼
nodeTypes['asset-image' | 'asset-text' | ...] → renders preview/icon card
                                  │
                                  ▼
handleSave → canvasApi.update({ data: { nodes, edges } })  (existing)
```

## 2. Node types

Register `nodeTypes` mapping for kind-specific rendering. To keep the React Flow type system simple and avoid a type-per-kind combinatorial blowup, use a single custom type `asset` whose `data.kind` drives internal rendering, plus keep the built-in `default` for note nodes.

- **`asset`** — renders based on `data.kind`:
  - `image`: `<img src={thumbnailUrl ?? files[0].url}>` (the thumbnail generated in Phase 0 enhancements).
  - `video`/`audio`: an icon (Video/Music) + title.
  - `file`: a file icon + title.
  - `text`: title + a content-snippet (no separate fetch; the list DTO doesn't carry content — show title only to stay simple). *(Refinement: text list items only carry title; show title + 「文本」 label.)*
  - `subject`/`style`: title + kind label.
  - Common chrome: rounded card, title under the media, consistent with the existing note-node styling (`#1c1c1c` bg, `#3a3a3a` border).
- **`default`** — the existing editable note node (unchanged).

Each asset node's `data` stores `{ assetId, kind, title, thumbnailUrl?, fileUrl? }` so it renders offline (no re-fetch) and survives save/load.

## 3. Sidebar

`AssetSidebar` component (rendered inside `EditorView`, to the left of `<ReactFlow>`):
- Header: 「资产」 title + a collapse toggle (chevron). Collapsed state narrows the panel to an icon rail; expanded ~280px.
- Kind filter row: chips for 全部/图片/视频/音频/文件/文本/主体/风格 (reuse the assets-app filter vocabulary).
- Scrollable list of asset cards: thumbnail (image) or kind icon, title, kind label. Each card `draggable`, `onDragStart` sets `dataTransfer` with the asset payload + a marker `application/super-asset`.
- Empty state: 「还没有资产，去资产库上传一些吧。」
- Loads via `assetsApi.list({ kind: activeFilter === 'all' ? undefined : activeFilter, limit: 50 })`, reloads on filter change.

## 4. Drag/drop wiring

- Sidebar card: `<div draggable onDragStart={(e) => { e.dataTransfer.setData('application/super-asset', JSON.stringify(asset)); e.dataTransfer.effectAllowed = 'move' }}>`.
- `<ReactFlow onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}>` plus a wrapping `<div>` that is a drop target. `handleDrop`:
  1. `const raw = e.dataTransfer.getData('application/super-asset')` — bail if empty (not an asset drag).
  2. `const asset = JSON.parse(raw)`.
  3. `const position = screenToFlowPosition({ x: e.clientX, y: e.clientY })` (from `useReactFlow()`).
  4. `setNodes((nds) => [...nds, { id: 'asset-'+Date.now(), type: 'asset', position, data: { assetId: asset.id, kind: asset.kind, title: asset.title, thumbnailUrl: asset.thumbnailUrl, fileUrl: asset.files?.[0]?.url } }]`).
- The `<ReactFlow>` must be wrapped in `<ReactFlowProvider>` so `useReactFlow()` works inside `EditorView` (currently it's not wrapped — add the provider at the `EditorView` root).

## 5. Dependencies

Add to `apps/canvas/package.json`:
- `@super-app/api-client` (for `assetsApi`) — already present.
- `@super-app/contracts` (for `AssetDto`/`AssetKind` types) — add.

No new runtime deps; `@xyflow/react` already provides `useReactFlow`/`ReactFlowProvider`.

## 6. Acceptance Criteria

1. `pnpm --filter @super-app/canvas typecheck` green.
2. `pnpm --filter @super-app/canvas build` succeeds.
3. `pnpm --filter @super-app/canvas lint` clean.
4. Existing canvas API integration tests (`canvas.test.ts`) remain green (no backend change).
5. The editor shows a collapsible asset sidebar listing the logged-in user's assets.
6. Dragging an image asset onto the canvas creates a node that renders the thumbnail.
7. Dragging a text/subject/style asset creates a node that renders the title + kind label.
8. Saving and reopening a project restores the dragged asset nodes (they persist in `data.nodes`).

## 7. File Change Summary

**Modified:** `apps/canvas/src/screens/CanvasApp.tsx` (add `AssetSidebar`, `AssetNode`, wrap in `ReactFlowProvider`, wire `onDrop`/`onDragOver`, register `nodeTypes`), `apps/canvas/package.json` (add `@super-app/contracts` dep).

**New:** none.

## 8. Phase Context

Phase 4a is the user's stated real need: assets usable inside the canvas via drag. It deliberately avoids the `asset_relations` backend (deferred) — canvas nodes reference `assetId` directly, which is sufficient for composition. Phase 4b (template asset) and Phase 4c (workspace status labels) follow.
