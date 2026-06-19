# Asset Transfer Design Spec

- **Date:** 2026-06-19
- **Scope:** Asset share links and short-lived transfer rooms.
- **Status:** Implemented

## Goal

Allow an asset owner to share an uploaded asset in two ways:

1. Create an anonymous share link for direct download.
2. Create a 30-second transfer room that can be opened from another device on the LAN.

## Product Shape

- Assets app card actions include `传输` and `分享链接`.
- `分享链接` creates a persistent anonymous download URL and copies it.
- `传输` creates a 30-second room, copies the receiver URL, and starts a sender-side WebRTC signaling session.
- Transfer receiver app opens at `/transfer/?room=<roomId>`.
- The receiver app connects to API WebSocket signaling for P2P negotiation and also uses the short-lived room file endpoint as a reliability fallback.

## Backend Shape

- `POST /api/assets/:id/share-link`: authenticated, creates a share token for an owned active asset.
- `GET /api/assets/shared/:token`: anonymous, downloads the original asset file.
- `POST /api/assets/:id/transfer-session`: authenticated, creates a 30-second in-memory transfer room.
- `GET /api/transfers/:roomId/file-info`: anonymous, returns short-lived file metadata.
- `GET /api/transfers/:roomId/file`: anonymous, downloads the original file while the room is active.
- `WS /api/transfers/:roomId/ws`: anonymous signaling relay for peer-id, peer list, ready, offer, answer, ICE, and peer-left messages.

## Acceptance Criteria

- API tests cover share-link creation/download and 30-second transfer sessions.
- Transfer room registry tests cover active and expired rooms.
- Assets E2E covers opening a transfer URL and receiving the uploaded file.
- `pnpm format`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:e2e`, and `pnpm build` pass.
