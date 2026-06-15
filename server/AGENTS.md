# Server AGENTS.md

> **读者优先级：AI Agent > 人类开发者**
>
> 修改 `server/` 时先读本文件，架构细节见同目录 `ARCHITECTURE.md`。Monorepo 总览见根目录 `../AGENTS.md`。

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
| 对话意图 | `src/services/assistant-service.ts` | `src/routes/chat.ts` |
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
    │   └── assistant-service.ts
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
settings.getWorkspacePath | setWorkspacePath
workbench.summary
requirements.list | detail | create | update
requirements.addRepository | removeRepository
requirements.addPerson | removePerson
requirements.addMilestone | removeMilestone
requirements.addLink | removeLink
graph.get({ requirementId? })
repositories.list | detail | requirements | scanWorkspace | latestScan
people.list | create
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
| `repository-service` | `listRepositories`, `getRepositoryById`, `runWorkspaceScan`, `getLatestScanSnapshot` |
| `people-service` | `listPeople`, `createPerson` |
| `association-service` | `add/remove*` 系列, `getRepositoryRequirements`, `touchRequirement` |
| `graph-service` | `getRequirementGraph` |
| `assistant-service` | `resolveAssistantIntent` |

---

## 7. 编码约束

硬性约束见 **`.cursor/rules/server.mdc`** 与 **`.cursor/rules/project-core.mdc`**。

要点：

- ESM；相对 import **带 `.js` 后缀**
- JSON 列：`JSON.stringify` / `JSON.parse`
- `is_dirty`：INTEGER ↔ boolean
- 助手为**规则引擎**，非 LLM

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

### 9.4 修改扫描逻辑

1. `src/scanner/workspace-scanner.ts`
2. 必要时改 `repository-service.runWorkspaceScan`
3. 技术标签/env 脚本检测在 scanner 内

---

## 10. 本地开发

```bash
# 在 monorepo 根目录
pnpm dev          # 推荐：shared watch + server + client
pnpm --filter @project-manager/server dev   # 仅后端 tsx watch
pnpm --filter @project-manager/server build
pnpm start        # node dist/index.js（需先 build）
```

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
