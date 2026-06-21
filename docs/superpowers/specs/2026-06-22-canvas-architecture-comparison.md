# 画布架构对比：super-app 原版 vs tersa

Date: 2026-06-22

---

## 1. 整体架构

| 维度 | super-app 原版 | tersa |
|---|---|---|
| 框架 | Vite + React 18 SPA | Next.js 16 + React 19 |
| 路由 | React Router v6 (客户端路由) | Next.js App Router (文件路由) |
| 画布核心库 | @xyflow/react | @xyflow/react |
| 运行时 | 浏览器客户端 only | Server Actions + 客户端 |
| 构建工具 | Vite + Turborepo | Turbopack + pnpm |

**关键差异**: tersa 是 Next.js 项目，可以利用 Server Components 和 Server Actions 直接在服务端执行 AI 调用；super-app 是纯 SPA，所有 API 调用通过 HTTP fetch。

---

## 2. 节点数据模型

### 2.1 super-app 原版 — 5 种节点

```typescript
// 图片节点
interface ImageNodeData {
  src: string                    // 图片 URL
  fileName: string               // 文件名
  width?: number
  height?: number
  uploading?: UploadState        // 上传进度 (0..1 + fileName)
  generationStatus?: GenerationStatus  // 'queued'|'submitting'|'generating'|'saving'|'succeeded'|'failed'
  errorMessage?: string
  groupId?: string               // 所属分组
  assetId?: string               // 资产库 ID
  assetSource?: AssetSource      // 来源
  assetOrigin?: AssetOrigin      // 原始出处
  generationRecordId?: string    // 生成记录 ID
  taskId?: string                // 异步任务 ID
}

// 视频节点 — 与图片节点数据结构完全一样
interface VideoNodeData { /* 同上 */ }

// 文档节点
interface DocNodeData {
  src: string
  fileName: string
  fileSize: number
  uploading?: UploadState
  groupId?: string
  assetId?: string
}

// 文本节点
interface TextNodeData {
  description: string   // 纯文本内容
  groupId?: string
}

// 小组节点（分组容器）
interface GroupNodeData {
  label: string
  width: number
  height: number
}
```

**特点**:
- 数据是与资产库深度耦合的（assetId, assetSource, assetOrigin）
- 每个节点有 `groupId` 支持分组
- 有复杂的生成状态机（6 种状态）
- 上传和生成共享同一个数据结构
- 文本节点不可编辑，只读显示

### 2.2 tersa — 3 种节点

```typescript
// 图片节点 — 双模
interface ImageNodeData {
  content?: { url: string; type: string }   // 用户上传（原始模式）
  generated?: { url: string; type: string }  // AI 生成（转换模式）
  model?: string                             // 选中的模型
  description?: string                       // AI 自动描述
  instructions?: string                      // 用户指令
  width?: number
  height?: number
  updatedAt?: string                         // 更新时间
}

// 视频节点 — 双模
interface VideoNodeData {
  content?: { url: string; type: string }
  generated?: { url: string; type: string }
  model?: string
  instructions?: string
  width?: number
  height?: number
  updatedAt?: string
}

// 文本节点 — 双模
interface TextNodeData {
  content?: JSONContent           // TipTap JSON（原始模式）
  text?: string                   // 纯文本提取
  generated?: { text: string }    // AI 生成文本（转换模式）
  model?: string
  instructions?: string
  updatedAt?: string
}
```

**特点**:
- 每个节点有 `content`（用户输入）和 `generated`（AI 输出）两个清晰分离的字段
- 没有资产库耦合、没有 group、没有 6 种生成状态
- 文本节点使用 TipTap 富文本编辑器，支持实时编辑
- 数据模型极简，只关心画布本身
- **不存在 DocNode、GroupNode**

### 2.3 数据模型对比总结

| 特性 | super-app | tersa |
|---|---|---|
| 节点数量 | 5 种 | 3 种 |
| 数据复杂度 | 13+ 字段/节点 | 6-8 字段/节点 |
| 资产库耦合 | 强耦合 (assetId, assetSource, assetOrigin) | 无耦合 |
| 分组系统 | 有 (groupId, GroupNode) | 无 |
| 生成状态 | 6 状态状态机 | 简单 loading boolean |
| 上传/生成分离 | 混合在同一结构 | content/generated 清晰分离 |
| 文本编辑 | 只读 | TipTap 富文本 |
| 双模切换 | 无 | 根据入边数量自动切换 |

---

## 3. 节点渲染架构

### 3.1 super-app 原版

```
EditorView.tsx
  ├── MediaNode.tsx         ← 处理 imageNode + videoNode（同一个组件）
  ├── DocNode.tsx           ← 文档节点
  ├── TextNode.tsx          ← 文本节点（只读按钮）
  ├── GroupNode.tsx         ← 分组容器
  └── 各种独立组件
       ├── SelectionToolbar.tsx   ← 手写浮动工具栏（绝对定位计算）
       ├── GroupToolbar.tsx       ← 分组工具栏
       ├── ModeToolbar.tsx        ← Pan/Select 模式切换
       ├── AssetSidebar.tsx       ← 左侧资产库侧栏
       ├── ImageGenerationPromptBar.tsx  ← 底部 AI 生成提示栏
       ├── FullscreenPreview.tsx
       ├── TextPreviewModal.tsx
       ├── GroupNameModal.tsx
       ├── AssetInfoDialog.tsx
       ├── ErrorBoundary.tsx
       ├── ErrorToast.tsx
       └── EmptyHint.tsx
```

**特点**:
- 每个节点类型一个独立组件，自行处理 Handle、样式、交互
- 浮动工具栏自己计算屏幕坐标（容易出错）
- AI 生成由底部统一提示栏驱动，非节点级
- 存在很多 modals/toasts/工具组件散落各处

### 3.2 tersa

```
canvas.tsx
  └── Canvas (ReactFlow wrapper)
       └── NodeLayout          ← 统一包装器（所有节点共用）
            ├── Handle (target + source)
            ├── 标题栏（font-mono, -top-6）
            ├── 圆角卡片（rounded-[28px], ring-1）
            ├── NodeToolbar（@xyflow/react 内置 NodeToolbar）
            ├── ContextMenu（Duplicate/Focus/Delete）
            └── 子内容
                 ├── TextNode: TextPrimitive | TextTransform
                 ├── ImageNode: ImagePrimitive | ImageTransform
                 └── VideoNode: VideoPrimitive | VideoTransform

NodeLayout 统一提供：
  - Card 样式 (rounded-[28px] + ring-1 + bg-card)
  - Handle (target: always, source: !videoNode)
  - 标题栏 (absolute -top-6, font-mono)
  - 右键菜单 (Copy/Duplicate, Focus, Delete)
  - NodeToolbar (@xyflow/react 内置，position=Bottom)
```

**特点**:
- **NodeLayout 是核心**：所有节点共享同一个包装器，消除重复代码
- 使用 @xyflow/react 内置 NodeToolbar，不需要手动计算坐标
- 右键菜单内置于 NodeLayout，每个节点自动获得
- AI 生成由节点自己的 toolbar 驱动，而非集中式提示栏
- 双模切换在节点 index.tsx 中通过 `useNodeConnections` 判断

### 3.3 渲染对比总结

| 特性 | super-app | tersa |
|---|---|---|
| 节点包装 | 每个组件独立实现 | NodeLayout 统一包装 |
| 工具栏定位 | 手动计算屏幕坐标 | @xyflow/react NodeToolbar |
| AI 生成入口 | 底部集中式 PromptBar | 每节点独立 Toolbar |
| 右键菜单 | 无 | 内置 NodeLayout |
| 双模切换 | 无 | useNodeConnections 判断 |
| 代码复用 | 低（MediaNode 同时处理 image/video） | 高（NodeLayout 复用 3 次） |

---

## 4. 状态管理

### 4.1 super-app 原版 — Zustand

```typescript
// canvasStore.ts — 全局 Store
{
  nodes: AppNode[]
  loading: boolean
  initialized: boolean
  selectedNodeIds: string[]
  interactionMode: 'pan' | 'select'
  focusedGroupId: string | null
  copiedNodes: AppNode[]

  onNodesChange()        // ReactFlow 变化处理 + 解组拦截
  handleDeleteSelected()
  handleCreateGroup()
  handleUngroup()
  handleRenameGroup()
  handleOrganize()        // 瀑布布局
  handleOrganizeGroup()
  handleCopyNodes()
  handlePasteNodes()
  handleDuplicateSelected()
}

// uiStore.ts
{ darkMode, error, showGroupNameModal, groupNameModalMode,
  groupNameModalTarget, fullscreenPreview, textPreview, generationPrefill }

// inputStore.ts
{ spaceHeld, mousePosition }
```

**特点**:
- 3 个 Zustand store，逻辑分散
- Store 包含大量 UI 状态（modal、preview、error toast）
- 分组逻辑嵌入 Store（handleCreateGroup, handleUngroup 等）
- 持久化通过回调注入模式（setPersistCallback）

### 4.2 tersa — React useState + Context

```typescript
// canvas.tsx 组件内
const [nodes, setNodes] = useState<Node[]>([])
const [edges, setEdges] = useState<Edge[]>([])
const [copiedNodes, setCopiedNodes] = useState<Node[]>([])

// NodeOperationsProvider (Context)
{ addNode, duplicateNode }

// useGateway() (Context)
{ models, imageModels, videoModels }
```

**特点**:
- **无全局 Store**：所有状态在 canvas.tsx 组件内部
- 只有 2 个 Context：NodeOperations（节点操作）、Gateway（模型列表）
- 没有 UI 状态 store
- 极简

### 4.3 状态管理对比

| 特性 | super-app | tersa |
|---|---|---|
| 方案 | Zustand × 3 stores | useState + Context |
| UI 状态 | 混在 Store 里 | 组件内部 |
| 分组逻辑 | Store 内置 | 无分组功能 |
| 持久化注入 | 回调注入模式 | 直接调用 localStorage |
| 复杂度 | 高（240 行 canvasStore） | 低（所有逻辑在 canvas.tsx 内） |

---

## 5. AI 生成流程

### 5.1 super-app 原版 — 集中式 + 异步任务

```
ImageGenerationPromptBar (底部面板)
  → 用户填写 prompt、选模型、调参数
  → POST /canvas/generate-image
  → 后端创建 Task（异步）
  → 前端创建占位节点（generationStatus='queued'）
  → SSE 监听 task_status 事件
  → 收到 completed → 替换节点数据（generationStatus='succeeded'）
  → 收到 failed → 显示错误
```

**关键文件**:
- `ImageGenerationPromptBar.tsx` — 集中式生成 UI
- `useCanvasGeneration.ts` — 生成逻辑 hook
- `SSE task_status` — 实时状态推送
- `services/api/src/modules/canvas/index.ts` — 后端路由

**特点**:
- 生成是**集中式**的：所有生成都从底部提示栏发起
- 异步任务模式：创建 task → SSE 监听 → 回填结果
- 生成参数（model, size, negative prompt, seed 等）非常丰富
- 与 DashScope 后端深度绑定

### 5.2 tersa — 节点级 + Server Actions

```
ImageNode (有入边时 → ImageTransform)
  → NodeToolbar 显示 ModelSelector + Generate 按钮
  → 用户点击 Generate
  → generateImageAction() — Server Action
    → 收集上游节点输入（文本 + 图片）
    → 调用 Vercel AI SDK Gateway
    → 上传结果到 Vercel Blob
    → 返回 { url, type, description }
  → updateNodeData(id, { generated: { url, type }, description })
  → 节点自动显示生成的图片

**关键**: 完全不经过 API 路由，直接 Server Action → AI Gateway
```

**关键文件**:
- `app/actions/image/create.ts` — 图片生成 Server Action
- `app/actions/image/edit.ts` — 图片编辑（图生图）Server Action
- `app/actions/image/describe.ts` — 图片自动描述 Server Action
- `app/actions/video/create.ts` — 视频生成 Server Action
- `app/api/chat/route.ts` — 文本生成（流式）
- 每个 transform.tsx 节点自行调用

**特点**:
- 生成是**节点级**的：每个 transform 节点自己发起
- 使用 Next.js Server Actions（无 API 路由层）
- Vercel AI SDK Gateway 统一抽象多提供商
- 模型选择器在 NodeToolbar 中（每个节点独立选择模型）
- 流式文本生成使用 `useChat` hook

### 5.3 生成流程对比

| 特性 | super-app | tersa |
|---|---|---|
| 触发方式 | 集中式底部面板 | 每节点独立 Toolbar |
| 后端调用 | REST API → Task → SSE | Server Action 直接调用 |
| 模型选择 | 底部面板内 | NodeToolbar 里 |
| AI 提供商 | DashScope（硬编码） | Gateway（动态发现 ~35 提供商） |
| 异步处理 | Task + SSE 推送 | Server Action await |
| 流式文本 | 无 | useChat + streamText |
| 图片自动描述 | 无 | describeAction (GPT-5 Nano) |
| 生成参数 | 丰富（size, ratio, duration, seed...） | 简洁（model + prompt + instructions） |

---

## 6. 连线系统

### 6.1 super-app 原版

```typescript
// EditorView.tsx
onConnect → 创建普通 edge（无类型区分）
onEdgesChange → applyEdgeChanges + auto-save
// 没有 onConnectStart / onConnectEnd
// 没有 isValidConnection（无循环检测）
// 没有自定义 edge 类型
// 没有自定义 connectionLineComponent
```

### 6.2 tersa

```typescript
// canvas.tsx
edgeTypes: { animated, temporary }
connectionLineComponent: Connection (贝塞尔 + 圆点)

isValidConnection:
  - 自连接拒绝
  - 循环检测（DFS 从 target 出发）
  - 源节点类型检测（videoNode / dropNode 不能做 source）

onConnect → 创建 animated edge
onConnectStart → 清理 dropNode + temporary edge
onConnectEnd → 没连到 handle → 创建 dropNode + temporary edge
```

### 6.3 连线对比

| 特性 | super-app | tersa |
|---|---|---|
| Edge 类型 | 无区分 | animated (流动圆点) / temporary (虚线) |
| 连线预览 | 默认直线 | 自定义贝塞尔 + 末端圆点 |
| 循环检测 | 无 | DFS 检测 |
| 源节点限制 | 无 | video/drop 不能做 source |
| 拖线到空白 | 无 | 创建 dropNode + temporary edge |

---

## 7. 节点创建方式

### 7.1 super-app 原版

```
1. 左侧资产库拖入 → handleDrop → addNodeFromFiles/addNodeFromAsset
2. Ctrl+V 粘贴文件 → handlePaste → addNodeFromFiles
3. 添加文本按钮（工具栏） → addTextNode
```

### 7.2 tersa

```
1. 双击画布空白处 → 在位置创建 DropNode（cmdk 命令面板）
2. 从节点 handle 拖线到空白 → DropNode + temporary edge
3. 右键画布 → 添加节点 → DropNode
4. 拖拽文件到浏览器窗口 → NodeDropzoneProvider → 创建对应节点
5. 工具栏按钮（底部右侧） → 在视口中央创建节点
6. Ctrl+C/V 节点复制粘贴
7. Ctrl+D 节点原地复制
```

### 7.3 节点创建对比

| 特性 | super-app | tersa |
|---|---|---|
| 资产库拖入 | ✓ | ✗（直接用文件） |
| 画布文件拖放 | ✓（handleDrop） | ✓（NodeDropzone + 全屏覆盖层） |
| 双击创建 | ✗ | ✓（DropNode + cmdk） |
| 拖线创建 | ✗ | ✓（→ DropNode + temporary edge） |
| 右键创建 | ✗ | ✓ |
| 复制粘贴 | ✗ | ✓（Ctrl+C/V/D） |

---

## 8. 快捷键

### super-app 原版

```
Space → 临时切换到 Pan 模式
Delete/Backspace → 删除选中节点
Ctrl+V → 从系统剪贴板粘贴文件/文本
```

### tersa

```
Ctrl/Cmd+A  → 全选所有节点
Ctrl/Cmd+C  → 复制选中节点到内存
Ctrl/Cmd+V  → 粘贴节点（+200,+200 偏移）
Ctrl/Cmd+D  → 原地复制选中节点
Delete/Backspace → 删除选中节点
```

---

## 9. 持久化

### super-app — API 持久化

```
存储位置: PostgreSQL (通过 API)
触发方式: 每次 nodes/edges 变化后 debounce 800ms
序列化: JSON.stringify({ nodes, edges })
API: PATCH /canvas/projects/:id { data: { nodes, edges } }
加载: GET /canvas/projects/:id → ProjectDetailDto

优点: 多端同步、持久可靠
缺点: 有网络延迟、依赖后端
```

### tersa — localStorage

```
存储位置: localStorage (key: "tersa-canvas")
触发方式: 每次 nodes/edges 变化后 debounce 1000ms
序列化: JSON.stringify({ nodes, edges })
加载: 组件 mount 时 JSON.parse

优点: 零延迟、离线可用、零依赖
缺点: 单设备、存储空间有限、不同步
```

---

## 10. 样式系统

### super-app 原版

```css
/* 节点卡片 */
borderRadius: 12px
background: #1c1c1c
border: 1px solid #3a3a3a
boxShadow: 0 2px 8px rgba(0,0,0,0.25)

/* 标题在节点内或节点下方 */
```

### tersa

```css
/* 节点卡片 */
rounded-[28px]          /* 更大的圆角 */
ring-1 ring-border      /* 细边框 */
bg-card                 /* 卡片背景 */

/* 标题在节点上方 */
absolute -top-6         /* 浮在卡片上方 */
font-mono text-xs       /* 等宽小字 */
text-muted-foreground   /* 灰色 */

/* 工具栏 */
rounded-full            /* 药丸形状 */
border bg-card p-1.5    /* 紧凑内边距 */
position=Bottom         /* xyflow 内置定位 */
```

### 样式对比

| 特性 | super-app | tersa |
|---|---|---|
| 圆角 | 12px | 28px |
| 标题位置 | 节点内/下方 | 节点上方 -top-6 |
| 标题字体 | 普通 | font-mono |
| 工具栏形状 | 方形 | 药丸 (rounded-full) |
| 工具栏定位 | 手动计算 | @xyflow/react NodeToolbar |

---

## 11. 依赖库对比

| 库 | super-app | tersa | 用途 |
|---|---|---|---|
| @xyflow/react | ✓ | ✓ | 画布核心 |
| zustand | ✓ | ✗ | 状态管理 |
| jotai | ✗ | ✓ | 原子状态 |
| @tiptap/react | ✗ | ✓ | 富文本编辑器 |
| cmdk | ✗ | ✓ | 命令面板 |
| react-dropzone | ✗ | ✓ | 文件拖放 |
| react-hotkeys-hook | ✗ | ✓ | 键盘快捷键 |
| ai / @ai-sdk/react | ✗ | ✓ | Vercel AI SDK (流式文本) |
| @ai-sdk/gateway | ✗ | ✓ | 模型网关 |
| react-markdown | ✗ | ✓ | Markdown 渲染 |
| nanoid | ✗ | ✓ | ID 生成 |
| use-debounce | ✗ | ✓ | 防抖 |
| @vercel/blob | ✗ | ✓ | 文件存储 |

---

## 12. 核心设计哲学差异

| 维度 | super-app 原版 | tersa |
|---|---|---|
| **设计重心** | 资产库集成 + 丰富功能 | 纯画布 + AI 工作流 |
| **复杂度策略** | 功能丰富（分组、Pipeline、多种模态） | 极简（3 种节点、3 种操作） |
| **状态位置** | 全局 Store（可被任何组件访问） | 组件本地（scope 最小化） |
| **扩展方式** | 添加新节点类型 + Store 方法 | 复用 NodeLayout + 添加 transform/primitive |
| **AI 理念** | 集中式生成面板 | 每节点即 AI 单元（transform 模式） |
| **数据结构** | 强类型、字段多、与资产库耦合 | 极简、灵活、画布自治 |
| **代码量** | ~27 个 canvas 组件 | ~12 个核心文件 |

---

## 13. 当前迁移状态

已完成的 tersa 对齐：
- ✅ 数据模型（types.ts）— content/generated 双模
- ✅ NodeLayout 统一包装器
- ✅ TextNode (TipTap + 双模)
- ✅ ImageNode (dropzone + 双模)
- ✅ VideoNode (dropzone + 双模)
- ✅ DropNode (cmdk 命令面板)
- ✅ NodeToolbar (xyflow 内置)
- ✅ 右键菜单 (CanvasContextMenu + NodeLayout 内置)
- ✅ 连线系统 (AnimatedEdge + TemporaryEdge + ConnectionLine + 循环检测)
- ✅ 快捷键 (Ctrl+A/C/V/D)
- ✅ NodeOperationsProvider + NodeDropzoneProvider
- ✅ Zod schema 宽松验证（兼容新旧数据）
- ✅ EditorView 完全重写

已删除/备份的旧代码：
- ✅ 36 个旧文件 → .bak（MediaNode, DocNode, GroupNode, stores, hooks, Pipeline 等）

保留的 super-app 特性：
- 🔄 API 持久化（继承原有 useCanvasAutosave 模式）
- 🔄 资产库侧栏（暂时 .bak，可恢复）
- 🔄 Pipeline 系统（暂时 .bak，可恢复）

待决定：
- ❓ 是否恢复资产库侧栏集成
- ❓ 是否保留 Pipeline 视频流水线
- ❓ AI 生成后端：继续用 DashScope 还是引入 Gateway 模式
- ❓ 文本生成 API：需要新建 /canvas/generate-text 端点
- ❓ 是否需要分组功能（tersa 完全没有）
