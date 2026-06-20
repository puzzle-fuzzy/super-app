import base from './packages/eslint-config/base.mjs'

export default [
  ...base,
  {
    files: [
      'packages/canvas-runtime/src/phases/**/*.ts',
      'services/worker/src/canvas-*.ts',
      'services/worker/src/canvas-adapter-factory.ts',
      'services/worker/src/canvas-handlers.ts',
      'services/worker/src/media-handlers.ts',
      'services/worker/src/pipeline-stepper.ts',
      'services/worker/src/task-handlers.ts',
      'services/worker/src/handlers/generate-image.ts',
      'services/worker/src/handlers/generate-video.ts',
    ],
    rules: {
      // TODO: tighten after the Excuse canvas runtime/worker adapters are fully typed.
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    files: ['services/worker/src/canvas-*.ts'],
    rules: {
      // TODO: remove once these staged canvas handlers are wired to concrete runtime adapters.
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  {
    files: [
      'services/api/src/modules/admin/index.ts',
      'services/api/src/modules/canvas-pipeline/service.ts',
      'services/api/src/modules/subtitle/index.ts',
      'services/api/src/modules/subtitle/service.ts',
    ],
    rules: {
      // TODO: remove when these migrated/stubbed API modules are fully ported.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
]
