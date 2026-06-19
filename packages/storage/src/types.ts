export interface StoragePutInput {
  key: string
  body: Buffer
  mimeType: string
}

export interface StoragePutResult {
  key: string
  bucket: string
  url: string
  size: number
}

export interface StorageProvider {
  put(input: StoragePutInput): Promise<StoragePutResult>
  delete(key: string): Promise<void>
}
