# Canvas tersa Alignment Design

Date: 2026-06-21  
Target: Align super-app canvas UX to tersa 1:1 (style + functionality)

## Overview

Replicate tersa's canvas interaction patterns into super-app's canvas editor, while preserving super-app's server-side persistence architecture (API + PostgreSQL).

## Architecture Principle

- **Persistence**: Keep existing server-side API persistence — no change
- **AI backend**: Keep DashScope backend — only improve frontend model selection UX
- **Frontend**: Replicate all tersa canvas interactions and visual styling

---

## New Components

| File | Purpose |
|---|---|
| `components/canvas/DropNode.tsx` | cmd command palette node; appears on double-click / drag-connect-to-empty |
| `components/canvas/CanvasContextMenu.tsx` | Right-click menu on canvas background (Add node, Select all) |
| `components/canvas/NodeContextMenu.tsx` | Right-click menu on nodes (Duplicate, Focus, Delete) |
| `components/canvas/NodeToolbar.tsx` | Floating toolbar below selected nodes (model selector, generate, download) |
| `components/canvas/ConnectionLine.tsx` | Custom animated connection line during drag |
| `components/canvas/edges/AnimatedEdge.tsx` | Default edge with flowing dot animation |
| `components/canvas/edges/TemporaryEdge.tsx` | Dashed temporary edge from drop nodes |
| `hooks/useCanvasEdges.ts` | Edge lifecycle: connect, connectEnd, connectStart, isValidConnection |
| `hooks/useCanvasKeyboard.ts` | Unified keyboard shortcuts (Ctrl+A/C/V/D) |
| `components/ui/context-menu.tsx` | shadcn ContextMenu wrapper (Radix) |

---

## Modified Files

| File | Changes |
|---|---|
| `EditorView.tsx` | Wire in DropNode, ContextMenus, shortcuts, new edge types, ConnectionLine |
| `canvasStore.ts` | Add `copiedNodes`, `duplicateNode`, `copyNodes`, `pasteNodes` |
| `SelectionToolbar.tsx` | Add Download button (wire existing `handleDownloadSelected`) |
| `types.ts` | Add `dropNode` type |
| `MediaNode.tsx` | Dual mode (primitive/transform), NodeToolbar integration, tersa card style |
| `DocNode.tsx` | NodeContextMenu wrapper, tersa card style |
| `TextNode.tsx` | NodeContextMenu wrapper, tersa card style |
| `GroupNode.tsx` | NodeContextMenu wrapper, tersa card style |
| `ModeToolbar.tsx` | Style alignment |
| `useInputListeners.ts` | Remove shortcut logic (migrated to useCanvasKeyboard) |

---

## Node Creation UX

Three trigger paths:
1. **Double-click canvas** → Drop Node command palette at click position
2. **Drag handle to empty space** → Drop Node + temporary edge
3. **Right-click canvas** → "Add node" menu item → Drop Node

Drop Node behavior:
- cmd searchable command palette listing: Text, Image, Video, Document
- On type selection: remove Drop Node, create real node at same position
- If temporary edge exists: promote to animated edge connecting source → new node
- Dismiss on Escape or click outside

---

## Keyboard Shortcuts

| Key | Action |
|---|---|
| Ctrl/Cmd+A | Select all nodes |
| Ctrl/Cmd+C | Copy selected nodes to in-memory clipboard |
| Ctrl/Cmd+V | Paste nodes at +200,+200 offset |
| Ctrl/Cmd+D | Duplicate selected nodes |
| Backspace/Delete | Delete selected (existing) |

All exclude input/textarea/contentEditable contexts.

---

## Context Menus

**Canvas background:**
- Add node → Drop Node at position
- Select all

**Node:**
- Duplicate — offset copy
- Focus — animated setCenter(duration: 1000)
- Delete — destructive

---

## Edge System

- **AnimatedEdge**: Bezier path with flowing dot (CSS dash animation)
- **TemporaryEdge**: Dashed, exists only while Drop Node is active
- **ConnectionLine**: Bezier from handle to cursor with terminal circle
- **Cycle detection**: DFS from target — if can reach source, reject connection
- **Source validation**: videoNode and dropNode cannot be sources

---

## NodeToolbar

Positioned below selected nodes via `@xyflow/react` `<NodeToolbar>`.

Each node has two modes:
- **Primitive** (no incoming connections): Shows content; no toolbar
- **Transform** (has incoming connections): Toolbar visible

Toolbar items: model selector, generate/regenerate, download, timestamp

Bottom prompt bar remains for creating new standalone nodes (no upstream).

---

## Visual Style (tersa alignment)

- Node card: `rounded-[28px]`, `ring-1 ring-[#2a2a2a]`, `bg-[#1c1c1c]`
- Title: `font-mono text-xs text-[#666666]` positioned above node at `-top-6`
- Content: `rounded-3xl overflow-hidden`
- NodeToolbar: `rounded-full bg-[#1c1c1c] border border-[#3a3a3a]`
- Controls: horizontal, circular buttons, `showInteractive={false}`
- Drop Node panel: `rounded-2xl bg-[#1c1c1c] border border-[#3a3a3a]`

---

## Implementation Phases

1. **Foundation**: Dependencies, types, store, context-menu UI component
2. **Edge system**: AnimatedEdge, TemporaryEdge, ConnectionLine, useCanvasEdges
3. **Drop Node**: cmd command palette, nodeTypes registration
4. **Context menus**: NodeContextMenu, CanvasContextMenu
5. **NodeToolbar**: Per-node AI controls, dual mode
6. **Keyboard shortcuts**: useCanvasKeyboard hook
7. **Integration & styles**: Wire everything in EditorView, align visual styles
8. **Verification**: Full typecheck, manual testing
