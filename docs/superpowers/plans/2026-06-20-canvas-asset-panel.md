# Canvas Asset Panel + Drag-to-Canvas (Phase 4a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add a collapsible asset sidebar to the canvas editor with HTML5 drag-to-canvas, creating typed asset nodes that persist with the project. Pure frontend.

**Architecture:** Modify `apps/canvas/src/screens/CanvasApp.tsx` — add `AssetSidebar` (fetches via `assetsApi.list`, kind-filtered, draggable cards), an `AssetNode` custom React Flow node type rendering per-kind, wrap `EditorView` in `ReactFlowProvider`, and wire `onDrop`/`onDragOver` to create nodes at the drop position via `screenToFlowPosition`. Zero backend change.

**Spec:** `docs/superpowers/specs/2026-06-20-canvas-asset-panel-design.md`

**Key existing facts (from CanvasApp.tsx, read in brainstorm):**
- `EditorView` (line ~514) renders `<ReactFlow>` with `useNodesState`/`useEdgesState`; saves via `canvasApi.update({ data: { nodes, edges } })`.
- Currently NOT wrapped in `ReactFlowProvider` — must add it for `useReactFlow()`.
- Imports from `@xyflow/react` already present; `useReactFlow`, `ReactFlowProvider` need adding.
- `assetsApi` is importable from `@super-app/api-client` (canvas app already depends on it).

---

## Task 1: Add contracts dep + AssetDto/AssetKind imports

**Files:** Modify `apps/canvas/package.json`, `apps/canvas/src/screens/CanvasApp.tsx`.

- [ ] Add `"@super-app/contracts": "workspace:*"` to `apps/canvas/package.json` `dependencies`. Run `pnpm install`.
- [ ] In `CanvasApp.tsx`, add imports: `import type { AssetDto, AssetKind } from '@super-app/contracts/assets'` and `import { assetsApi } from '@super-app/api-client'` (the api-client import line already exists — extend it). Add `ReactFlowProvider, useReactFlow` to the `@xyflow/react` import. Add lucide icons `PanelLeftClose, PanelLeft, Music, Film, File as FileIcon, Palette, Type as TypeIcon, ImageIcon` as needed (some may already be imported).

---

## Task 2: AssetNode custom node component

**Files:** Modify `CanvasApp.tsx`.

- [ ] Add an `AssetNode({ data }: { data: { assetId: string; kind: AssetKind; title: string; thumbnailUrl?: string; fileUrl?: string } })` component. Render a rounded card (`#1c1c1c` bg, `#3a3a3a` border, `borderRadius: 12px`, `padding`, `minWidth: 180`):
  - `image` + `thumbnailUrl`/`fileUrl`: `<img>` (object-cover, fixed height ~140).
  - `video`: `<Film>` icon + title.
  - `audio`: `<Music>` icon + title.
  - `file`: `<FileIcon>` icon + title.
  - `text`: `<TypeIcon>` icon + title.
  - `subject`: `<UserRound>` icon + title + 「主体」 label.
  - `style`: `<Palette>` icon + title + 「风格」 label.
  - Below the media/icon: the title (`text-[13px]`, truncate) and a small kind label.
  - Wrap in `<Handle type="target" position={Position.Top} />` / `<Handle type="source" position={Position.Bottom} />` (import `Handle, Position` from `@xyflow/react`) so edges can connect like note nodes.
- [ ] Define `const nodeTypes = { asset: AssetNode }` (memoized via `useMemo` outside the component or at module scope to avoid React Flow re-create warnings).

---

## Task 3: AssetSidebar component

**Files:** Modify `CanvasApp.tsx`.

- [ ] Add `AssetSidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void })`:
  - State: `filter` (`'all' | AssetKind`, default `'all'`), `items` (`AssetDto[]`), `loading`.
  - `useEffect` → `assetsApi.list({ kind: filter === 'all' ? undefined : filter, limit: 50 })` → `setItems`, reload on `filter` change.
  - Collapsed: render a narrow rail (~52px) with just the toggle button + kind icons.
  - Expanded (~280px): header 「资产」 + toggle; kind-filter chips row; scrollable list of draggable cards. Each card:
    ```tsx
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('application/super-asset', JSON.stringify(asset))
        e.dataTransfer.effectAllowed = 'move'
      }}
      className="...card..."
    >
      {/* thumbnail (image) or kind icon + title */}
    </div>
    ```
  - Empty state text 「还没有资产，去资产库上传一些吧。」
  - Loading state 「加载中…」.

---

## Task 4: Wire sidebar + drag/drop into EditorView

**Files:** Modify `CanvasApp.tsx`.

- [ ] Wrap `EditorView`'s return in `<ReactFlowProvider>...</ReactFlowProvider>` (so `useReactFlow` works). Move the existing `EditorView` body into an inner component (e.g. `EditorViewInner`) that's rendered inside the provider, OR keep `EditorView` and add the provider around the `<main>` — but `useReactFlow` must be called by a component *inside* the provider. Cleanest: rename current `EditorView` → `EditorViewInner`, create a thin `EditorView` that wraps `<ReactFlowProvider><EditorViewInner {...props} /></ReactFlowProvider>`.
- [ ] In `EditorViewInner`: `const { screenToFlowPosition } = useReactFlow()`. Add `const [sidebarCollapsed, setSidebarCollapsed] = useState(false)`.
- [ ] Pass `nodeTypes={nodeTypes}` to `<ReactFlow>`.
- [ ] Add `onDrop` handler:
  ```tsx
  function handleDrop(event: React.DragEvent) {
    event.preventDefault()
    const raw = event.dataTransfer.getData('application/super-asset')
    if (!raw) return
    const asset = JSON.parse(raw) as AssetDto
    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY })
    setNodes((nds) => [
      ...nds,
      {
        id: `asset-${Date.now()}`,
        type: 'asset',
        position,
        data: {
          assetId: asset.id,
          kind: asset.kind,
          title: asset.title,
          thumbnailUrl: asset.thumbnailUrl,
          fileUrl: asset.files?.[0]?.url,
        },
      },
    ])
  }
  ```
- [ ] On `<ReactFlow>`: add `onDrop={handleDrop}` and `onDragOver={(e) => e.preventDefault()}`.
- [ ] Restructure the canvas area: `<div className="flex flex-1">` containing `<AssetSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(c => !c)} />` and the existing `<div className="flex-1"><ReactFlow ...></div>`.

---

## Task 5: Verify + commit

- [ ] `pnpm install` (for the new contracts dep).
- [ ] `pnpm --filter @super-app/canvas typecheck` → PASS.
- [ ] `pnpm --filter @super-app/canvas build` → PASS.
- [ ] `pnpm --filter @super-app/canvas lint` → clean.
- [ ] `pnpm --filter @super-app/api test` → existing canvas API tests still green (no backend change, but sanity).
- [ ] `npx prettier --write apps/canvas/src/screens/CanvasApp.tsx`.
- [ ] Commit `feat(canvas): add asset sidebar with drag-to-canvas nodes`.

---

## Notes for the implementer

1. **`ReactFlowProvider` is mandatory** before `useReactFlow()` works — the current `EditorView` lacks it. Don't skip the provider wrap in Task 4.
2. **`nodeTypes` must be stable** (module-scope or `useMemo`) — React Flow warns/re-creates nodes if the object identity changes each render.
3. The dragged payload is the full list-item `AssetDto`; only `id, kind, title, thumbnailUrl, files[0].url` are stored on the node to render offline and survive save/load.
4. No backend, DB, or API changes — assets come from the existing `GET /api/assets?kind=`.
5. Manual verification of drag (criterion 6-8) requires running the canvas app + API; Playwright drag across React Flow is brittle so it's not an automated E2E here.
