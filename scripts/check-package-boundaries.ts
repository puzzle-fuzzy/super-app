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
  // shared: base layer — no IO packages (db/provider/storage/ffmpeg) or apps
  {
    roots: ['packages/shared/src'],
    forbidden: /from\s+['"]@super-app\/(?:db|provider|storage|ffmpeg|canvas-runtime)['"]|import\s*\(\s*['"]@super-app\/(?:db|provider|storage|ffmpeg|canvas-runtime)['"]|from\s+['"][^'"]*(?:apps|services)\//,
    message: '@super-app/shared must stay a base layer and cannot import runtime packages or apps',
  },

  // Pure packages: no IO (db/provider/storage/ffmpeg) or apps; billing is a pure calc utility
  {
    roots: [
      'packages/task-engine/src',
      'packages/workflow-engine/src',
      'packages/gateway/src',
      'packages/metrics/src',
      'packages/provider-health/src',
      'packages/subtitle-engine/src',
      'packages/error-recovery/src',
      'packages/ai-models/src',
    ],
    forbidden: /from\s+['"]@super-app\/(?:db|provider|storage|ffmpeg|canvas-runtime)['"]|import\s*\(\s*['"]@super-app\/(?:db|provider|storage|ffmpeg|canvas-runtime)['"]|from\s+['"][^'"]*(?:apps|services)\//,
    message: 'pure packages cannot import DB/provider/runtime packages or apps',
  },

  // Domain packages: can depend on shared, but not IO (db/provider/storage/ffmpeg)
  {
    roots: [
      'packages/canvas-engine/src',
      'packages/prompt-engine/src',
    ],
    forbidden: /from\s+['"]@super-app\/(?:db|provider|storage|ffmpeg)['"]|import\s*\(\s*['"]@super-app\/(?:db|provider|storage|ffmpeg)['"]|from\s+['"][^'"]*(?:apps|services)\//,
    message: 'domain packages cannot import db/provider/storage/ffmpeg or apps',
  },

  // canvas-runtime: IO through adapter-types.ts — no direct IO imports
  {
    roots: ['packages/canvas-runtime/src'],
    forbidden: /from\s+['"]@super-app\/(?:db|provider|storage|ffmpeg)['"]|import\s*\(\s*['"]@super-app\/(?:db|provider|storage|ffmpeg)['"]/,
    message: 'canvas-runtime must not import db/provider/storage/ffmpeg directly — use adapter-types.ts',
    exclude: /(?:adapter-types)\.ts$/,
  },

  // provider: can depend on shared and subtitle-engine, not db or apps
  {
    roots: ['packages/provider/src'],
    forbidden: /from\s+['"]@super-app\/db['"]|from\s+['"][^'"]*(?:apps|services)\//,
    message: 'provider cannot import db or apps',
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
