# Assets UI Polish Implementation Plan

> **For agentic workers:** Implement task by task. Keep the existing assets, text, and subject browser flows green.

**Goal:** Turn `apps/assets` into a product-ready asset workspace without changing backend APIs.

**Spec:** `docs/superpowers/specs/2026-06-19-assets-ui-polish-design.md`

---

## Task 1: Update project tracking

- [x] Mark the assets API/module work as complete in `TODO.md`.
- [x] Add changelog entries for Assets Phase 0/1/2 and this UI polish phase.
- [x] Commit if only tracking/docs changed.

## Task 2: Restructure the Assets app shell

- [x] Replace the linear header/filter/upload layout with an app shell.
- [x] Add left rail / responsive top filter navigation.
- [x] Add top action bar with upload, new text, new subject, and logout.
- [x] Preserve all E2E-visible labels.

## Task 3: Add workspace states

- [x] Track list loading state.
- [x] Render skeleton cards while assets are loading.
- [x] Improve empty and error states.
- [x] Keep upload and save disabled states clear.

## Task 4: Keep asset actions on cards

- [x] Keep asset cards as the main interaction surface.
- [x] Avoid persistent detail sidebars.
- [x] Add edit actions for text and subject.
- [x] Add delete confirmation instead of immediate delete.

## Task 5: Keep editor in a modal

- [x] Reuse existing text/subject editor logic.
- [x] Present it as a centered modal dialog.
- [x] Keep save/cancel behavior and validation.

## Task 6: Polish CSS and responsiveness

- [x] Replace old modal/card CSS with top header, tabs, asset grid, and modal styles.
- [x] Verify desktop layout at common widths.
- [x] Verify mobile layout does not overlap or clip.

## Task 7: Validate and commit

- [x] `pnpm format`
- [x] `pnpm typecheck`
- [x] `pnpm lint`
- [x] `pnpm test:e2e`
- [x] `pnpm test`
- [x] `pnpm build`
- [x] Commit final changes.
