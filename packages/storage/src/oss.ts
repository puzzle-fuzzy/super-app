import { mkdir, readFile, rm, stat } from 'node:fs/promises'
import path from 'node:path'

import OSS from 'ali-oss'

import type { StorageProvider, StoragePutInput, StoragePutResult, StorageReadResult } from './types'

export interface OssStorageOptions {
  storageDir: string
  publicBaseUrl: string
  bucket: string
  region: string
  accessKeyId: string
  accessKeySecret: string
  endpoint?: string
  prefix?: string
}

export class OssStorageProvider implements StorageProvider {
  private readonly storageDir: string
  private readonly publicBaseUrl: string
  private readonly bucket: string
  private readonly prefix: string
  private readonly client: OSS

  constructor(options: OssStorageOptions) {
    this.storageDir = options.storageDir
    this.publicBaseUrl = options.publicBaseUrl.replace(/\/$/, '')
    this.bucket = options.bucket
    this.prefix = trimSlashes(options.prefix ?? '')
    this.client = new OSS({
      accessKeyId: options.accessKeyId,
      accessKeySecret: options.accessKeySecret,
      bucket: options.bucket,
      region: options.region,
      endpoint: options.endpoint,
    })
  }

  async put(input: StoragePutInput): Promise<StoragePutResult> {
    await this.writeLocalCopy(input.key, input.body)

    const ossKey = this.toOssKey(input.key)
    await this.client.put(ossKey, input.body, {
      headers: {
        'Content-Type': input.mimeType,
      },
    })

    return {
      key: input.key,
      bucket: this.bucket,
      url: this.urlFor(input.key),
      size: input.body.byteLength,
    }
  }

  async read(key: string): Promise<StorageReadResult> {
    const localPath = this.resolvePath(key)
    try {
      const [body, info] = await Promise.all([readFile(localPath), stat(localPath)])
      return { body, size: info.size }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error
      }
    }

    const result = await this.client.get(this.toOssKey(key))
    const body = bufferFromOssContent(result.content)
    await this.writeLocalCopy(key, body)
    return { body, size: body.byteLength }
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolvePath(key), { force: true })
    try {
      await this.client.delete(this.toOssKey(key))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (!message.includes('NoSuchKey')) {
        throw error
      }
    }
  }

  urlFor(key: string): string {
    return `${this.publicBaseUrl}/${this.toOssKey(key)}`
  }

  resolvePath(key: string): string {
    const resolved = path.resolve(this.storageDir, key)
    const normalizedRoot = path.resolve(this.storageDir)
    if (resolved !== normalizedRoot && !resolved.startsWith(normalizedRoot + path.sep)) {
      throw new Error(`Storage key escapes storage dir: ${key}`)
    }
    return resolved
  }

  private async writeLocalCopy(key: string, body: Buffer): Promise<void> {
    const filePath = this.resolvePath(key)
    await mkdir(path.dirname(filePath), { recursive: true })
    await Bun.write(filePath, body)
  }

  private toOssKey(key: string): string {
    const safeKey = trimSlashes(key)
    return this.prefix ? `${this.prefix}/${safeKey}` : safeKey
  }
}

function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, '')
}

function bufferFromOssContent(content: Buffer | Uint8Array | ArrayBuffer | string): Buffer {
  if (Buffer.isBuffer(content)) {
    return content
  }
  if (typeof content === 'string') {
    return Buffer.from(content)
  }
  if (content instanceof ArrayBuffer) {
    return Buffer.from(content)
  }
  return Buffer.from(content.buffer, content.byteOffset, content.byteLength)
}
