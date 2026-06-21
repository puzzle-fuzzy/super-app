# Pipeline 全链路集成验收

## 环境要求

- Node.js 24+, pnpm 10+
- PostgreSQL 16+（本地或 Docker）
- FFmpeg 6+（字幕音频提取、视频烧录、拼接）
- Bun 1.3+
- 可选的 NVIDIA GPU（视频生成阶段需要）

## 前置准备

```bash
# 1. 安装依赖
pnpm install

# 2. 启动 PostgreSQL（Docker）
docker run -d --name super-pg \
  -e POSTGRES_DB=super \
  -e POSTGRES_USER=super \
  -e POSTGRES_PASSWORD=super \
  -p 5432:5432 \
  postgres:16

# 3. 初始化数据库
cp .env.example .env  # 修改 DATABASE_URL 为本地配置
pnpm db:generate
pnpm db:migrate

# 4. 启动 MinIO（存储）
docker run -d --name super-minio \
  -e MINIO_ROOT_USER=minio \
  -e MINIO_ROOT_PASSWORD=minio123 \
  -p 9000:9000 -p 9001:9001 \
  minio/minio server /data --console-address ":9001"
```

## 验收步骤 1：API 健康检查

```bash
# 启动 API 服务
pnpm --filter @super-app/api dev

# 验证健康端点
curl http://localhost:5200/api/health
# 预期：{ "status": "ok" }

# 注册用户
curl -X POST http://localhost:5200/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@test.com","password":"Test1234!","name":"测试用户"}'
# 保存返回的 cookie
```

## 验收步骤 2：创建 Pipeline 项目

```bash
# 创建流水线项目
curl -X POST http://localhost:5200/api/pipeline/projects \
  -H 'Content-Type: application/json' \
  -b 'super.sid=<cookie>' \
  -d '{
    "name": "验收测试短片",
    "storyText": "在一个遥远的未来，一名年轻的机器人维修师发现了一个被遗忘的古老秘密。他必须穿越危险的废土，在时间耗尽之前将这个发现带给仅存的人类聚居地。"
  }'
# 保存返回的 projectId
```

## 验收步骤 3：阶段执行

### analyze 阶段
```bash
curl -X POST http://localhost:5200/api/pipeline/projects/{projectId}/analyze \
  -b 'super.sid=<cookie>'
# 预期：返回 { success: true, data: { runId, taskId, taskType } }
```

### characters 阶段（analyze 成功后）
```bash
curl -X POST http://localhost:5200/api/pipeline/projects/{projectId}/characters \
  -b 'super.sid=<cookie>'
```

### locations 阶段
```bash
curl -X POST http://localhost:5200/api/pipeline/projects/{projectId}/locations \
  -b 'super.sid=<cookie>'
```

### storyboard 阶段
```bash
curl -X POST http://localhost:5200/api/pipeline/projects/{projectId}/storyboard \
  -b 'super.sid=<cookie>'
```

### continuity 阶段
```bash
curl -X POST http://localhost:5200/api/pipeline/projects/{projectId}/continuity \
  -b 'super.sid=<cookie>'
```

### rebuild 阶段
```bash
curl -X POST http://localhost:5200/api/pipeline/projects/{projectId}/rebuild \
  -b 'super.sid=<cookie>'
```

### dialogue 阶段
```bash
curl -X POST http://localhost:5200/api/pipeline/projects/{projectId}/dialogue \
  -b 'super.sid=<cookie>'
```

## 验收步骤 4：Worker 执行

```bash
# 在另一个终端启动 Worker
pnpm --filter @super-app/worker dev

# Worker 自动从 task queue claim 任务并执行：
# 1. canvas.analyze → LLM 分析故事文本
# 2. canvas.characters → 生成角色档案
# 3. canvas.locations → 生成场景档案
# 4. canvas.storyboard → 生成分镜
# 5. canvas.continuity → 规则校验连续性
# 6. canvas.rebuild → 重建视频提示词
# 7. canvas.dialogue → 生成对话层

# Worker 日志会显示每个阶段的执行进度
```

## 验收步骤 5：查询运行状态

```bash
# 查询运行记录
curl http://localhost:5200/api/pipeline/projects/{projectId}/runs \
  -b 'super.sid=<cookie>'
# 预期：返回 run 列表，包含每个阶段的 status

# 查询项目详情
curl http://localhost:5200/api/pipeline/projects/{projectId} \
  -b 'super.sid=<cookie>'
# 预期：返回项目完整详情，包含 characters/locations/shots 数据
```

## 验收步骤 6：SSE 验证（可选）

```bash
# 使用 wscat 连接 SSE
# 注意：super-app 的 SSE 通过 HTTP 长连接，不是 WebSocket
# SSE 端点在 API 启动时自动建立
# Worker 完成 task 后通过 PG NOTIFY 推送消息

# 可通过监听 API 日志观察到 SSE 推送：
# [SSE] task_status: { taskId: "...", status: "succeeded" }
```

## 验收步骤 7：取消与重试

```bash
# 取消当前运行的阶段
curl -X POST http://localhost:5200/api/pipeline/projects/{projectId}/cancel \
  -b 'super.sid=<cookie>'

# 重试失败阶段（如果有）
curl -X POST http://localhost:5200/api/pipeline/projects/{projectId}/retry \
  -b 'super.sid=<cookie>'
```

## 验收步骤 8：API 测试套件

```bash
# 运行 API 集成测试（覆盖所有认证路由和业务逻辑）
pnpm --filter @super-app/api test
# 预期：60+ tests pass, 0 fail
```

## 验收记录

| 日期 | 测试者 | 环境 | 结果 | 失败项 |
|------|--------|------|------|--------|
| - | - | - | - | - |

---

# LAN 传输手动 QA Checklist

## 前提条件
- 两台设备在同一网段（Wi-Fi 或有线）
- 两台设备均安装了 Super App（通过浏览器访问）
- 设备 A 有可供传输的文件/资产

## 测试步骤

### 1. 基本传输
- [ ] 设备 A 打开资产中心，选择一个文件 > "传输"
- [ ] 系统生成传输链接/二维码
- [ ] 设备 B 打开链接/LAN 发现页面
- [ ] 设备 B 看到文件信息并确认接收
- [ ] 文件成功传输到设备 B
- [ ] 传输完成后显示成功状态

### 2. 边界测试
- [ ] 空文件（0 字节）传输
- [ ] 大文件（>100MB）传输
- [ ] 文件名含特殊字符
- [ ] 同时传输多个文件
- [ ] 传输过程中关闭浏览器 -> 应显示断开状态

### 3. 断线重连
- [ ] 传输过程中断开 Wi-Fi -> 应在恢复连接后提示失败或重试
- [ ] 切换网络（Wi-Fi → 热点）后重新传输

### 4. 过期处理
- [ ] 等待传输链接过期后尝试打开 -> 应提示链接失效
- [ ] 过期后重新创建传输 -> 应正常工作

### 5. 下载验证
- [ ] 传输完成后，接收方文件应完整可用
- [ ] 文件 MD5/SHA256 校验与源文件一致
- [ ] 图片/视频文件可正常预览

## 验收记录

| 日期 | 测试者 | 设备 A | 设备 B | 网络 | 结果 | 失败项 |
|------|--------|--------|--------|------|------|--------|
| - | - | - | - | - | - | - |
