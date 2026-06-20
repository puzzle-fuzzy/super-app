import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

export interface BoundaryRule {
  roots: string[]
  forbidden: RegExp
  message: string
  exclude?: RegExp
}

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx'])

export const DEFAULT_BOUNDARY_RULES: BoundaryRule[] = [
  // ── L0 基础设施：零 @super-app/* 依赖（纯叶子层）──────────────
  {
    roots: [
      'packages/env/src',
      'packages/utils/src',
      'packages/error-recovery/src',
      'packages/design-tokens/src',
      'packages/tailwind-config/src',
      'packages/eslint-config',
    ],
    forbidden: /from\s+['"]@super-app\/|import\s*\(\s*['"]@super-app\//,
    message: 'L0 基础设施包禁止依赖任何 @super-app/* 包（须保持零 workspace 依赖）',
  },

  // ── L1 类型契约层 ──────────────────────────────────────────
  // contracts：纯 Zod wire schema，零 @super-app/* 依赖（含禁止依赖 types）
  {
    roots: ['packages/contracts/src'],
    forbidden: /from\s+['"]@super-app\/|import\s*\(\s*['"]@super-app\//,
    message: 'L1 contracts 是 wire 层，禁止依赖任何 @super-app/* 包（含 @super-app/types；依赖只许 types→contracts）',
  },
  // types：只许依赖 contracts（含子路径 /api /records /billing 等）与 error-recovery（L0），禁止依赖 L2 及以上
  {
    roots: ['packages/types/src'],
    forbidden: /from\s+['"]@super-app\/(?!contracts(?:['"]|\/)|error-recovery['"])|import\s*\(\s*['"]@super-app\/(?!contracts(?:['"]|\/)|error-recovery['"])/,
    message: 'L1 types 只能依赖 @super-app/contracts（含子路径）与 @super-app/error-recovery（L0），禁止依赖 L2 及以上',
  },

  // ── L2 纯逻辑层：禁止 IO 包（db/provider/storage/ffmpeg/canvas-runtime）────
  {
    roots: [
      'packages/task-engine/src',
      'packages/canvas-pipeline/src',
      'packages/gateway/src',
      'packages/metrics/src',
      'packages/provider-health/src',
      'packages/subtitle-engine/src',
      'packages/ai-models/src',
      'packages/canvas-engine/src',
      'packages/prompt-engine/src',
      'packages/sse-hub/src',
      'packages/billing/src',
      'packages/runtime/src',
    ],
    forbidden: /from\s+['"]@super-app\/(?:db|provider|storage|ffmpeg|canvas-runtime)['"]|import\s*\(\s*['"]@super-app\/(?:db|provider|storage|ffmpeg|canvas-runtime)['"]|from\s+['"][^'"]*(?:apps|services)\//,
    message: 'L2 纯逻辑层禁止 import IO 包（db/provider/storage/ffmpeg/canvas-runtime）或 apps/services',
  },

  // ── L3 canvas-runtime：IO 通过 adapter-types.ts 注入，不直接 import IO 包 ──
  {
    roots: ['packages/canvas-runtime/src'],
    forbidden: /from\s+['"]@super-app\/(?:db|provider|storage|ffmpeg)['"]|import\s*\(\s*['"]@super-app\/(?:db|provider|storage|ffmpeg)['"]/,
    message: 'canvas-runtime 禁止直接 import db/provider/storage/ffmpeg — 用 adapter-types.ts 注入',
    exclude: /(?:adapter-types)\.ts$/,
  },

  // ── L3 provider：可依赖 shared/types/subtitle-engine/utils，但不依赖 db 或 apps ──
  {
    roots: ['packages/provider/src'],
    forbidden: /from\s+['"]@super-app\/db['"]|from\s+['"][^'"]*(?:apps|services)\//,
    message: 'provider 禁止依赖 db 或 apps/services',
  },

  // ── 所有 packages：禁止反向依赖 apps/services（依赖只许向上）────────
  {
    roots: ['packages'],
    forbidden: /from\s+['"][^'"]*(?:apps|services)\//,
    message: 'packages 禁止 import apps/services（依赖只许向上）',
  },
]

function walk(dir: string): string[] {
  let entries: string[] = []
  let children: string[]
  try {
    children = readdirSync(dir)
  } catch {
    return entries
  }

  for (const child of children) {
    // 跳过依赖目录与构建缓存（不参与边界检查）
    if (child === 'node_modules' || child === '.turbo' || child === 'dist') continue
    const path = join(dir, child)
    let stat
    try {
      stat = statSync(path)
    } catch {
      continue
    }
    if (stat.isDirectory()) {
      entries = entries.concat(walk(path))
      continue
    }

    const dot = child.lastIndexOf('.')
    const ext = dot >= 0 ? child.slice(dot) : ''
    if (SOURCE_EXTENSIONS.has(ext)) entries.push(path)
  }
  return entries
}

export function checkPackageBoundaries(
  rules: BoundaryRule[] = DEFAULT_BOUNDARY_RULES,
  cwd = process.cwd(),
): string[] {
  const violations: string[] = []

  for (const rule of rules) {
    for (const root of rule.roots) {
      const rootPath = join(cwd, root)
      let stat
      try {
        stat = statSync(rootPath)
      } catch {
        continue
      }
      if (!stat.isDirectory()) continue

      for (const file of walk(rootPath)) {
        const source = readFileSync(file, 'utf8')
        if (!rule.forbidden.test(source)) continue

        const relPath = relative(cwd, file).replace(/\\/g, '/')
        if (rule.exclude && rule.exclude.test(relPath)) continue

        violations.push(`${relPath}: ${rule.message}`)
      }
    }
  }

  return violations
}

if (import.meta.main) {
  const violations = checkPackageBoundaries()

  if (violations.length > 0) {
    console.error('Package boundary violations:')
    for (const violation of violations) console.error(`- ${violation}`)
    process.exit(1)
  }

  console.log('Package boundary checks passed')
}
