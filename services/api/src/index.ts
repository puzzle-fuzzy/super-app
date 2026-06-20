import { serverEnv } from '@super-app/env/server'

import { app } from './app'
import { startSSEListener } from './services/sse-manager'

// 启动 PostgreSQL LISTEN，收听 task 状态变更
await startSSEListener()

app.listen(serverEnv.API_PORT)

console.log(`Super API listening on http://localhost:${serverEnv.API_PORT}`)
