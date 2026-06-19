# Asset Transfer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build asset share links and 30-second transfer rooms for uploaded assets.

**Architecture:** Share links are persisted in the assets schema. Transfer rooms are short-lived in-memory records registered by the API and consumed by a receiver app. WebSocket signaling is available for P2P negotiation, with a short-lived room download endpoint as a reliability fallback.

**Tech Stack:** Elysia, Drizzle, React/Vite, Playwright, WebSocket, WebRTC DataChannel.

---

### Task 1: Backend contracts and schema

- [x] Add share-link and transfer-session DTOs to `packages/contracts/src/assets.ts`.
- [x] Add `asset_share_links` to `packages/db/src/schema/assets.ts`.
- [x] Generate Drizzle migration.

### Task 2: Backend routes

- [x] Add authenticated `POST /api/assets/:id/share-link`.
- [x] Add anonymous `GET /api/assets/shared/:token`.
- [x] Add authenticated `POST /api/assets/:id/transfer-session`.
- [x] Add anonymous transfer room file-info and file endpoints.
- [x] Add WebSocket signaling relay under `/api/transfers/:roomId/ws`.

### Task 3: Frontend integration

- [x] Add `assetsApi.createShareLink`.
- [x] Add `assetsApi.createTransferSession`.
- [x] Add `传输` and `分享链接` actions to asset cards.
- [x] Add sender-side transfer session startup in `apps/assets`.
- [x] Add `apps/transfer` receiver app.

### Task 4: Verification

- [x] Add API tests for share links and transfer sessions.
- [x] Add transfer room registry tests.
- [x] Add assets E2E coverage for transfer URL receiving.
- [x] Run full verification.
- [x] Commit final changes.
