import { loadWorkerConfig } from './worker.config'
import { checkWorkerEnvironment } from './task-handlers'
import { setupLifecycle } from './worker-lifecycle'

console.log('============================================================')
console.log('  Super Task Worker')
console.log('============================================================')

const config = loadWorkerConfig()
console.log(`[worker] id=${config.workerId}`)
console.log(
  `[worker] config: poll=${config.pollIntervalMs}ms claimTtl=${config.claimTtlMs}ms heartbeat=${config.heartbeatMs}ms health=:${config.healthPort}`
)

const warnings = checkWorkerEnvironment()
for (const w of warnings) console.warn(`[worker] ⚠ ${w}`)

setupLifecycle(config)

console.log('[worker] running. Press Ctrl+C to stop.')
