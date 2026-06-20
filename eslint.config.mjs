import base from './packages/eslint-config/base.mjs'

export default [
  ...base,
  // NOTE: canvas-*.ts 和 canvas-runtime phases 中少数残留的 as any
  // 已是必要的结构类型边界（窄→宽 index signature 限制 / notify shape 差异）。
  // 各调用处已标 eslint-disable-next-line 注释。
  {
    files: [
      'services/api/src/modules/admin/index.ts',
      'services/api/src/modules/canvas-pipeline/service.ts',
      'services/api/src/modules/subtitle/index.ts',
      'services/api/src/modules/subtitle/service.ts',
    ],
    rules: {
      // TODO: remove when these migrated/stubbed API modules are fully ported.
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
]
