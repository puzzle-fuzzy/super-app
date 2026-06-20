import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type UserConfig } from 'vite'

/**
 * 本地 API 服务默认地址。
 *
 * Vite dev server 统一把 `/api` 代理到这里，避免不同 app 依赖不同 env
 * 拼接规则导致双 `/api`、CORS 或 404 问题。
 */
const LOCAL_API_PROXY_TARGET = 'http://localhost:5200'

/**
 * 构建产物中的静态资源目录。
 *
 * 所有 Vite app 统一输出到 `_assets`，便于 collect-frontends 以及静态服务
 * 使用同一套目录约定。
 */
const FRONTEND_ASSETS_DIR = '_assets'

/**
 * Vite 读取 monorepo 根目录环境变量文件时，从 app 目录向上回到仓库根。
 */
const MONOREPO_ROOT_FROM_APP_DIR = '../..'

/**
 * 前端可暴露环境变量前缀。
 *
 * 只允许 `SUPER_PUBLIC_` 进入客户端，避免服务端密钥被 Vite 注入前端包。
 */
const PUBLIC_ENV_PREFIX = 'SUPER_PUBLIC_'

export interface SuperViteAppConfigInput {
  /** 当前 app config 的 `import.meta.url`，用于稳定解析 app 目录。 */
  appUrl: string
  /** 线上部署 base path，例如 `/canvas/`。 */
  base: string
  /** 本地开发端口，必须与 package.json dev script 保持一致。 */
  port: number
}

/**
 * 创建 Super 前端应用的统一 Vite 配置。
 *
 * 这里集中 React、Tailwind CSS v4 Vite 插件、环境变量目录、静态资源目录和
 * `/api` 代理规则；单个 app 只声明自己的目录、base 和端口。
 */
export function createSuperViteAppConfig(input: SuperViteAppConfigInput): UserConfig {
  const appDir = fileURLToPath(new URL('.', input.appUrl))

  return defineConfig({
    plugins: [react(), tailwindcss()],
    envDir: path.resolve(appDir, MONOREPO_ROOT_FROM_APP_DIR),
    envPrefix: PUBLIC_ENV_PREFIX,
    base: input.base,
    build: {
      assetsDir: FRONTEND_ASSETS_DIR,
    },
    server: {
      port: input.port,
      proxy: {
        '/api': {
          target: LOCAL_API_PROXY_TARGET,
          changeOrigin: true,
        },
      },
    },
  })
}
