/**
 * Canvas 实体映射器 — DB Drizzle 行类型 → Canvas Runtime Adapter 实体类型
 *
 * @super-app/db 的 getCanvasProjectDetail 返回 Drizzle 窄类型（如 cameraJson: ShotCamera），
 * 而 canvas-runtime phase 函数的 adapter 接口使用宽类型（如 cameraJson: Record<string, unknown>）。
 * Adapter 接口有意避免依赖 DB schema 包。
 *
 * 本文件提供安全的窄→宽类型转换，消除 canvas-*.ts 中的 as any 调用位。
 * 窄→宽转换类型安全（子类型到父类型），此处桥接仅是为满足 TS 对工具链导出类型的差异感知。
 */
import type { CanvasRuntimeRepoAdapter } from '@super-app/canvas-runtime'

/** DB 项目详情 → 运行时项目详情（Adapter 宽类型） */
export function toRuntimeDetail(
  detail: NonNullable<Awaited<ReturnType<typeof import('@super-app/db')['getCanvasProjectDetail']>>>,
): NonNullable<Awaited<ReturnType<CanvasRuntimeRepoAdapter['getCanvasProjectDetail']>>> {
  return detail as unknown as NonNullable<Awaited<ReturnType<CanvasRuntimeRepoAdapter['getCanvasProjectDetail']>>>
}
