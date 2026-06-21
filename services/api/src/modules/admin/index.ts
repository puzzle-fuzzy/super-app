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
 *   gateway-clients   — GET  /admin/gateway-clients · GET  /admin/gateway-clients/:userId
 *   credit            — POST /admin/credit/add
 *
 * Admin 鉴权：authPlugin → requireAdmin 检查 ADMIN_USER_IDS，非管理员直接 403。
 */
import { Elysia, t } from 'elysia'

import { authPlugin, getRequiredUser, requireAdmin } from '../../plugins/auth'

import { handleGetOverview } from './handlers/overview'
import {
  handleCancelTask,
  handleGetTaskDetail,
  handleListTasks,
  handleRequeueTask,
} from './handlers/tasks'
import { handleGetUserDetail, handleListUserApiKeys, handleListUsers } from './handlers/users'
import {
  handleGetProviderStats,
  handleListProviderHealth,
  handleRestoreProviderHealth,
} from './handlers/providers'
import { handleListProjects } from './handlers/projects'
import { handleListAuditLogs } from './handlers/audit-logs'
import {
  handleResetApiKeyQuota,
  handleRevokeApiKey,
  handleUpdateApiKeyConfig,
} from './handlers/api-keys'
import { handleGetGatewayClientDetail, handleListGatewayClients } from './handlers/gateway'
import { handleCreditAdd, handleListCreditTransactions } from './handlers/credit'

export const adminModule = new Elysia({
  name: 'admin',
  prefix: '/admin',
  detail: { tags: ['管理后台'] },
})
  .use(authPlugin)
  .guard({ beforeHandle: requireAdmin }, (guarded) =>
    guarded
      // ── 概览 ──────────────────────────────────────────────
      .get('/overview', async () => handleGetOverview(), {
        detail: {
          summary: '获取管理后台概览',
          description: '返回用户、生成、任务队列、Canvas 状态和最近失败摘要。',
          tags: ['管理后台'],
          security: [{ bearerAuth: [] }],
        },
      })

      // ── 任务队列 ──────────────────────────────────────────
      .get(
        '/tasks',
        async ({ query }) =>
          handleListTasks({
            status: query.status,
            domain: query.domain,
            search: query.search,
            limit: query.limit,
            offset: query.offset,
          }),
        {
          query: t.Object({
            status: t.Optional(t.String()),
            domain: t.Optional(t.String()),
            search: t.Optional(t.String()),
            limit: t.Optional(t.Numeric()),
            offset: t.Optional(t.Numeric()),
          }),
          detail: {
            summary: '查询统一任务队列',
            tags: ['管理后台'],
            security: [{ bearerAuth: [] }],
          },
        },
      )
      .get('/tasks/:id', async ({ params }) => handleGetTaskDetail(params.id), {
        params: t.Object({ id: t.String() }),
        detail: {
          summary: '查询任务详情（含 Canvas pipeline run 级联）',
          tags: ['管理后台'],
          security: [{ bearerAuth: [] }],
        },
      })
      .post(
        '/tasks/:id/requeue',
        async ({ params }) => handleRequeueTask(params.id),
        {
          params: t.Object({ id: t.String() }),
          detail: { summary: '重新排队任务', tags: ['管理后台'], security: [{ bearerAuth: [] }] },
        },
      )
      .post('/tasks/:id/cancel', async ({ params }) => handleCancelTask(params.id), {
        params: t.Object({ id: t.String() }),
        detail: { summary: '取消任务', tags: ['管理后台'], security: [{ bearerAuth: [] }] },
      })

      // ── 用户管理 ──────────────────────────────────────────
      .get(
        '/users',
        async ({ query }) =>
          handleListUsers({
            search: query.search,
            isActive: query.isActive,
            limit: query.limit,
            offset: query.offset,
          }),
        {
          query: t.Object({
            search: t.Optional(t.String()),
            isActive: t.Optional(t.Boolean()),
            limit: t.Optional(t.Numeric()),
            offset: t.Optional(t.Numeric()),
          }),
          detail: {
            summary: '查询用户列表',
            tags: ['管理后台'],
            security: [{ bearerAuth: [] }],
          },
        },
      )
      .get('/users/:id', async ({ params }) => handleGetUserDetail(params.id), {
        params: t.Object({ id: t.String() }),
        detail: {
          summary: '查询用户详情',
          tags: ['管理后台'],
          security: [{ bearerAuth: [] }],
        },
      })
      .get(
        '/users/:id/api-keys',
        async ({ params }) => handleListUserApiKeys(params.id),
        {
          params: t.Object({ id: t.String() }),
          detail: {
            summary: '查询用户 API Key 列表',
            tags: ['管理后台'],
            security: [{ bearerAuth: [] }],
          },
        },
      )

      // ── Provider 统计 + 降级状态 ───────────────────────────
      .get(
        '/providers',
        async ({ query }) => handleGetProviderStats({ windowHours: query.windowHours }),
        {
          query: t.Object({ windowHours: t.Optional(t.Numeric()) }),
          detail: {
            summary: '查询 provider 错误率与模型成本统计',
            tags: ['管理后台'],
            security: [{ bearerAuth: [] }],
          },
        },
      )
      .get('/provider-health', async () => handleListProviderHealth(), {
        detail: {
          summary: '查询 provider 模型降级状态',
          tags: ['管理后台'],
          security: [{ bearerAuth: [] }],
        },
      })
      .post(
        '/provider-health/:model/restore',
        async ({ params, user }) =>
          handleRestoreProviderHealth(params.model, getRequiredUser(user).id),
        {
          params: t.Object({ model: t.String() }),
          detail: {
            summary: '手动恢复模型降级状态',
            tags: ['管理后台'],
            security: [{ bearerAuth: [] }],
          },
        },
      )

      // ── Canvas 项目 ───────────────────────────────────────
      .get(
        '/projects',
        async ({ query }) =>
          handleListProjects({
            search: query.search,
            status: query.status,
            isDeleted: query.isDeleted,
            limit: query.limit,
            offset: query.offset,
          }),
        {
          query: t.Object({
            search: t.Optional(t.String()),
            status: t.Optional(t.String()),
            isDeleted: t.Optional(t.Boolean()),
            limit: t.Optional(t.Numeric()),
            offset: t.Optional(t.Numeric()),
          }),
          detail: {
            summary: '查询 Canvas 项目列表',
            tags: ['管理后台'],
            security: [{ bearerAuth: [] }],
          },
        },
      )

      // ── 审计日志 ──────────────────────────────────────────
      .get(
        '/audit-logs',
        async ({ query }) =>
          handleListAuditLogs({
            accountId: query.accountId,
            action: query.action,
            from: query.from,
            to: query.to,
            limit: query.limit,
            offset: query.offset,
          }),
        {
          query: t.Object({
            accountId: t.Optional(t.String()),
            action: t.Optional(t.String()),
            from: t.Optional(t.String()),
            to: t.Optional(t.String()),
            limit: t.Optional(t.Numeric()),
            offset: t.Optional(t.Numeric()),
          }),
          detail: {
            summary: '查询审计日志',
            tags: ['管理后台'],
            security: [{ bearerAuth: [] }],
          },
        },
      )

      // ── API Key 管理 ──────────────────────────────────────
      .patch(
        '/api-keys/:id/config',
        async ({ params, body, user }) =>
          handleUpdateApiKeyConfig(params.id, body as { userId: string; name?: string; expiresAt?: string | null }, getRequiredUser(user).id),
        {
          params: t.Object({ id: t.String() }),
          body: t.Object({
            userId: t.String(),
            name: t.Optional(t.String({ maxLength: 120 })),
            expiresAt: t.Optional(t.Nullable(t.String())),
          }),
          detail: {
            summary: '更新 API Key 配置',
            tags: ['管理后台'],
            security: [{ bearerAuth: [] }],
          },
        },
      )
      .post(
        '/api-keys/:id/reset-quota',
        async ({ params, user }) => handleResetApiKeyQuota(params.id, getRequiredUser(user).id),
        {
          params: t.Object({ id: t.String() }),
          detail: {
            summary: '重置 API Key 额度（当前为 no-op — super-app 无 per-key 额度跟踪）',
            tags: ['管理后台'],
            security: [{ bearerAuth: [] }],
          },
        },
      )
      .post(
        '/api-keys/:id/revoke',
        async ({ params, user }) => handleRevokeApiKey(params.id, getRequiredUser(user).id),
        {
          params: t.Object({ id: t.String() }),
          detail: {
            summary: '管理员撤销 API Key',
            tags: ['管理后台'],
            security: [{ bearerAuth: [] }],
          },
        },
      )

      // ── Gateway 客户 ──────────────────────────────────────
      .get(
        '/gateway-clients',
        async ({ query }) =>
          handleListGatewayClients({
            search: query.search,
            limit: query.limit,
            offset: query.offset,
          }),
        {
          query: t.Object({
            search: t.Optional(t.String()),
            limit: t.Optional(t.Numeric()),
            offset: t.Optional(t.Numeric()),
          }),
          detail: {
            summary: '查询 Gateway 客户列表',
            tags: ['管理后台'],
            security: [{ bearerAuth: [] }],
          },
        },
      )
      .get(
        '/gateway-clients/:userId',
        async ({ params }) => handleGetGatewayClientDetail(params.userId),
        {
          params: t.Object({ userId: t.String() }),
          detail: {
            summary: '查询 Gateway 客户详情',
            tags: ['管理后台'],
            security: [{ bearerAuth: [] }],
          },
        },
      )

      // ── 充值 ──────────────────────────────────────────────
      .post(
        '/credit/add',
        async ({ body, user }) =>
          handleCreditAdd(
            body as { accountId: string; amountCents: number; description?: string },
            getRequiredUser(user).id,
          ),
        {
          body: t.Object({
            accountId: t.String(),
            amountCents: t.Number({ minimum: 1 }),
            description: t.Optional(t.String({ maxLength: 500 })),
          }),
          detail: {
            summary: '用户充值',
            tags: ['管理后台'],
            security: [{ bearerAuth: [] }],
          },
        },
      )
      .get(
        '/credit-transactions',
        async ({ query }) => handleListCreditTransactions({ limit: query.limit, offset: query.offset }),
        {
          query: t.Object({
            limit: t.Optional(t.Numeric()),
            offset: t.Optional(t.Numeric()),
          }),
          detail: {
            summary: '查询充值/积分交易记录',
            tags: ['管理后台'],
            security: [{ bearerAuth: [] }],
          },
        },
      ),
  )
