import { describe, expect, it } from 'bun:test'

import { app } from '../../src/app'

describe('api app route mounting', () => {
  it('mounts subtitle routes under a single /api prefix', async () => {
    const mounted = await app.handle(new Request('http://localhost/api/subtitle/projects'))
    const doubled = await app.handle(new Request('http://localhost/api/api/subtitle/projects'))

    expect(mounted.status).toBe(401)
    expect(doubled.status).toBe(404)
  })

  it('mounts admin routes under a single /api prefix', async () => {
    const mounted = await app.handle(new Request('http://localhost/api/admin/overview'))
    const doubled = await app.handle(new Request('http://localhost/api/api/admin/overview'))

    expect(mounted.status).toBe(401)
    expect(doubled.status).toBe(404)
  })
})
