import { createStorage } from '@super-app/storage'
import { Elysia } from 'elysia'

export const storagePlugin = new Elysia({ name: 'storage' }).decorate(
  'storage',
  createStorage()
)
