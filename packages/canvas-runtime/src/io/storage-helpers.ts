/**
 * Storage 高层操作 Helper — 组合 CanvasRuntimeStorageAdapter + fetch + Bun API
 *
 * 这些操作原为 CanvasRuntimeStorageAdapter 接口方法，但真实 StorageProvider 不存在它们。
 * 改为自由函数：接收基础 StorageAdapter，在 canvas-runtime 内部组合实现高层语义。
 */

import type { CanvasRuntimeStorageAdapter } from '../adapter-types'

/**
 * 从 URL 推导本地缓存路径
 *
 * 替代原 localCopyPath（被误用为函数，实际接口声明为 string 属性）。
 * 提取 URL path 部分，拼接 baseDir。
 */
export function resolveLocalPath(baseDir: string, url: string): string {
  const pathname = url.split('?')[0]!.split('/').pop() || 'file'
  return `${baseDir}/${pathname}`
}

/**
 * 下载远程文件到本地临时路径，返回本地路径
 */
export async function downloadToTemp(remoteUrl: string, localPath: string): Promise<string> {
  const res = await fetch(remoteUrl)
  if (!res.ok) throw new Error(`下载失败 ${res.status}: ${remoteUrl}`)
  const buf = Buffer.from(await res.arrayBuffer())
  await Bun.write(localPath, buf)
  return localPath
}

/**
 * 上传本地文件到存储，返回 URL
 */
export async function uploadGenerated(
  storage: CanvasRuntimeStorageAdapter,
  localPath: string,
  key: string,
  contentType?: string,
): Promise<string> {
  const file = Bun.file(localPath)
  const buf = Buffer.from(await file.arrayBuffer())
  const result = await storage.put(key, buf, contentType ?? file.type)
  return result.url
}

/**
 * 下载远程文件并上传到存储，返回新 URL
 *
 * 用于 DashScope 返回的临时 URL（24h TTL）→ 转存为永久 URL。
 */
export async function downloadAndUpload(
  storage: CanvasRuntimeStorageAdapter,
  remoteUrl: string,
  targetKey: string,
  contentType?: string,
): Promise<{ url: string }> {
  const res = await fetch(remoteUrl)
  if (!res.ok) throw new Error(`下载失败 ${res.status}: ${remoteUrl}`)
  const buf = Buffer.from(await res.arrayBuffer())
  const ct = contentType ?? res.headers.get('content-type') ?? undefined
  return storage.put(targetKey, buf, ct)
}

/**
 * 批量下载远程 URL 并映射到永久路径
 *
 * 用于 AI 图片生成结果 — 将 provider 临时 URL 数组转存为 storage 永久 URL。
 */
export async function downloadAndMap(
  storage: CanvasRuntimeStorageAdapter,
  urls: string[],
  subDir: string,
  prefix: string,
): Promise<string[]> {
  const results: string[] = []
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i]!
    const key = `${subDir}/${prefix}_${i + 1}.png`
    try {
      const { url: savedUrl } = await downloadAndUpload(storage, url, key, 'image/png')
      results.push(savedUrl)
    }
    catch {
      // 单个 URL 下载失败不阻塞整体，保留空位供调用方降级
      results.push(url)
    }
  }
  return results
}
