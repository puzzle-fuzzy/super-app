import { serverEnv } from '@super-app/env/server'

import { app } from './app'

app.listen(serverEnv.API_PORT)

console.log(`Super API listening on http://localhost:${serverEnv.API_PORT}`)
