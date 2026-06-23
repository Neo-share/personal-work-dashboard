# Server AGENTS.md

> **读者优先级：AI Agent > 人类开发者**
>
> 修改 `server/` 时先读本文件，架构细节见同目录 `ARCHITECTURE.md`。Monorepo 总览与 SSOT 映射见根目录 [../AGENTS.md](../AGENTS.md#2-文档映射ssot)。

---

## 1. 包职责

`@project-manager/server`：本地 API 服务。提供 tRPC 业务接口、Git 工作区扫描、SQLite 持久化、规则型对话助手（SSE）。

**不负责**：React UI、Vite 代理（见 `../client/AGENTS.md`）。

---

## 2. 快速定位

| 目标 | 首选文件 | 次选文件 |
|------|----------|----------|
| 新增/修改 tRPC | `src/trpc/router.ts` | `src/services/*-service.ts` |
| 业务逻辑 | `src/services/*-service.ts` | — |
| 数据库表/字段 | `src/db/schema.ts` | service 内 `mapXxx()` |
| 种子数据 | `src/db/seed.ts` | — |
| DB 连接与 settings KV | `src/db/index.ts` | — |
| Git 扫描 | `src/scanner/workspace-scanner.ts` | `src/services/repository-service.ts` |
| 关系图谱数据 | `src/services/graph-service.ts` | — |
| 开发助手意图 | `src/services/assistant-service.ts` | `src/routes/chat.ts` |
| 个人助手意图 | `src/services/personal-assistant-service.ts` | `src/routes/chat.ts` |
| 待办/日程/定时任务 | `src/services/todo-service.ts` / `schedule-service.ts` / `recurring-task-service.ts` | `src/trpc/router.ts` |
| HTTP 入口/插件注册 | `src/index.ts` | — |
| SSE 路由 | `src/routes/chat.ts` | — |

---

## 3. 目录结构

```
server/
├── AGENTS.md
├── ARCHITECTURE.md
├── data/                     运行时 SQLite（gitignore）
└── src/
    ├── index.ts              Fastify 入口
    ├── trpc/
    │   ├── router.ts         appRouter（全部 procedures）
    │   └── context.ts        TrpcContext（当前空）
    ├── routes/
    │   └── chat.ts           POST /api/chat SSE
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
    │   ├── ai-result-service.ts
    │   ├── assistant-session-service.ts
    │   ├── assistant-service.ts
    │   ├── personal-assistant-service.ts
    │   ├── cursor-service.ts
    │   └── feishu-service.ts
    ├── scanner/
    │   └── workspace-scanner.ts
    └── db/
        ├── schema.ts         SCHEMA_SQL
        ├── seed.ts           seedDatabase
        └── index.ts          getDb, settings KV
```

---

## 4. 数据流约定

```
router (Zod 校验) → service (业务 + SQL) → 返回 shared 类型形状
```

- Router **不含 SQL**
- 关联 mutation（add/remove Repository/Person/Milestone/Link）**必须**调用 `touchRequirement(requirementId)`
- DB snake_case → TS camelCase 在 service 的 `mapXxx()` 转换

---

## 5. tRPC 命名空间速查

```
settings.getWorkspacePath | setWorkspacePath | getIgnoreDirs | setIgnoreDirs
workbench.summary
personalWorkbench.summary
weeklyReport.generate
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
assistant.sessions | messages | createSession | appendMessage | resolveIntent
```

完整 Zod input 见 `src/trpc/router.ts`；契约详述见 `ARCHITECTURE.md § API`。

**REST（非 tRPC）**：

| Method | Path | 说明 |
|--------|------|------|
| GET | `/health` | `{ ok: true }` |
| POST | `/api/chat` | SSE 对话 |

---

## 6. Service 职责

| Service | 核心函数 |
|---------|----------|
| `requirement-service` | `listRequirements`, `getRequirementDetail`, `createRequirement`, `updateRequirement`, `getWorkbenchSummary` |
| `repository-service` | `listRepositoriesLive`, `listRepositoryBranches`, `setRepositoryBranchNote`, `syncRepositoryBranches`, `runWorkspaceScan` |
| `cursor-service` | `openRepositoryInCursor` |
| `people-service` | `listPeople`, `createPerson`, `updatePerson`, `deletePerson` |
| `association-service` | `add/remove*` 系列, `getRepositoryRequirements`, `touchRequirement` |
| `graph-service` | `getRequirementGraph` |
| `weekly-report-service` | `generateWeeklyReport` |
| `todo-service` | `listTodos`, `createTodo`, `confirmAiResult`, `getPersonalWorkbenchSummary` |
| `schedule-service` | `listDaySchedule`, `createLocalSchedule`, `setCalendarSourceEnabled` |
| `recurring-task-service` | `createRecurringTask`, `materializeRecurringTask` |
| `assistant-session-service` | `listAssistantSessions`, `getAssistantMessages`, `appendAssistantMessage` |
| `assistant-service` | `resolveAssistantIntent`（开发域） |
| `personal-assistant-service` | `resolvePersonalAssistantIntent`（个人工作台） |

---

## 7. 编码约束

硬性约束见 **`.cursor/rules/server.mdc`**、**`.cursor/rules/project-core.mdc`** 与 **[agents/engineering-rules.md](../agents/engineering-rules.md)**（唯一来源，本处不重复）。

---

## 8. 已知陷阱

| 陷阱 | 说明 | 处理 |
|------|------|------|
| **无 DB migration** | 仅 `CREATE TABLE IF NOT EXISTS` | 改 schema 后删 `data/` 或手动迁移 |
| **扫描范围** | 只扫 workspace **一级子目录**的 `.git` | 不递归 monorepo 子应用 |
| **默认 workspace** | seed 硬编码 `/Users/ningliu/Documents/CodeLab` | 改 seed 或通过 settings |
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
2. `src/db/schema.ts` 加列
3. service 改 SQL + `mapXxx`
4. router 改 Zod
5. 删 `data/project-manager.db` 重启 dev
6. 改 client 展示

### 9.3 新增对话意图

编辑 `src/services/assistant-service.ts` → `resolveAssistantIntent()`：

- 返回 `{ reply, action? }`
- `action.type` 须为 `NavigationActionType`（`shared`）
- 同步改 client `useNavigationAction.ts`

### 9.4 新增个人助手意图

编辑 `src/services/personal-assistant-service.ts`：

- 返回 `{ reply, refresh?, modifyTodoId?, modifyVersion? }`
- 如新增刷新目标，同步更新 `shared` 的 `PersonalAssistantRefresh`
- 同步改 `client/src/components/personal-workbench/PersonalAssistantPanel.tsx` 的事件消费逻辑

### 9.5 修改扫描逻辑

1. `src/scanner/workspace-scanner.ts`
2. 必要时改 `repository-service.runWorkspaceScan`
3. 技术标签/env 脚本检测在 scanner 内

---

## 10. 本地开发

见 **[`.cursor/skills/start-project/SKILL.md`](../.cursor/skills/start-project/SKILL.md)** 与 **[agents/commands-checklist.md](../agents/commands-checklist.md)**。

- 默认端口：**3100**（`process.env.PORT` 可覆盖）
- 数据库：`server/data/project-manager.db`

---

## 11. 延伸阅读

| 文档 | 用途 |
|------|------|
| `server/ARCHITECTURE.md` | 分层、DB、API、扫描/图谱/助手子系统 |
| `../client/AGENTS.md` | 前端消费与 UI 任务 |
| `../shared/AGENTS.md` | 领域类型单一真相源 |
| `../shared/ARCHITECTURE.md` | 类型体系详述 |
| `../ARCHITECTURE.md` | 全栈集成与 Monorepo 总览 |
