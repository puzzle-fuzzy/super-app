import { serverEnv } from '@super-app/env/server'
import '@sinclair/typebox' // 初始化 TypeCompiler，消除 exact-mirror Union 警告

import { app } from './app'
import { startSSEListener } from './services/sse-manager'

// 启动 PostgreSQL LISTEN，收听 task 状态变更
await startSSEListener()

app.listen(serverEnv.API_PORT)

console.log(`Super API listening on http://localhost:${serverEnv.API_PORT}`)
