import { mkdir, readFile, rm, stat } from 'node:fs/promises'
import path from 'node:path'

import type { StorageProvider, StoragePutInput, StoragePutResult, StorageReadResult } from './types'

const LOCAL_BUCKET = 'local'

export interface LocalStorageOptions {
  storageDir: string
  publicBaseUrl: string
}

export class LocalStorageProvider implements StorageProvider {
  private readonly storageDir: string
  private readonly publicBaseUrl: string

  constructor(options: LocalStorageOptions) {
    this.storageDir = options.storageDir
    this.publicBaseUrl = options.publicBaseUrl.replace(/\/$/, '')
  }

  async put(input: StoragePutInput): Promise<StoragePutResult> {
    const filePath = this.resolvePath(input.key)
    await mkdir(path.dirname(filePath), { recursive: true })
    await Bun.write(filePath, input.body)

    const size = await stat(filePath).then((info) => info.size)

    return {
      key: input.key,
      bucket: LOCAL_BUCKET,
      url: this.urlFor(input.key),
      size,
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolvePath(key), { force: true })
  }

  async read(key: string): Promise<StorageReadResult> {
    const filePath = this.resolvePath(key)
    const [body, info] = await Promise.all([readFile(filePath), stat(filePath)])
    return {
      body,
      size: info.size,
    }
  }

  urlFor(key: string): string {
    return `${this.publicBaseUrl}/${key}`
  }

  resolvePath(key: string): string {
    const resolved = path.resolve(this.storageDir, key)
    const normalizedRoot = path.resolve(this.storageDir)
    // Prevent path traversal: resolved path must stay under storageDir.
    if (resolved !== normalizedRoot && !resolved.startsWith(normalizedRoot + path.sep)) {
      throw new Error(`Storage key escapes storage dir: ${key}`)
    }
    return resolved
  }
}
