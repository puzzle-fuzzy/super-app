/**
 * 领域类型 — 附着到 JSONB 列的 TypeScript 接口。
 *
 * 已从 @super-app/shared/domain-types 统一收口。
 * 此处 re-export 保持向后兼容，已有 import 路径无需修改。
 */
export type {
  TaskInput,
  TaskOutput,
  TaskErrorInfo,
  GenerationInputParams,
  OutputResult,
  CostDetail,
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
} from '@super-app/shared/domain-types'
