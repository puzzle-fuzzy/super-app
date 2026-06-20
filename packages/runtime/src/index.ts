/**
 * @super-app/runtime — 跨领域运行时胶水
 *
 * L2 层。收口真正跨 app/service/worker 复用的运行时：
 * logger（pino 封装）、input-limits（输入边界常量）、
 * pg-error（postgres 错误检测）、canvas-phases（跨层阶段注册表）、
 * generation/sse 运行时解析器、webhooks 事件注册表。
 *
 * 禁止 import db/provider/storage/ffmpeg（L3 IO 包）。
 */
export {}
