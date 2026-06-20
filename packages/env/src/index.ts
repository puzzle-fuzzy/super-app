/**
 * @super-app/env — Zod 校验的环境变量（L0 基础设施）
 *
 * 拆分为三态入口，按消费场景选择（避免把 server 端 env 引入客户端 bundle）：
 *  - ./client  — 浏览器可访问的 public env（VITE_* 前缀）
 *  - ./public  — 同 client，显式语义
 *  - ./server  — 仅服务端 env（DATABASE_URL / DASHSCOPE_API_KEY 等，含密钥）
 *
 * 辅助：./env-helpers（OSS/provider/metrics 配置解析）、./config-helpers（OSS 配置加载）。
 * 根入口仅为包发现占位，不 re-export 三态内容。
 */
export {}
