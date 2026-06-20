/**
 * Subtitle Pipeline Service — 业务逻辑层
 *
 * TODO: 接入 @super-app/db subtitle 相关 repository 函数
 * 当前骨架返回 mock 数据。
 */

export async function createProject(userId: string, videoFileId: string) {
  // TODO: upload video → create subtitle_project record → schedule media.extract-audio task
  return { id: 'sub_1', videoFileId, status: 'draft', sentences: [] }
}

export async function listProjects(userId: string) {
  // TODO: listSubtitleProjectsByAccount(userId)
  return []
}

export async function getProject(id: string, userId: string) {
  // TODO: getSubtitleProjectForAccount(id, userId)
  return null
}

export async function deleteProject(id: string, userId: string) {
  // TODO: verify ownership → deleteSubtitleProject(id)
}

export async function updateSentences(id: string, userId: string, body: { sentences: unknown[] }) {
  // TODO: verify ownership → updateSubtitleSentences(id, body.sentences)
  return { id, sentences: body.sentences }
}

export async function updateStyle(id: string, userId: string, body: { styleConfig: unknown }) {
  // TODO: verify ownership → updateSubtitleStyle(id, body.styleConfig)
  return { id, styleConfig: body.styleConfig }
}

export async function exportProject(id: string, userId: string) {
  // TODO: verify project has sentences → create generation_record → create media.burn-subtitle task
}

export async function retryProject(id: string, userId: string) {
  // TODO: verify status === 'failed' → re-run pipeline based on current phase
  return { id, status: 'processing' }
}
