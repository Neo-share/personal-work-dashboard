# Server ARCHITECTURE.md

> **读者优先级：AI Agent > 人类开发者**
>
> 后端架构说明。操作指南见 `AGENTS.md`；全栈视图见 `../ARCHITECTURE.md`。文档索引见 [../AGENTS.md §2](../AGENTS.md#2-文档索引)。

---

## 1. 在系统中的位置

```mermaid
flowchart TB
  Client[Client :5175]
  Fastify[Fastify :3100]
  TRPC[tRPC /trpc]
  Chat[POST /api/chat]
  Services[Service Layer]
  Assistant[assistant/ 五层编排]
  LLM[llm/ OpenAI 兼容]
  Scanner[workspace-scanner]
  DB[(SQLite)]

  Client -->|HTTP| Fastify
  Fastify --> TRPC --> Services --> DB
  Fastify --> Chat
  Chat -->|dev| Services
  Chat -->|personal| Assistant --> Services
  Services --> LLM
  Services --> Scanner
  Assistant --> DB
```

| 属性 | 值 |
|------|-----|
| 包名 | `@project-manager/server` |
| 运行时 | Node.js ESM |
| HTTP | Fastify 5 + `@fastify/cors` |
| API | tRPC 11 + Zod 3 |
| 持久化 | better-sqlite3 → `data/project-manager.db` |
| Git | simple-git |
| 单测 | Vitest 3 |

---

## 2. 启动序列

**入口**：`src/index.ts` → `main()`

1. `loadServerEnv()` — 加载 `server/.env` 或根 `.env`（存在则打印路径）
2. `getDb()` — 执行 `SCHEMA_SQL` + `migrateSchema()` + `seedDatabase()`
3. `Fastify({ logger: true })`
4. 注册 CORS（`origin: true`）
5. `fastifyTRPCPlugin` — prefix `/trpc`，router: `appRouter`，context: `createContext`
6. `registerChatRoutes` — `POST /api/chat`
7. `GET /health` → `{ ok: true, llmConfigured }`
8. `GET /health/llm` → `checkLlmHealth()`
9. `listen({ port: PORT ?? 3100, host: '0.0.0.0' })`
10. `startRecurringTaskScheduler()` — 定时任务到期物化（60s tick）

---

## 3. 分层架构

```
┌─────────────────────────────────────────┐
│  Transport                              │
│  index.ts | routes/chat.ts              │
│  trpc/router.ts (Zod + 薄路由)           │
├─────────────────────────────────────────┤
│  Domain Service                         │
│  requirement / repository / people        │
│  association / graph / todo / schedule    │
│  recurring / weekly-report / feishu     │
├─────────────────────────────────────────┤
│  Assistant & AI                         │
│  assistant/ (五层编排)                   │
│  assistant-service (开发域规则)          │
│  ai-result-service + internal-knowledge │
│  llm/ (可选 OpenAI 兼容)                 │
├─────────────────────────────────────────┤
│  Infrastructure                         │
│  db/ (schema, seed, getDb, migrate)     │
│  scanner/workspace-scanner              │
│  recurring-task-scheduler               │
└─────────────────────────────────────────┘
```

**Router 原则**：无 SQL；关联 mutation 后 `touchRequirement(requirementId)`。

**TrpcContext**（`trpc/context.ts`）：当前为空对象，预留扩展。

---

## 4. 请求链路

### 4.1 tRPC

```
POST /trpc/namespace.procedure
  → fastifyTRPCPlugin
  → appRouter procedure
  → *-service.ts
  → better-sqlite3
```

Zod 校验在 router；返回形状对齐 `@project-manager/shared` 类型。

### 4.2 对话 SSE

```
POST /api/chat  { message?, context?: 'dev' | 'personal', modifyTodoId?, sessionId? }
  → routes/chat.ts
  → dev: assistant-service.resolveAssistantIntent()（同步、规则）
  → personal: personal-assistant-service → personal-orchestrator（异步）
  → SSE 事件:
       { type: 'text', content: string }
       { type: 'action', action: NavigationAction }              # dev
       { type: 'refresh', refresh: PersonalAssistantRefresh[] }   # personal
       { type: 'modifyMode', modifyTodoId, modifyVersion }       # personal
       { type: 'blocked', code, message }                         # personal 护栏拦截
       { type: 'error', message }
       { type: 'done' }
```

按句号分块输出，块间 delay ~120ms。

---

## 5. 数据模型

### 5.1 ER 关系

```mermaid
erDiagram
  requirements ||--o{ requirement_repositories : has
  repositories ||--o{ requirement_repositories : linked
  requirements ||--o{ requirement_people : has
  people ||--o{ requirement_people : linked
  requirements ||--o{ milestones : has
  requirements ||--o{ links : has
  recurring_tasks ||--o{ todos : materialize
  todos ||--o{ todo_ai_results : has
  schedule_events ||--o{ schedule_event_sources : has
  assistant_sessions ||--o{ assistant_messages : has
```

### 5.2 表清单

| 表 | 用途 |
|----|------|
| `settings` | KV（`workspace_path`、`scan_ignore_dirs`、`personal_assistant_soul` 等） |
| `repositories` | Git 仓库资产快照 |
| `people` | 人员主数据（含 `feishu_open_id`） |
| `requirements` | 工作项主体（含 `domain` 工作域） |
| `requirement_repositories` | 工作项↔仓库 M:N |
| `requirement_people` | 工作项↔人员 M:N |
| `milestones` | 里程碑 |
| `links` | 外部链接 URL |
| `repository_branch_notes` | 分支备注 |
| `scan_snapshots` | 扫描历史 JSON |
| `requirement_status_history` | 工作项状态变更历史 |
| `todos` | 待办主体 |
| `todo_ai_results` | 待办 AI 结果版本（含 `provider`） |
| `schedule_events` + `schedule_event_sources` | 日程去重结果与来源明细 |
| `calendar_sources` | 日历来源开关 |
| `recurring_tasks` + `recurring_task_runs` | 定时任务与物化记录 |
| `assistant_sessions` + `assistant_messages` | 个人助手会话与消息 |

**Schema**：`src/db/schema.ts`（`SCHEMA_SQL` 常量）

**初始化**：`src/db/index.ts` → `getDb()`

**Migration**：无完整 migration 框架；`migrateSchema()` 对已有库补 `repositories.last_commit_at`、`people.feishu_open_id`、`requirements.domain` 等列

**Pragma**：`journal_mode=WAL`，`foreign_keys=ON`

### 5.3 命名映射

| SQLite | TypeScript |
|--------|------------|
| snake_case | camelCase（service `mapXxx`） |
| `is_dirty`, `is_urgent`, `enabled` 等 INTEGER | boolean |
| `tech_tags`, `env_scripts`, `payload` TEXT | JSON.parse |

**类型源**：`../shared/src/types.ts`（见 `../shared/ARCHITECTURE.md`）

### 5.4 核心枚举

```
RequirementStatus, Priority, CollaborationDirection, ManagementRole, WorkDomain
PersonCollaborationStatus, MilestoneStatus
GraphNodeType, NavigationActionType
TodoSource, TodoStatus, TodoAiStatus, AiResultType, CalendarSourceType, RecurringFrequency
PersonalIntentType, PersonalToolName（assistant-contract.ts）
```

---

## 6. API 契约

### 6.1 tRPC Router 树

```
appRouter
├── settings      get/setWorkspacePath, get/setIgnoreDirs
├── workbench     summary
├── personalWorkbench summary, getSoulSettings, setSoulSettings
├── weeklyReport  generate({ weekStart?, weekEnd?, domain? })
├── requirements  list, detail, create, update, delete,
│                 add/remove Repository/Person/Milestone/Link, updateMilestone
├── graph         get({ requirementId? })
├── repositories  list/detail/requirements/branches/setBranchNote
│                 deleteBranch/syncBranches/scanWorkspace/latestScan/openInCursor
├── people        list/create/update/delete
├── todos         list/detail/create/update/complete/restore/cancel/delete
│                 aiResults/confirmAiResult/reviseAiResult
├── schedule      listDay/detail/createLocal/delete/sources/setSourceEnabled
├── recurringTasks list/create/update/toggle/delete/materializeNow
└── assistant     sessions/todoThreads/messages/createSession/appendMessage/resolveIntent
```

实现与 Zod：`src/trpc/router.ts`

### 6.2 REST

| Method | Path | Response |
|--------|------|----------|
| GET | `/health` | `{ ok: true, llmConfigured: boolean }` |
| GET | `/health/llm` | `LlmHealthResult`（configured / ok / latencyMs / message） |
| POST | `/api/chat` | SSE stream |

---

## 7. Service 详述

| Service | 职责 |
|---------|------|
| `requirement-service` | 工作项 CRUD；`getRequirementDetailLive` JOIN 关联；`getWorkbenchSummary` 聚合；状态变更历史 |
| `repository-service` | 仓库 live 列表、分支查询/同步/删除、分支备注、扫描 UPSERT + 快照 |
| `cursor-service` | 仓库按分支切换并在 Cursor 中打开（Agent/Classic） |
| `people-service` | 人员 CRUD |
| `association-service` | 关联边 CRUD；`getRepositoryRequirements` 反查；`touchRequirement` |
| `graph-service` | `getRequirementGraph` 构建 nodes/edges |
| `weekly-report-service` | 周报区间聚合与 Markdown 输出（含飞书文档链接优先） |
| `todo-service` | 待办 CRUD、AI 状态流转、个人工作台统计 |
| `ai-result-service` | 能力判定、异步生成调度、LLM/模板 HTML、版本修订 |
| `internal-knowledge-retriever` | 待办相关内部片段规则检索（日程、历史 AI、会话消息） |
| `schedule-service` | 日程去重、来源开关、详情查询、本地日程写入 |
| `recurring-task-service` | 定时任务 CRUD、滚动物化待办、`runDueRecurringTasks` |
| `recurring-task-scheduler` | 进程内 interval 扫描到期任务并物化 |
| `assistant-session-service` | 助手会话、消息、`listTodoAiThreads` 待办 AI 线程 |
| `assistant-service` | 开发域助手：规则匹配 → reply + NavigationAction |
| `personal-assistant-service` | 薄封装，委托 `personal-orchestrator` |
| `personal-assistant-soul-service` | Soul 偏好（tone / customInstructions）读写 settings |
| `feishu-service` | 按 Open ID 唤起飞书客户端 deep link |

---

## 8. Git 扫描子系统

**链路**：`repositories.scanWorkspace` → `repository-service.runWorkspaceScan()` → `scanner/workspace-scanner.ts`

**算法**：

1. `workspacePath` = input 或 `settings.workspace_path`
2. 遍历 workspace **一级子目录**，跳过 `scan_ignore_dirs`（默认含 `node_modules`、`.cursor`、`.Trash`）
3. 含 `.git` → `scanRepository()`
4. `simple-git`：remote, branch, status, last commit
5. 读 `package.json` → `detectTechTags()` / `detectEnvScripts()`
6. UPSERT `repositories`；append `scan_snapshots`

**容错**：单仓失败不中断

**标签检测**（非穷尽）：Vue2/3, Vite, React, TypeScript, Vant, Element UI, View Design, ECharts, Sentry

---

## 9. 关系图谱子系统

**入口**：`graph.get` → `graph-service.getRequirementGraph(requirementId?)`

| 模式 | 行为 |
|------|------|
| 有 `requirementId` | 以该工作项为中心的局部图 |
| 无 | 全量总览图 |

**节点类型**：requirement, repository, person, milestone

Client 侧 ReactFlow 只读渲染；server 只提供 JSON 图数据。

---

## 10. 对话与个人助手子系统

### 10.1 开发域助手

**实现**：`assistant-service.ts` 规则引擎（非 LLM）

| 输出 | 说明 |
|------|------|
| `reply` | 中文回复 |
| `action?` | `NavigationAction`：`openWorkbench` / `openScanCenter` / `openGraph` / `openRequirementDetail` / `filterRequirements` |

### 10.2 个人域助手（五层编排）

详见 **`src/assistant/ARCHITECTURE.md`**

```text
POST /api/chat (context=personal)
  → personal-orchestrator.handle
  → GuardrailEngine (输入/意图/工具/输出)
  → RuleBasedIntentRouter
  → ToolRegistry (todo / schedule / recurring / mcp-feishu)
  → ContextRetriever + 可选 McpContextRetriever
  → MetricsLedger
```

**可选 MCP**：配置 `FEISHU_MCP_HTTP_URL` 后注入 `externalSnippets`；未配置时仅 DB 上下文。

**SSE 扩展**：护栏拦截返回 `{ type: 'blocked' }`，不落库副作用。

### 10.3 待办 AI 结果

**链路**：助手/手动创建待办 → `detectCapability` → `scheduleAiResultGeneration` → `createAiResultForTodo`

| 阶段 | 行为 |
|------|------|
| 能力判定 | 关键词映射 `AiResultType`；电话/线下等 → 不可自动 |
| 知识检索 | `internal-knowledge-retriever.retrieveForTodo` + 可选 MCP 片段 |
| 生成 | 已配置 LLM → `llm-ai-result-generator`；否则规则 HTML 模板 |
| Soul | `personal-assistant-soul-service` 影响语气与 customInstructions |
| 修订 | `reviseAiResult`：LLM 或模板 + 检索上下文 |

---

## 11. LLM 子系统

**目录**：`src/llm/`

| 模块 | 职责 |
|------|------|
| `llm-config` | 读取 `LLM_API_KEY`、`LLM_API_BASE`、`LLM_MODEL`、`LLM_TIMEOUT_MS` |
| `openai-client` | OpenAI 兼容 `chatCompletion` HTTP 客户端 |
| `llm-health` | `/health/llm` 极简 ping 探测 |
| `llm-ai-result-generator` | 待办 AI HTML 生成与多轮修订 prompt |
| `llm-title-extractor` | 个人助手创建待办/日程/定时任务时的标题压缩（可选） |

**降级策略**：未配置 API Key 时，AI 结果与标题均回退规则/原话路径，服务仍可运行。

---

## 12. 构建与配置

| 配置项 | 位置 | 默认 |
|--------|------|------|
| 端口 | `process.env.PORT` | 3100 |
| 环境文件 | `load-env.ts` 候选路径 | `server/.env`、根 `.env` |
| LLM | `LLM_API_KEY` 等 | 未配置则禁用 |
| MCP | `FEISHU_MCP_HTTP_URL` | 未配置则跳过外部片段 |
| 数据库 | `data/project-manager.db` | gitignore |
| workspace 路径 | `settings.workspace_path` | seed: `/Users/ningliu/Documents/CodeLab` |
| 扫描忽略目录 | `settings.scan_ignore_dirs` | `node_modules`, `.cursor`, `.Trash` |

**构建**：`tsc` → `dist/`；启动 `node dist/index.js`

**测试**：Vitest（`pnpm test` / `pnpm test:coverage`）；单测 DB 用 `initTestDb` / `resetTestDb`

---

## 13. 实现状态

**实现状态**：[../IMPLEMENTATION_STATUS.md](../IMPLEMENTATION_STATUS.md)。

---

## 14. 关键文件索引

```
src/index.ts
src/load-env.ts
src/trpc/router.ts
src/trpc/context.ts
src/routes/chat.ts
src/db/schema.ts
src/db/seed.ts
src/db/index.ts
src/scanner/workspace-scanner.ts
src/llm/llm-config.ts
src/llm/llm-health.ts
src/llm/openai-client.ts
src/llm/llm-ai-result-generator.ts
src/llm/llm-title-extractor.ts
src/assistant/personal-orchestrator.ts
src/assistant/intent-router.ts
src/assistant/tool-registry.ts
src/assistant/guardrail-engine.ts
src/assistant/context-retriever.ts
src/assistant/mcp-context-retriever.ts
src/assistant/metrics-ledger.ts
src/services/requirement-service.ts
src/services/repository-service.ts
src/services/people-service.ts
src/services/association-service.ts
src/services/graph-service.ts
src/services/weekly-report-service.ts
src/services/todo-service.ts
src/services/ai-result-service.ts
src/services/internal-knowledge-retriever.ts
src/services/schedule-service.ts
src/services/recurring-task-service.ts
src/services/recurring-task-scheduler.ts
src/services/assistant-session-service.ts
src/services/assistant-service.ts
src/services/personal-assistant-service.ts
src/services/personal-assistant-soul-service.ts
src/services/cursor-service.ts
src/services/feishu-service.ts
```

个人助手五层设计细则见 **`src/assistant/ARCHITECTURE.md`**。
