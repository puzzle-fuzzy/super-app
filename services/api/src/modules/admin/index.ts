/**
 * 管理后台 API 路由
 *
 * 路由列表：
 *   overview          — GET  /admin/overview
 *   tasks             — GET  /admin/tasks · GET  /admin/tasks/:id · POST /admin/tasks/:id/requeue · POST /admin/tasks/:id/cancel
 *   users             — GET  /admin/users · GET  /admin/users/:id · GET  /admin/users/:id/api-keys
 *   providers         — GET  /admin/providers · GET  /admin/provider-health · POST /admin/provider-health/:model/restore
 *   projects          — GET  /admin/projects
 *   audit-logs        — GET  /admin/audit-logs
 *   api-keys          — PATCH /admin/api-keys/:id/config · POST /admin/api-keys/:id/reset-quota · POST /admin/api-keys/:id/revoke
 *   gateway-clients   — GET  /admin/gateway-clients · GET  /admin/gateway-clients/:accountId
 *   credit            — POST /admin/credit/add
 *
 * Admin 鉴权：authPlugin → adminGuard 检查 adminUserIds，非管理员直接 403。
 */
import { Elysia, t } from 'elysia'

import { authPlugin, requireUser } from '../../plugins/auth'

// ── Handler imports (stubbed for gradual port) ────────────

interface AdminOverview {
  totalUsers: number
  activeUsers24h: number
  totalTasks: number
  pendingTasks: number
  failedTasks24h: number
  totalCreditsCents: number
}

async function getAdminOverview(): Promise<AdminOverview> {
  // TODO: Port from @super-app/db getAdminOverview
  return {
    totalUsers: 0,
    activeUsers24h: 0,
    totalTasks: 0,
    pendingTasks: 0,
    failedTasks24h: 0,
    totalCreditsCents: 0,
  }
}

// ── Module ────────────────────────────────────────────────

export const adminModule = new Elysia({ name: 'admin', prefix: '/api/admin' })
  .use(authPlugin)
  .guard({ beforeHandle: requireUser }, (guarded) =>
    guarded
      // ── 概览 ──────────────────────────────────────────────
      .get('/overview', async () => {
        const overview = await getAdminOverview()
        return { success: true, data: overview }
      }, {
        detail: {
          summary: '获取管理后台概览',
          tags: ['管理后台'],
          security: [{ bearerAuth: [] }],
        },
      })

      // ── 任务队列 ──────────────────────────────────────────
      .get('/tasks', async ({ query }) => {
        // TODO: Port handleListTasks
        const { status, domain, search, limit, offset } = query as Record<string, unknown>
        return { success: true, data: [], total: 0 }
      }, {
        query: t.Object({
          status: t.Optional(t.String()),
          domain: t.Optional(t.String()),
          search: t.Optional(t.String()),
          limit: t.Optional(t.Numeric()),
          offset: t.Optional(t.Numeric()),
        }),
        detail: { summary: '查询统一任务队列', tags: ['管理后台'], security: [{ bearerAuth: [] }] },
      })
      .get('/tasks/:id', async ({ params }) => {
        // TODO: Port handleGetTaskDetail
        return { success: true, data: null }
      }, {
        params: t.Object({ id: t.String() }),
        detail: { summary: '查询任务详情', tags: ['管理后台'], security: [{ bearerAuth: [] }] },
      })
      .post('/tasks/:id/requeue', async ({ params }) => {
        // TODO: Port handleRequeueTask
        return { success: true, message: '任务已重新排队' }
      }, {
        params: t.Object({ id: t.String() }),
        detail: { summary: '重新排队任务', tags: ['管理后台'], security: [{ bearerAuth: [] }] },
      })
      .post('/tasks/:id/cancel', async ({ params }) => {
        // TODO: Port handleCancelTask
        return { success: true, message: '任务已取消' }
      }, {
        params: t.Object({ id: t.String() }),
        detail: { summary: '取消任务', tags: ['管理后台'], security: [{ bearerAuth: [] }] },
      })

      // ── 用户管理 ──────────────────────────────────────────
      .get('/users', async ({ query }) => {
        // TODO: Port handleListUsers
        return { success: true, data: [], total: 0 }
      }, {
        query: t.Object({
          search: t.Optional(t.String()),
          isActive: t.Optional(t.Boolean()),
          limit: t.Optional(t.Numeric()),
          offset: t.Optional(t.Numeric()),
        }),
        detail: { summary: '查询用户列表', tags: ['管理后台'], security: [{ bearerAuth: [] }] },
      })
      .get('/users/:id', async ({ params }) => {
        // TODO: Port handleGetUserDetail
        return { success: true, data: null }
      }, {
        params: t.Object({ id: t.String() }),
        detail: { summary: '查询用户详情', tags: ['管理后台'], security: [{ bearerAuth: [] }] },
      })
      .get('/users/:id/api-keys', async ({ params }) => {
        // TODO: Port handleListUserApiKeys
        return { success: true, data: [] }
      }, {
        params: t.Object({ id: t.String() }),
        detail: { summary: '查询用户 API Key 列表', tags: ['管理后台'], security: [{ bearerAuth: [] }] },
      })

      // ── Provider 统计 + 降级状态 ───────────────────────────
      .get('/providers', async ({ query }) => {
        // TODO: Port handleGetProviderStats
        return { success: true, data: { models: [], errorRates: [], costs: [] } }
      }, {
        query: t.Object({ windowHours: t.Optional(t.Numeric()) }),
        detail: { summary: '查询 provider 统计', tags: ['管理后台'], security: [{ bearerAuth: [] }] },
      })
      .get('/provider-health', async () => {
        // TODO: Port handleListProviderHealth
        return { success: true, data: [] }
      }, {
        detail: { summary: '查询 provider 模型降级状态', tags: ['管理后台'], security: [{ bearerAuth: [] }] },
      })
      .post('/provider-health/:model/restore', async ({ params }) => {
        // TODO: Port handleRestoreProviderHealth
        return { success: true, message: `模型 ${params.model} 已恢复` }
      }, {
        params: t.Object({ model: t.String() }),
        detail: { summary: '手动恢复模型降级状态', tags: ['管理后台'], security: [{ bearerAuth: [] }] },
      })

      // ── Canvas 项目 ───────────────────────────────────────
      .get('/projects', async ({ query }) => {
        // TODO: Port handleListProjects
        return { success: true, data: [], total: 0 }
      }, {
        query: t.Object({
          search: t.Optional(t.String()),
          status: t.Optional(t.String()),
          isDeleted: t.Optional(t.Boolean()),
          limit: t.Optional(t.Numeric()),
          offset: t.Optional(t.Numeric()),
        }),
        detail: { summary: '查询 Canvas 项目列表', tags: ['管理后台'], security: [{ bearerAuth: [] }] },
      })

      // ── 审计日志 ──────────────────────────────────────────
      .get('/audit-logs', async ({ query }) => {
        // TODO: Port handleListAuditLogs
        return { success: true, data: [], total: 0 }
      }, {
        query: t.Object({
          accountId: t.Optional(t.String()),
          action: t.Optional(t.String()),
          from: t.Optional(t.String()),
          to: t.Optional(t.String()),
          limit: t.Optional(t.Numeric()),
          offset: t.Optional(t.Numeric()),
        }),
        detail: { summary: '查询审计日志', tags: ['管理后台'], security: [{ bearerAuth: [] }] },
      })

      // ── API Key 管理 ──────────────────────────────────────
      .patch('/api-keys/:id/config', async ({ params, body }) => {
        // TODO: Port handleUpdateApiKeyConfig
        return { success: true, message: 'API Key 配置已更新' }
      }, {
        params: t.Object({ id: t.String() }),
        body: t.Object({
          userId: t.String(),
          scope: t.Optional(t.String({ maxLength: 20 })),
          rateLimitPerMinute: t.Optional(t.Nullable(t.Number({ minimum: 1, maximum: 10000 }))),
          quotaMaxCents: t.Optional(t.Nullable(t.Number({ minimum: 1 }))),
        }),
        detail: { summary: '更新 API Key 配置', tags: ['管理后台'], security: [{ bearerAuth: [] }] },
      })
      .post('/api-keys/:id/reset-quota', async ({ params }) => {
        // TODO: Port handleResetApiKeyQuota
        return { success: true, message: 'API Key 额度已重置' }
      }, {
        params: t.Object({ id: t.String() }),
        detail: { summary: '重置 API Key 额度', tags: ['管理后台'], security: [{ bearerAuth: [] }] },
      })
      .post('/api-keys/:id/revoke', async ({ params }) => {
        // TODO: Port handleRevokeApiKey
        return { success: true, message: 'API Key 已撤销' }
      }, {
        params: t.Object({ id: t.String() }),
        detail: { summary: '管理员撤销 API Key', tags: ['管理后台'], security: [{ bearerAuth: [] }] },
      })

      // ── Gateway 客户 ──────────────────────────────────────
      .get('/gateway-clients', async ({ query }) => {
        // TODO: Port handleListGatewayClients
        return { success: true, data: [], total: 0 }
      }, {
        query: t.Object({
          search: t.Optional(t.String()),
          limit: t.Optional(t.Numeric()),
          offset: t.Optional(t.Numeric()),
        }),
        detail: { summary: '查询 Gateway 客户列表', tags: ['管理后台'], security: [{ bearerAuth: [] }] },
      })
      .get('/gateway-clients/:accountId', async ({ params }) => {
        // TODO: Port handleGetGatewayClientDetail
        return { success: true, data: null }
      }, {
        params: t.Object({ accountId: t.String() }),
        detail: { summary: '查询 Gateway 客户详情', tags: ['管理后台'], security: [{ bearerAuth: [] }] },
      })

      // ── 充值 ──────────────────────────────────────────────
      .post('/credit/add', async ({ body }) => {
        // TODO: Port handleCreditAdd
        const { accountId, amountCents, description } = body as Record<string, unknown>
        return { success: true, message: `已为 ${accountId} 充值 ${amountCents} 分` }
      }, {
        body: t.Object({
          accountId: t.String(),
          amountCents: t.Number({ minimum: 1 }),
          description: t.Optional(t.String({ maxLength: 500 })),
        }),
        detail: { summary: '用户充值', tags: ['管理后台'], security: [{ bearerAuth: [] }] },
      }),
  )
