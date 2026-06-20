/**
 * 领域类型 — 附着到 JSONB 列的 TypeScript 接口。
 *
 * 真源在 @super-app/types（domain 模块）+ @super-app/contracts/billing（CostDetail）。
 * 此处 re-export 保持向后兼容，已有 import 路径无需修改。
 */
export type {
  TaskInput,
  TaskOutput,
  TaskErrorInfo,
  GenerationInputParams,
  OutputResult,
  TextOutputResult,
  ImageOutputResult,
  VideoOutputResult,
  ProcessingOutputResult,
  SubtitleOutputResult,
  NovelAnalysis,
  CharacterProfile,
  LocationProfile,
  ShotCamera,
  ShotContinuity,
  ShotTimelineEntry,
  ShotEnvironment,
  ContinuityIssue,
  CanvasLayoutDto,
  CanvasModelPreferences,
  CanvasAssetOutput,
  CanvasShotReferenceAsset,
  DialogueJson,
  R2VReferenceMedia,
  SubtitleSentence,
  SubtitleStyleConfig,
  GenerationNotifyPayload,
} from '@super-app/types'
export type { CostDetail } from '@super-app/contracts/billing'
