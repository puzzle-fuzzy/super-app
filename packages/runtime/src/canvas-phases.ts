/**
 * Canvas 流水线阶段单一权威注册表（运行时常量 + 映射函数）。
 *
 * 这是阶段顺序、pause-before、task-type 映射的**唯一运行时来源**：
 *  - `@super-app/canvas-pipeline` 由此派生阶段推进规则（不再手抄）。
 *  - `@super-app/db` 的 `canvas_pipeline_phase` pgEnum 与本注册表双向断言同源（见 db/types.ts）。
 *  - 前端 `PipelineController` / `CostPanel` 由此派生展示顺序与 pauseBefore（不再手抄）。
 *
 * 阶段「类型」(CanvasPipelinePhase) 的真源在 @super-app/types（L1），本文件通过
 * `satisfies readonly CanvasPipelinePhase[]` 在编译期断言 CANVAS_PHASE_ORDER 与该类型同步。
 * 新增阶段需同时改 types 的字面量联合 + 本数组 + 各自实现 + DB pgEnum。
 * 切勿在别处再复制阶段列表 —— 镜像是 drift 的温床。
 */

import type { CanvasPipelinePhase } from '@super-app/types'

/** 阶段类型从 types re-export，保持单一来源（runtime 不重新定义） */
export type { CanvasPipelinePhase } from '@super-app/types'

/** 阶段执行顺序（权威源）— satisfies 断言与 types 的 CanvasPipelinePhase 同源 */
export const CANVAS_PHASE_ORDER = [
  'analyze',
  'characters',
  'locations',
  'characterRefs',
  'locationRefs',
  'storyboard',
  'continuity',
  'rebuild',
  'dialogue',
  'videos',
  'bgm',
  'assemble',
] as const satisfies readonly CanvasPipelinePhase[]

/** 需要用户确认才能继续的阶段（storyboard / videos / assemble） */
export const CANVAS_PAUSE_BEFORE_PHASES = [
  'storyboard',
  'videos',
  'assemble',
] as const satisfies readonly CanvasPipelinePhase[]

/** pause-before 阶段集合（O(1) 查询） */
export const CANVAS_PAUSE_BEFORE: ReadonlySet<CanvasPipelinePhase> = new Set(CANVAS_PAUSE_BEFORE_PHASES)

/** 全部阶段集合（O(1) 校验） */
const CANVAS_PHASE_SET: ReadonlySet<CanvasPipelinePhase> = new Set(CANVAS_PHASE_ORDER)

/** 阶段 → `canvas.<phase>` task type */
export function phaseToTaskType(phase: CanvasPipelinePhase): `canvas.${CanvasPipelinePhase}` {
  return `canvas.${phase}`
}

/** `canvas.<phase>` → 阶段（非法返回 null） */
export function getCanvasPhaseFromTaskType(taskType: string): CanvasPipelinePhase | null {
  if (!taskType.startsWith('canvas.'))
    return null
  const phase = taskType.slice('canvas.'.length)
  return CANVAS_PHASE_SET.has(phase as CanvasPipelinePhase) ? phase as CanvasPipelinePhase : null
}

/** 下一阶段（已是末阶段返回 null） */
export function getNextCanvasPhase(currentPhase: CanvasPipelinePhase): CanvasPipelinePhase | null {
  const index = CANVAS_PHASE_ORDER.indexOf(currentPhase)
  if (index === -1 || index === CANVAS_PHASE_ORDER.length - 1)
    return null
  return CANVAS_PHASE_ORDER[index + 1]!
}

/** 阶段是否需要用户确认才能继续（storyboard / videos / assemble） */
export function isPauseBeforePhase(phase: CanvasPipelinePhase): boolean {
  return CANVAS_PAUSE_BEFORE.has(phase)
}

/** 值是否为合法阶段（类型守卫） */
export function isCanvasPipelinePhase(value: string): value is CanvasPipelinePhase {
  return CANVAS_PHASE_SET.has(value as CanvasPipelinePhase)
}
