import { serverEnv } from '@super-app/env/server'

import { LocalStorageProvider } from './local'
import type { StorageProvider } from './types'

export function createStorage(): StorageProvider {
  return new LocalStorageProvider({
    storageDir: serverEnv.STORAGE_DIR,
    publicBaseUrl: serverEnv.SUPER_PUBLIC_STORAGE_BASE_URL,
  })
}
