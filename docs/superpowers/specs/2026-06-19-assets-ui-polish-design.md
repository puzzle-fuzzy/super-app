# Assets UI Polish — Design Spec

- **Date:** 2026-06-19
- **Scope:** Productize `apps/assets` after Assets Phase 0, Text Phase 1, and Subject Phase 2.
- **Status:** Draft for implementation

## Goal

Turn the assets app from a functional verification screen into a usable asset workspace. The app should keep the existing API behavior and E2E flows, while improving hierarchy, navigation, editing, deletion safety, loading/empty/error states, and responsive layout.

## Non-goals

- No new asset API types.
- No new UI framework.
- No object-storage architecture changes.
- No search backend yet. Search can be visual-only or deferred.
- No relation graph or reference images.

## Product Shape

The assets app becomes a focused workspace:

- Top header: user context, logout, and a user-facing hero for the asset library.
- Top tabs: asset type navigation stays horizontal on desktop and scrollable on small screens.
- Main area: current collection status, asset grid, loading skeletons, empty state.
- Asset cards: preview, title, metadata, edit action for text/subject, delete action.
- Modal dialogs: text/subject editing and delete confirmation stay centered and focused.

## Required UX Changes

1. Replace the flat header/filter/upload stack with a polished top-header workspace.
2. Keep existing labels used by E2E:
   - `资产中心`
   - `主体`
   - `文本`
   - `新建主体`
   - `新建文本`
   - `编辑`
   - `删除`
3. Add loading state for list fetches.
4. Add delete confirmation before removing assets.
5. Keep asset actions on cards rather than adding a persistent detail sidebar.
6. Preserve upload, create text, create subject, edit text, edit subject, delete flows.
7. Keep responsive behavior: top tabs remain usable without overlap on narrow screens.

## Visual Direction

Use a polished user-facing creative library aesthetic:

- Dark charcoal surfaces using existing design tokens.
- Clear horizontal tabs instead of a dashboard sidebar.
- Generous spacing and readable Chinese copy.
- Warm accent usage for creation actions and active tabs.
- Enough atmosphere to feel like a toC creative surface, without hiding core actions.
- Cards should be functional asset tiles, not nested decorative panels.

## Acceptance Criteria

- `pnpm --filter @super-app/assets typecheck` passes.
- `pnpm --filter @super-app/assets build` passes.
- `pnpm test:e2e` passes all existing browser flows.
- `pnpm format`, `pnpm lint`, `pnpm typecheck`, and `pnpm build` pass before commit.
- Existing API behavior remains untouched.
