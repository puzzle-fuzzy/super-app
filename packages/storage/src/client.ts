import { serverEnv } from '@super-app/env/server'

import { LocalStorageProvider } from './local'
import { OssStorageProvider } from './oss'
import type { StorageProvider } from './types'

export function createStorage(): StorageProvider {
  if (serverEnv.STORAGE_DRIVER === 'oss') {
    return new OssStorageProvider({
      storageDir: serverEnv.STORAGE_DIR,
      publicBaseUrl: serverEnv.SUPER_PUBLIC_STORAGE_BASE_URL,
      bucket: serverEnv.OSS_BUCKET!,
      region: serverEnv.OSS_REGION!,
      endpoint: serverEnv.OSS_ENDPOINT,
      accessKeyId: serverEnv.OSS_ACCESS_KEY_ID!,
      accessKeySecret: serverEnv.OSS_ACCESS_KEY_SECRET!,
      prefix: serverEnv.OSS_PREFIX,
    })
  }

  return new LocalStorageProvider({
    storageDir: serverEnv.STORAGE_DIR,
    publicBaseUrl: serverEnv.SUPER_PUBLIC_STORAGE_BASE_URL,
  })
}
