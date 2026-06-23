# AGENTS.md

> **读者优先级：AI Agent > 人类开发者**
>
> Monorepo 入口文档。修改 **前端** 读 `client/AGENTS.md`；修改 **后端** 读 `server/AGENTS.md`；修改 **共享类型** 读 `shared/AGENTS.md`。
>
> Agent 控制层已接入。进入会修改代码的任务时，先读本文件，再按 `agents/README.md` 进入 S0-S5 工作流。

---

## 1. 项目一句话

本地 Web 应用「个人驾驶舱」：以**工作项**为中心，按工作域（开发/生活/学习等）管理个人工作；开发域关联 Git 仓库、协作人员、里程碑与外部链接；数据存 SQLite。

---

## 2. 文档映射（SSOT）

> 同一事实**只在一处定义**，其余文档**只引用**。冲突时优先级：代码 > 契约/types > 执行规范 > 机读任务/CI > 产品/规划文档。

### 2.1 权威映射表

| 职责 | 唯一来源 | 引用方（勿重复定义） |
|------|----------|----------------------|
| Agent 入口与跨包导航 | 本文件 | `CLAUDE.md`、`CODEX.md`、`agents/README.md` |
| Agent 工作流 S0–S5 | `agents/workflow.md` | `workflow-driven-requirements` Skill、各入口摘要 |
| 工程硬约束 | `agents/engineering-rules.md` | `.cursor/rules/project-core.mdc` |
| Scope / 目录 / 技术栈 | `agents/project-baseline.md` | `CODEX.md`、`engineering-rules.md` |
| 门禁与命令 | `agents/commands-checklist.md` | `workflow.md` §D、`start-project` Skill |
| 已知陷阱 | `agents/pitfalls.md` | 包级 AGENTS |
| 领域类型与协议 | `shared/src/types.ts` | `shared/ARCHITECTURE.md` |
| 工作域模型 | `shared/src/work-model.ts` | `PERSONAL_WORK_ARCHITECTURE.md` |
| 类型体系与 DB 对照 | `shared/ARCHITECTURE.md` | 根 `ARCHITECTURE.md` |
| tRPC 契约 | `server/src/trpc/router.ts` | `server/AGENTS.md` §5 |
| 数据库表结构 | `server/src/db/schema.ts` | `server/ARCHITECTURE.md` |
| 实现状态（计划 vs 代码） | `IMPLEMENTATION_STATUS.md` | 根 `ARCHITECTURE.md`、`AGENTS.md` §9 |
| 产品目标与领域语义 | `PROJECT_MANAGER_PRODUCT_DESIGN.md` | `PROJECT_MANAGER_PLATFORM_PLAN.md` |
| 分阶段技术方案 | `PROJECT_MANAGER_PLATFORM_PLAN.md` | `IMPLEMENTATION_STATUS.md` |
| 个人工作台产品需求 | `docs/个人工作台/个人工作台.md` | `待办知识库-RAG方案.md` |
| 个人工作台向外交付说明 | `docs/个人工作台/个人工作台-交付说明.md` | `个人工作台.md`、`个人工作台-功能点.md` |
| 个人工作台 L4 功能点与完成状态 | `docs/个人工作台/个人工作台-功能点.md` §实现状态总览 | `个人工作台-技术功能点.md`、`IMPLEMENTATION_STATUS.md` §13、`TODO/personal-workbench-enhancement.md` |
| 个人工作台 TL4 技术对照 | `docs/个人工作台/个人工作台-技术功能点.md` | `IMPLEMENTATION_STATUS.md` §13 |
| 工作项跨域演进设计 | `PERSONAL_WORK_ARCHITECTURE.md` | — |
| 未来待办索引 | `TODO/roadmap.md` | `TODO/*.md`（各文件职责见 roadmap §本目录文档映射） |
| 全栈集成架构 | `ARCHITECTURE.md` | 包级 `ARCHITECTURE.md` |
| 前端操作指南 | `client/AGENTS.md` | `client/ARCHITECTURE.md` |
| 后端操作指南 | `server/AGENTS.md` | `server/ARCHITECTURE.md` |
| 共享类型操作指南 | `shared/AGENTS.md` | `shared/ARCHITECTURE.md` |
| Cursor 硬性规则 | `.cursor/rules/*.mdc` | Skill、Plan |
| 本地 dev 启动 | `.cursor/skills/start-project/SKILL.md` | `README.md` |

### 2.2 文档地图（引用层）

| 包 | 操作指南 | 架构参考 |
|----|----------|----------|
| **Monorepo 根** | 本文件 | `ARCHITECTURE.md`、`PERSONAL_WORK_ARCHITECTURE.md` |
| **client/** | `client/AGENTS.md` | `client/ARCHITECTURE.md` |
| **server/** | `server/AGENTS.md` | `server/ARCHITECTURE.md` |
| **shared/** | `shared/AGENTS.md` | `shared/ARCHITECTURE.md` |

**Agent 控制层导航**：`agents/README.md` · **机读任务**：`agents/agent-orchestration.tasks.yaml`

**实现与规划对照**（以代码为准）：[IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md)

---

## 3. Monorepo 结构

```
project-manager/
├── AGENTS.md / ARCHITECTURE.md     ← 全栈入口
├── client/   AGENTS.md + ARCHITECTURE.md
├── server/   AGENTS.md + ARCHITECTURE.md
├── shared/   AGENTS.md + ARCHITECTURE.md
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
| 开发域工作项 | `RequirementsPage` / `RequirementDetailPage` | `requirement-service.ts` + `association-service.ts` | `Requirement*` 类型 |
| 个人工作台总览 | `PersonalWorkbenchPage` | `todo-service.ts` + `schedule-service.ts` | `PersonalWorkbenchSummary` |
| 待办与 AI 结果 | `TodoPanel` + `AiResultPanel` | `todo-service.ts` + `ai-result-service.ts` | `TodoItem`, `TodoAiResult` |
| 日程时间线 | `ScheduleTimeline` | `schedule-service.ts` | `ScheduleEvent`, `CalendarSource` |
| 定时任务 | `RecurringTaskPanel` | `recurring-task-service.ts` | `RecurringTask` |
| 周报生成 | `WeeklyReportPage` | `weekly-report-service.ts` | `WeeklyReport` |
| 仓库扫描/分支管理 | `ScanCenterPage` + `RepositoriesPage` | `scanner/workspace-scanner.ts` + `repository-service.ts` + `cursor-service.ts` | `RepositoryBranches`, `RepositoryBranchSyncResult` |
| 对话助手（开发/个人） | `ChatPanel` + `useNavigationAction` + `PersonalAssistantPanel` | `assistant-service.ts` + `personal-assistant-service.ts` + `routes/chat.ts` | `NavigationAction`, `PersonalAssistantResult` |
| 飞书快捷会话 | `PersonFeishuLink` + `client/src/utils/feishu.ts` | `feishu-service.ts`（服务层能力预留） | `shared/src/feishu.ts` |

---

## 5. 跨包数据流

```
server: router (Zod) → service (SQL / 规则) → shared 类型形状
client(dev): trpc.useQuery/useMutation → invalidate
client(personal): trpc + /api/chat(context=personal) → refresh 指令回流
关联 mutation: router 内 touchRequirement(requirementId)
对话: client POST /api/chat SSE ← server assistant-service / personal-assistant-service
```

---

## 6. 运行与验证

命令与 DoD 见 **[agents/commands-checklist.md](./agents/commands-checklist.md)**。本地 dev 见 **`start-project` Skill**。

| 服务 | 地址 |
|------|------|
| 前端 | http://localhost:5175 |
| 后端 | http://localhost:3100 |

**修改后最低验证**（细则见 `agents/commands-checklist.md` §本项目额外检查）：

1. `pnpm build` 无报错
2. 改 schema：删 `server/data/project-manager.db` 后重启
3. 改 tRPC：client `lib/trpc.ts` 类型与 router 一致

---

## 7. 跨包任务配方

### 7.1 新增需求字段

1. `shared/AGENTS.md` §7.1 — 从 `shared/src/types.ts` 开始
2. `server/src/db/schema.ts` + `requirement-service.ts` + `router.ts` Zod
3. `client` 相关页面
4. 删 DB 重启；`pnpm build`

### 7.2 新增端到端功能（API + UI）

1. server：service → router
2. client：Page + tRPC 调用 + invalidate
3. 可选：assistant 意图 + `NavigationAction`

### 7.3 新增对话导航

1. `shared/AGENTS.md` §7.3 — `NavigationActionType`
2. `server` — `assistant-service.ts`
3. `client` — `useNavigationAction.ts`

### 7.4 新增个人工作台能力（待办/日程/定时）

1. `shared/src/types.ts` 增补 `Todo* / Schedule* / Recurring*` 类型
2. `server/src/services` 实现 `todo/schedule/recurring/personal-assistant` 逻辑并在 `router.ts` 暴露
3. `client/src/components/personal-workbench/*` 接入查询与 mutation，补齐 invalidate

---

## 8. 提交信息规范

用户要求 commit 时：简体中文祈使句，格式 `AI: #<ID> <message>`；ID 从最近 commit 提取，否则 `000000`。

---

## 9. 方案 vs 实现

**唯一对照来源**：[IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md)（按阶段、页面、数据模型、扫描、对话、验收标准标注 ✅/⚠️/❌）。

新增功能前先查该文件，避免把已实现项写成规划或把 TODO 写成已上线。
