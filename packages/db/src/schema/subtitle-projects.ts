import type { SubtitleSentence, SubtitleStyleConfig } from '@super-app/types'
import { index, integer, jsonb, pgEnum, pgTable, text, uuid } from 'drizzle-orm/pg-core'

import { createdAtColumn, updatedAtColumn } from './common'
import { generationRecords } from './generation-records'
import { users } from './identity'
import { uploadedFiles } from './uploaded-files'

/**
 * 字幕项目状态枚举
 */
export const subtitleProjectStatusEnum = pgEnum('subtitle_project_status', [
  'draft',
  'extracting_audio',
  'asr_processing',
  'subtitle_editing',
  'exporting',
  'completed',
  'failed',
])

/**
 * 字幕项目表 — 记录字幕生成的完整生命周期
 *
 * 流程：上传视频 → 提取音频 → ASR 识别 → 字幕编辑 → 导出
 */
export const subtitleProjects = pgTable(
  'subtitle_projects',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerId: uuid('owner_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    videoFileId: uuid('video_file_id')
      .references(() => uploadedFiles.id)
      .notNull(),
    videoUrl: text('video_url').notNull(),
    audioFileUrl: text('audio_file_url'),
    videoDurationMs: integer('video_duration_ms'),
    asrRecordId: uuid('asr_record_id').references(() => generationRecords.id),
    status: subtitleProjectStatusEnum('status').notNull().default('draft'),
    rawTranscription: jsonb('raw_transcription'),
    sentences: jsonb('sentences').$type<SubtitleSentence[]>(),
    styleConfig: jsonb('style_config').$type<SubtitleStyleConfig>().default({
      templateId: 'cinema',
      fontSize: 38,
      fontColor: '#FFFFFF',
      outlineColor: '#000000',
      outlineWidth: 2,
      position: 'bottom',
      marginV: 30,
      bold: false,
    }),
    exportRecordId: uuid('export_record_id').references(() => generationRecords.id),
    exportedVideoUrl: text('exported_video_url'),
    errorMessage: text('error_message'),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    index('idx_subtitle_projects_owner_created').on(table.ownerId, table.createdAt),
    index('idx_subtitle_projects_status').on(table.status),
  ],
)

export type SubtitleProject = typeof subtitleProjects.$inferSelect
export type NewSubtitleProject = typeof subtitleProjects.$inferInsert
