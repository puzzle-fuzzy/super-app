/**
 * 将各前端 app 的 dist 目录汇聚到 dist-web/，
 * 按 base 路径分目录存放，site app 放根目录。
 *
 * 使用: bun scripts/collect-frontends.ts
 */

import { cp, mkdir, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const DST = join(ROOT, 'dist-web')

// app → base 映射（site base="/" 放根，其余按 base 分段）
const APPS: { dir: string; base: string }[] = [
  { dir: 'apps/site', base: '/' },
  { dir: 'apps/auth', base: '/auth/' },
  { dir: 'apps/workspace', base: '/workspace/' },
  { dir: 'apps/canvas', base: '/canvas/' },
  { dir: 'apps/assets', base: '/assets/' },
  { dir: 'apps/transfer', base: '/transfer/' },
  { dir: 'apps/console', base: '/api-console/' },
]

async function main() {
  // 清空目标
  await rm(DST, { recursive: true, force: true })
  await mkdir(DST, { recursive: true })

  for (const { dir, base } of APPS) {
    const src = join(ROOT, dir, 'dist')
    const dst = base === '/' ? DST : join(DST, base.replace(/^\//, '').replace(/\/$/, ''))

    try {
      await cp(src, dst, { recursive: true })
      console.log(`✓ ${dir} → dist-web${base}`)
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        console.error(`✗ ${dir}: dist 目录不存在，请先 pnpm build:frontends`)
      } else {
        throw err
      }
    }
  }

  // 生成统一的 404 页面
  const notFoundHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="utf-8"><title>404 - Super</title></head>
<body style="background:#141414;color:#e5e5e5;display:grid;place-items:center;min-height:100vh;font-family:system-ui,sans-serif">
<div style="text-align:center"><h1 style="font-size:48px;margin:0">404</h1><p style="color:#999">页面未找到</p></div>
</body></html>`
  await Bun.write(join(DST, '404.html'), notFoundHtml)

  console.log(`\n✓ 汇聚完成 → ${DST}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
