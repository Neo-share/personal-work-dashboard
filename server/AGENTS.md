# Server AGENTS.md

> **读者优先级：AI Agent > 人类开发者**
>
> 修改 `server/` 时先读本文件，架构细节见同目录 `ARCHITECTURE.md`。文档索引见根目录 [../AGENTS.md](../AGENTS.md#2-文档索引)。

---

## 1. 包职责

`@project-manager/server`：本地 API 服务。提供 tRPC 业务接口、Git 工作区扫描、SQLite 持久化、规则型开发助手（SSE）、个人助手五层编排（SSE）、可选 LLM 待办 AI 结果生成。

**不负责**：React UI、Vite 代理（见 `../client/AGENTS.md`）。

---

## 2. 快速定位

| 目标 | 首选文件 | 次选文件 |
|------|----------|----------|
| 新增/修改 tRPC | `src/trpc/router.ts` | `src/services/*-service.ts` |
| 业务逻辑 | `src/services/*-service.ts` | — |
| 数据库表/字段 | `src/db/schema.ts` | service 内 `mapXxx()` |
| 轻量列迁移 | `src/db/index.ts` → `migrateSchema()` | — |
| 种子数据 | `src/db/seed.ts` | — |
| DB 连接与 settings KV | `src/db/index.ts` | — |
| 环境变量 | `src/load-env.ts` | `server/.env` |
| Git 扫描 | `src/scanner/workspace-scanner.ts` | `src/services/repository-service.ts` |
| 关系图谱数据 | `src/services/graph-service.ts` | — |
| 开发助手意图 | `src/services/assistant-service.ts` | `src/routes/chat.ts` |
| 个人助手入口 | `src/services/personal-assistant-service.ts` | `src/assistant/personal-orchestrator.ts` |
| 个人助手五层底座 | `src/assistant/` | `src/assistant/ARCHITECTURE.md` |
| 待办 AI 结果 | `src/services/ai-result-service.ts` | `src/llm/llm-ai-result-generator.ts` |
| 内部知识检索 | `src/services/internal-knowledge-retriever.ts` | — |
| LLM 配置与健康检查 | `src/llm/llm-config.ts` / `llm-health.ts` | `src/llm/openai-client.ts` |
| 助手 Soul 偏好 | `src/services/personal-assistant-soul-service.ts` | `personalWorkbench.setSoulSettings` |
| 定时任务调度 | `src/services/recurring-task-scheduler.ts` | `recurring-task-service.ts` |
| 待办/日程/定时任务 | `todo-service.ts` / `schedule-service.ts` / `recurring-task-service.ts` | `src/trpc/router.ts` |
| 飞书唤端 | `src/services/feishu-service.ts` | — |
| HTTP 入口/插件注册 | `src/index.ts` | — |
| SSE 路由 | `src/routes/chat.ts` | — |

---

## 3. 目录结构

```
server/
├── AGENTS.md
├── ARCHITECTURE.md
├── vitest.config.ts
├── data/                     运行时 SQLite（gitignore）
└── src/
    ├── index.ts              Fastify 入口 + 调度器启动
    ├── load-env.ts           加载 server/.env 或根 .env
    ├── trpc/
    │   ├── router.ts         appRouter（全部 procedures）
    │   └── context.ts        TrpcContext（当前空）
    ├── routes/
    │   └── chat.ts           POST /api/chat SSE
    ├── llm/
    │   ├── llm-config.ts     LLM_API_KEY 等环境变量
    │   ├── llm-health.ts     GET /health/llm 探测
    │   ├── openai-client.ts  OpenAI 兼容 HTTP 客户端
    │   ├── llm-ai-result-generator.ts  待办 AI HTML 生成/修订
    │   └── llm-title-extractor.ts      助手创建标题（可选 LLM）
    ├── assistant/            个人助手五层底座（详见 assistant/ARCHITECTURE.md）
    │   ├── personal-orchestrator.ts
    │   ├── intent-router.ts
    │   ├── tool-registry.ts
    │   ├── guardrail-engine.ts
    │   ├── context-retriever.ts
    │   ├── mcp-context-retriever.ts
    │   ├── metrics-ledger.ts
    │   ├── mcp/                飞书 MCP HTTP 桥接
    │   └── tools/              todo / schedule / recurring / mcp-feishu
    ├── services/
    │   ├── requirement-service.ts
    │   ├── repository-service.ts
    │   ├── people-service.ts
    │   ├── association-service.ts
    │   ├── graph-service.ts
    │   ├── weekly-report-service.ts
    │   ├── todo-service.ts
    │   ├── schedule-service.ts
    │   ├── recurring-task-service.ts
    │   ├── recurring-task-scheduler.ts
    │   ├── ai-result-service.ts
    │   ├── internal-knowledge-retriever.ts
    │   ├── assistant-session-service.ts
    │   ├── assistant-service.ts
    │   ├── personal-assistant-service.ts
    │   ├── personal-assistant-soul-service.ts
    │   ├── cursor-service.ts
    │   └── feishu-service.ts
    ├── scanner/
    │   └── workspace-scanner.ts
    ├── test/                 Vitest 辅助（setup、sse-parse、chat-test-server）
    └── db/
        ├── schema.ts         SCHEMA_SQL
        ├── seed.ts           seedDatabase
        └── index.ts          getDb, settings KV, migrateSchema
```

---

## 4. 数据流约定

```
router (Zod 校验) → service (业务 + SQL) → 返回 shared 类型形状
```

- Router **不含 SQL**
- 关联 mutation（add/remove Repository/Person/Milestone/Link）**必须**调用 `touchRequirement(requirementId)`
- DB snake_case → TS camelCase 在 service 的 `mapXxx()` 转换

**个人助手**（`context=personal`）：

```
routes/chat.ts → personal-assistant-service → personal-orchestrator
  → GuardrailEngine → IntentRouter → ToolRegistry → ContextRetriever → MetricsLedger
```

契约与分层细则见 `src/assistant/ARCHITECTURE.md`。

---

## 5. tRPC 命名空间速查

```
settings.getWorkspacePath | setWorkspacePath | getIgnoreDirs | setIgnoreDirs
workbench.summary
personalWorkbench.summary | getSoulSettings | setSoulSettings
weeklyReport.generate({ weekStart?, weekEnd?, domain? })
requirements.list | detail | create | update | delete
requirements.addRepository | removeRepository
requirements.addPerson | removePerson | addMilestone | removeMilestone | updateMilestone
requirements.addLink | removeLink
graph.get({ requirementId? })
repositories.list | detail | requirements | branches | setBranchNote | deleteBranch | syncBranches
repositories.scanWorkspace | latestScan | openInCursor
people.list | create | update | delete
todos.list | detail | create | update | complete | restore | cancel | delete
todos.aiResults | confirmAiResult | reviseAiResult
schedule.listDay | detail | createLocal | delete | sources | setSourceEnabled
recurringTasks.list | create | update | toggle | delete | materializeNow
assistant.sessions | todoThreads | messages | createSession | appendMessage | resolveIntent
```

完整 Zod input 见 `src/trpc/router.ts`；契约详述见 `ARCHITECTURE.md § API`。

**REST（非 tRPC）**：

| Method | Path | 说明 |
|--------|------|------|
| GET | `/health` | `{ ok: true, llmConfigured: boolean }` |
| GET | `/health/llm` | LLM 连通性探测（需配置 `LLM_API_KEY`） |
| POST | `/api/chat` | SSE 对话（`context=dev` \| `personal`） |

---

## 6. Service 职责

| Service | 核心函数 |
|---------|----------|
| `requirement-service` | `listRequirements`, `getRequirementDetailLive`, `createRequirement`, `updateRequirement`, `getWorkbenchSummary` |
| `repository-service` | `listRepositoriesLive`, `listRepositoryBranches`, `setRepositoryBranchNote`, `syncRepositoryBranches`, `runWorkspaceScan` |
| `cursor-service` | `openRepositoryInCursor` |
| `people-service` | `listPeople`, `createPerson`, `updatePerson`, `deletePerson` |
| `association-service` | `add/remove*` 系列, `getRepositoryRequirements`, `touchRequirement` |
| `graph-service` | `getRequirementGraph` |
| `weekly-report-service` | `generateWeeklyReport`, `resolveRequirementDocUrl` |
| `todo-service` | `listTodos`, `createTodo`, `confirmAiResult`, `getPersonalWorkbenchSummary` |
| `schedule-service` | `listDaySchedule`, `createLocalSchedule`, `setCalendarSourceEnabled` |
| `recurring-task-service` | `createRecurringTask`, `materializeRecurringTask`, `runDueRecurringTasks` |
| `recurring-task-scheduler` | `startRecurringTaskScheduler`（进程内 60s tick） |
| `ai-result-service` | `detectCapability`, `scheduleAiResultGeneration`, `createAiResultForTodo`, `reviseAiResult` |
| `internal-knowledge-retriever` | `retrieveForTodo`（规则检索日程/待办/AI 历史片段） |
| `assistant-session-service` | `listAssistantSessions`, `listTodoAiThreads`, `getAssistantMessages`, `appendAssistantMessage` |
| `assistant-service` | `resolveAssistantIntent`（开发域，规则引擎） |
| `personal-assistant-service` | `resolvePersonalAssistantIntent`（薄封装 → orchestrator） |
| `personal-assistant-soul-service` | `getPersonalAssistantSoulSettings`, `setPersonalAssistantSoulSettings` |
| `feishu-service` | `openPersonFeishuChat`, `resolvePersonFeishuOpenId` |

---

## 7. 编码约束

硬性约束见 **`.cursor/rules/server.mdc`**、**`.cursor/rules/project-core.mdc`** 与 **[agents/engineering-rules.md](../agents/engineering-rules.md)**。

**助手与 LLM 边界**：

- **开发助手**（`assistant-service`）：规则引擎，不调用 LLM
- **个人助手意图路由**（`assistant/intent-router`）：规则引擎，不调用 LLM
- **待办 AI 结果**（`ai-result-service` + `llm/`）：已配置 `LLM_API_KEY` 时走 LLM，否则规则模板兜底
- **标题提取**（`llm-title-extractor`）：可选 LLM，未配置时使用用户原话兜底

---

## 8. 已知陷阱

| 陷阱 | 说明 | 处理 |
|------|------|------|
| **无完整 migration** | 主路径 `CREATE TABLE IF NOT EXISTS`；`migrateSchema()` 仅补少数列 | 改 schema 后删 `data/` 或手动迁移 |
| **扫描范围** | 只扫 workspace **一级子目录**的 `.git`；跳过 `scan_ignore_dirs` | 不递归 monorepo 子应用 |
| **默认 workspace** | seed 硬编码 `/Users/ningliu/Documents/CodeLab` | 改 seed 或通过 settings |
| **LLM 可选** | 未配置 `LLM_API_KEY` 时 AI 结果用规则模板 | 见 `server/.env` 与 `/health/llm` |
| **MCP 可选** | 未配置 `FEISHU_MCP_HTTP_URL` 时外部片段为空 | 见交付说明 §9 |
| **pnpm start** | 仅 API，不含静态前端 | 生产需单独托管 client/dist |
| **AppRouter 被 client 引用** | 改 router 影响 client 类型 | 保持 procedure 命名稳定或同步改 client |

---

## 9. 常见任务

### 9.1 新增 tRPC 接口

1. 在 `src/services/*-service.ts` 实现
2. 在 `src/trpc/router.ts` 注册（Zod input + 调 service）
3. 关联 mutation 后 `touchRequirement`
4. 通知/同步改 `../client/` 消费端

### 9.2 新增数据库字段

1. `../shared/AGENTS.md` §7.1 — `../shared/src/types.ts`
2. `src/db/schema.ts` 加列（必要时在 `db/index.ts` 的 `migrateSchema` 补 ALTER）
3. service 改 SQL + `mapXxx`
4. router 改 Zod
5. 删 `data/project-manager.db` 重启 dev
6. 改 client 展示

### 9.3 新增开发域对话意图

编辑 `src/services/assistant-service.ts` → `resolveAssistantIntent()`：

- 返回 `{ reply, action? }`
- `action.type` 须为 `NavigationActionType`（`shared`）
- 同步改 client `useNavigationAction.ts`

### 9.4 新增个人助手意图/工具

1. 契约：`shared/src/assistant-contract.ts`（若新增 intent/tool 类型）
2. 意图：`src/assistant/intent-router.ts`
3. 工具：`src/assistant/tools/*.ts` + `register-tools.ts`
4. 映射：`src/assistant/personal-orchestrator.ts`
5. 护栏（若需）：`src/assistant/guardrail-engine.ts` 或 `TODO/guardrail-enhancement.md`
6. 同步改 `PersonalAssistantPanel.tsx` 的 refresh 消费逻辑

细则见 `src/assistant/ARCHITECTURE.md`。

### 9.5 修改扫描逻辑

1. `src/scanner/workspace-scanner.ts`
2. 必要时改 `repository-service.runWorkspaceScan`
3. 忽略目录来自 `settings.scan_ignore_dirs`（`getIgnoreDirs`）

### 9.6 配置 LLM

在 `server/.env`（或根 `.env`）设置：

```
LLM_API_KEY=...
LLM_API_BASE=https://api.openai.com/v1   # 可选
LLM_MODEL_SIMPLE=...                     # 简单档（标题/slot）
LLM_MODEL_COMPLEX=...                    # 复杂档（AI 初步生成）
LLM_MODEL_DIFFICULT=...                  # 困难档（AI 修订）
```

启动后访问 `GET /health/llm` 验证连通性。

---

## 10. 本地开发

见 **[`.cursor/skills/start-project/SKILL.md`](../.cursor/skills/start-project/SKILL.md)** 与 **[agents/commands-checklist.md](../agents/commands-checklist.md)**。

- 默认端口：**3100**（`process.env.PORT` 可覆盖）
- 数据库：`server/data/project-manager.db`
- 单测：`pnpm --filter @project-manager/server test`

---

## 11. 延伸阅读

| 文档 | 用途 |
|------|------|
| `server/ARCHITECTURE.md` | 分层、DB、API、扫描/图谱/助手/LLM 子系统 |
| `src/assistant/ARCHITECTURE.md` | 个人助手五层契约与实现 |
| `../client/AGENTS.md` | 前端消费与 UI 任务 |
| `../shared/AGENTS.md` | 领域类型与协议 |
| `../shared/ARCHITECTURE.md` | 类型体系详述 |
| `../ARCHITECTURE.md` | 全栈集成与 Monorepo 总览 |
