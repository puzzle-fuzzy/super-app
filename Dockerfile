# ==========================================
# Stage 1: Build frontends
# ==========================================
FROM oven/bun:1.3 AS build
WORKDIR /app
COPY package.json bun.lock pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.json ./
COPY apps/ apps/
COPY packages/ packages/
RUN bun install --frozen-lockfile
RUN bun run build:frontends

# ==========================================
# Stage 2: Production dependencies
# ==========================================
FROM oven/bun:1.3 AS runtime-deps
WORKDIR /app
COPY package.json bun.lock pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.json ./

# Copy all workspace package.json files for install
COPY apps/auth/package.json apps/auth/
COPY apps/workspace/package.json apps/workspace/
COPY apps/assets/package.json apps/assets/
COPY apps/transfer/package.json apps/transfer/
COPY apps/docs/package.json apps/docs/
COPY apps/admin/package.json apps/admin/
COPY services/api/package.json services/api/
COPY services/worker/package.json services/worker/
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY packages/provider/package.json packages/provider/
COPY packages/storage/package.json packages/storage/
COPY packages/ffmpeg/package.json packages/ffmpeg/
COPY packages/billing/package.json packages/billing/
COPY packages/canvas-engine/package.json packages/canvas-engine/
COPY packages/canvas-runtime/package.json packages/canvas-runtime/
COPY packages/prompt-engine/package.json packages/prompt-engine/
COPY packages/task-engine/package.json packages/task-engine/
COPY packages/workflow-engine/package.json packages/workflow-engine/
COPY packages/subtitle-engine/package.json packages/subtitle-engine/
COPY packages/provider-health/package.json packages/provider-health/
COPY packages/metrics/package.json packages/metrics/
COPY packages/contracts/package.json packages/contracts/
COPY packages/api-client/package.json packages/api-client/
COPY packages/auth-client/package.json packages/auth-client/
COPY packages/ui-react/package.json packages/ui-react/
COPY packages/env/package.json packages/env/
COPY packages/error-recovery/package.json packages/error-recovery/
COPY packages/ai-models/package.json packages/ai-models/
COPY packages/gateway/package.json packages/gateway/

RUN bun install --frozen-lockfile --production

COPY apps/ apps/
COPY packages/ packages/
COPY services/ services/

# ==========================================
# Stage 3: API runtime
# ==========================================
FROM runtime-deps AS api
WORKDIR /app
ENV NODE_ENV=production
COPY services/api/src/ services/api/src/
COPY packages/ packages/
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD bun -e "await fetch('http://127.0.0.1:3000/api/health/ready').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["bun", "services/api/src/index.ts"]

# ==========================================
# Stage 4: Worker runtime (needs ffmpeg)
# ==========================================
FROM runtime-deps AS worker-base
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*

FROM worker-base AS worker
WORKDIR /app
ENV NODE_ENV=production
COPY services/worker/src/ services/worker/src/
COPY packages/ packages/
EXPOSE 5100
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD bun -e "await fetch('http://127.0.0.1:5100/health/ready').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["bun", "services/worker/src/index.ts"]

# ==========================================
# Stage 5: Nginx static (all frontends)
# ==========================================
FROM nginx:1.27-alpine AS web
COPY infra/nginx/super.yxswy.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/web /usr/share/nginx/html
EXPOSE 80
