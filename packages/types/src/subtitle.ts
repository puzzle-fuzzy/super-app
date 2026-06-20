import type { EntityResponse, ListResponse, MutationOkResponse } from '@super-app/contracts/api'
import type { SubtitleSentence, SubtitleStyleConfig } from './domain/subtitle'

// 字幕核心结构类型从 domain/subtitle re-export，保持单一真源
export type { SubtitleSentence, SubtitleStyleConfig } from './domain/subtitle'

export type SubtitleProjectStatus
  = | 'draft'
    | 'extracting_audio'
    | 'asr_processing'
    | 'subtitle_editing'
    | 'exporting'
    | 'completed'
    | 'failed'

export interface SubtitleProjectDTO {
  id: string
  accountId: string
  videoFileId: string
  videoUrl: string
  audioFileUrl: string | null
  videoDurationMs: number | null
  asrRecordId: string | null
  status: SubtitleProjectStatus
  rawTranscription: unknown
  sentences: SubtitleSentence[] | null
  styleConfig: SubtitleStyleConfig | null
  exportRecordId: string | null
  exportedVideoUrl: string | null
  errorMessage: string | null
  createdAt: string
  updatedAt: string
}

export type SubtitleProjectResponse = EntityResponse<SubtitleProjectDTO>

export type SubtitleProjectListResponse = ListResponse<SubtitleProjectDTO>

export type SubtitleMutationOkResponse = MutationOkResponse
