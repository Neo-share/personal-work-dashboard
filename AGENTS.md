# AGENTS.md

> **读者优先级：AI Agent > 人类开发者**
>
> Monorepo 入口文档。修改 **前端** 读 `client/AGENTS.md`；修改 **后端** 读 `server/AGENTS.md`；修改 **共享类型** 读 `shared/AGENTS.md`。
>
> Agent 控制层已接入。进入会修改代码的任务时，先读本文件，再按 `agents/README.md` 进入 S0-S5 工作流。

---

## 1. 项目一句话

本地 Web 应用「个人工作台」：待办、日程、定时任务与个人 AI 助手；数据存 SQLite。

---

## 2. 文档索引

### 2.1 文档对照表

| 职责 | 主文档 | 相关文档 |
|------|--------|----------|
| Agent 入口与跨包导航 | 本文件 | `CLAUDE.md`、`CODEX.md`、`agents/README.md` |
| Agent 工作流 S0–S5 | `agents/workflow.md` | `workflow-driven-requirements` Skill |
| 工程硬约束 | `agents/engineering-rules.md` | `.cursor/rules/project-core.mdc` |
| Scope / 目录 / 技术栈 | `agents/project-baseline.md` | `engineering-rules.md` |
| 门禁与命令 | `agents/commands-checklist.md` | `start-project` Skill |
| 已知陷阱 | `agents/pitfalls.md` | 包级 AGENTS |
| 领域类型与协议 | `shared/src/types.ts` | `shared/src/assistant-contract.ts` |
| tRPC 契约 | `server/src/trpc/router.ts` | `server/AGENTS.md` §5 |
| 数据库表结构 | `server/src/db/schema.ts` | `server/AGENTS.md` |
| 个人工作台产品需求 | `docs/个人工作台/个人工作台.md` | `待办知识库-RAG方案.md` |
| 个人工作台向外交付说明 | `docs/个人工作台/个人工作台-交付说明.md` | `个人工作台-功能点.md` |
| 个人工作台 HTML 交付包 | `docs/个人工作台/delivery/*.html` | `个人工作台-交付说明.md` |
| 个人工作台 L4 功能点与完成状态 | `docs/个人工作台/个人工作台-功能点.md` §实现状态总览 | `个人工作台-技术功能点.md` |
| 个人助手五层架构 | `server/src/assistant/ARCHITECTURE.md` | `assistant-contract.ts`、`TODO/guardrail-enhancement.md` |
| 个人工作台 TL4 技术对照 | `docs/个人工作台/个人工作台-技术功能点.md` | `个人工作台-功能点.md` |
| 未来待办索引 | `TODO/roadmap.md` | `TODO/*.md` |
| 前端操作指南 | `client/AGENTS.md` | — |
| 后端操作指南 | `server/AGENTS.md` | `server/src/assistant/ARCHITECTURE.md` |
| 共享类型操作指南 | `shared/AGENTS.md` | — |
| Cursor 硬性规则 | `.cursor/rules/*.mdc` | Skill |
| 本地 dev 启动 | `.cursor/skills/start-project/SKILL.md` | `README.md` |

### 2.2 文档地图

| 包 | 操作指南 |
|----|----------|
| **Monorepo 根** | 本文件 |
| **client/** | `client/AGENTS.md` |
| **server/** | `server/AGENTS.md` |
| **shared/** | `shared/AGENTS.md` |

**Agent 控制层导航**：`agents/README.md` · **机读任务**：`agents/agent-orchestration.tasks.yaml`

**实现状态**（以代码为准）：[个人工作台-功能点.md](./docs/个人工作台/个人工作台-功能点.md) §实现状态总览

---

## 3. Monorepo 结构

```
project-manager/
├── AGENTS.md
├── client/   AGENTS.md
├── server/   AGENTS.md
├── shared/   AGENTS.md
├── pnpm-workspace.yaml
└── package.json
```

**包依赖方向（禁止反向）**：

```
shared  ←  server
shared  ←  client
client  ──→  server/src/trpc/router（仅 AppRouter 类型引用）
```

---

## 4. 跨包快速定位

| 目标 | 前端 | 后端 | 共享 |
|------|------|------|------|
| 个人工作台总览 | `PersonalWorkbenchPage` | `todo-service.ts` + `schedule-service.ts` | `PersonalWorkbenchSummary` |
| 待办与 AI 结果 | `TodoPanel` + `AiResultPanel` | `todo-service.ts` + `ai-result-service.ts` | `TodoItem`, `TodoAiResult` |
| 日程时间线 | `ScheduleTimeline` | `schedule-service.ts` | `ScheduleEvent`, `CalendarSource` |
| 定时任务 | `RecurringTaskPanel` | `recurring-task-service.ts` | `RecurringTask` |
| 个人助手 | `PersonalAssistantPanel` | `personal-assistant-service.ts` + `routes/chat.ts` | `PersonalAssistantResult` |

---

## 5. 跨包数据流

```
server: router (Zod) → service (SQL / 规则) → shared 类型形状
client: trpc.useQuery/useMutation → invalidate
client: trpc + POST /api/chat → SSE refresh 指令回流
对话: client POST /api/chat SSE ← server personal-assistant-service
```

---

## 6. 运行与验证

命令与 DoD 见 **[agents/commands-checklist.md](./agents/commands-checklist.md)**。本地 dev 见 **`start-project` Skill**。

| 服务 | 地址 |
|------|------|
| 前端 | http://localhost:5175 |
| 后端 | http://localhost:3100 |

**修改后最低验证**：

1. `pnpm build` 无报错
2. 改 schema：删 `server/data/project-manager.db` 后重启
3. 改 tRPC：client `lib/trpc.ts` 类型与 router 一致

---

## 7. 跨包任务配方

### 7.1 新增端到端功能（API + UI）

1. server：service → router
2. client：组件 + tRPC 调用 + invalidate
3. 可选：个人助手意图 + SSE refresh

### 7.2 新增个人工作台能力（待办/日程/定时）

1. `shared/src/types.ts` 增补 `Todo* / Schedule* / Recurring*` 类型
2. `server/src/services` 实现逻辑并在 `router.ts` 暴露
3. `client/src/components/personal-workbench/*` 接入查询与 mutation，补齐 invalidate

---

## 8. 提交信息规范

用户要求 commit 时：简体中文祈使句，格式 `AI: #<ID> <message>`；ID 从最近 commit 提取，否则 `000000`。

---

## 9. 方案 vs 实现

个人工作台功能完成状态见 **[个人工作台-功能点.md](./docs/个人工作台/个人工作台-功能点.md)** §实现状态总览；以代码为准。
