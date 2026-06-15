# Server ARCHITECTURE.md

> **读者优先级：AI Agent > 人类开发者**
>
> 后端架构参考。操作指南见 `AGENTS.md`；全栈视图见 `../ARCHITECTURE.md`。

---

## 1. 在系统中的位置

```mermaid
flowchart TB
  Client[Client :5175]
  Fastify[Fastify :3100]
  TRPC[tRPC /trpc]
  Chat[POST /api/chat]
  Services[Service Layer]
  Scanner[workspace-scanner]
  DB[(SQLite)]

  Client -->|HTTP| Fastify
  Fastify --> TRPC --> Services --> DB
  Fastify --> Chat --> Services
  Services --> Scanner
```

| 属性 | 值 |
|------|-----|
| 包名 | `@project-manager/server` |
| 运行时 | Node.js ESM |
| HTTP | Fastify 5 + `@fastify/cors` |
| API | tRPC 11 + Zod 3 |
| 持久化 | better-sqlite3 → `data/project-manager.db` |
| Git | simple-git |

---

## 2. 启动序列

**入口**：`src/index.ts` → `main()`

1. `getDb()` — 执行 `SCHEMA_SQL` + `seedDatabase()`
2. `Fastify({ logger: true })`
3. 注册 CORS（`origin: true`）
4. `fastifyTRPCPlugin` — prefix `/trpc`，router: `appRouter`，context: `createContext`
5. `registerChatRoutes` — `POST /api/chat`
6. `GET /health` → `{ ok: true }`
7. `listen({ port: PORT ?? 3100, host: '0.0.0.0' })`

---

## 3. 分层架构

```
┌─────────────────────────────────────────┐
│  Transport                              │
│  index.ts | routes/chat.ts              │
│  trpc/router.ts (Zod + 薄路由)           │
├─────────────────────────────────────────┤
│  Service                                │
│  requirement / repository / people      │
│  association / graph / assistant        │
├─────────────────────────────────────────┤
│  Infrastructure                         │
│  db/ (schema, seed, getDb)              │
│  scanner/workspace-scanner              │
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
POST /api/chat  { message?: string }
  → routes/chat.ts
  → assistant-service.resolveAssistantIntent()
  → SSE:
       { type: 'text', content: string }
       { type: 'action', action: NavigationAction }
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
```

### 5.2 表清单

| 表 | 用途 |
|----|------|
| `settings` | KV（`workspace_path` 等） |
| `repositories` | Git 仓库资产快照 |
| `people` | 人员主数据 |
| `requirements` | 需求主体 |
| `requirement_repositories` | 需求↔仓库 M:N |
| `requirement_people` | 需求↔人员 M:N |
| `milestones` | 里程碑 |
| `links` | 外部链接 URL |
| `scan_snapshots` | 扫描历史 JSON |

**Schema**：`src/db/schema.ts`（`SCHEMA_SQL` 常量）

**初始化**：`src/db/index.ts` → `getDb()`

**Migration**：❌ 未实现

**Pragma**：`journal_mode=WAL`，`foreign_keys=ON`

### 5.3 命名映射

| SQLite | TypeScript |
|--------|------------|
| snake_case | camelCase（service `mapXxx`） |
| `is_dirty` INTEGER | boolean |
| `tech_tags`, `env_scripts`, `payload` TEXT | JSON.parse |

**类型源**：`../shared/src/types.ts`（见 `../shared/ARCHITECTURE.md`）

### 5.4 核心枚举

```
RequirementStatus, Priority, CollaborationDirection, ManagementRole
PersonCollaborationStatus, MilestoneStatus
GraphNodeType, NavigationActionType
```

---

## 6. API 契约

### 6.1 tRPC Router 树

```
appRouter
├── settings      getWorkspacePath, setWorkspacePath
├── workbench     summary
├── requirements  list, detail, create, update,
│                 add/remove Repository/Person/Milestone/Link
├── graph         get({ requirementId? })
├── repositories  list, detail, requirements, scanWorkspace, latestScan
└── people        list, create
```

实现与 Zod：`src/trpc/router.ts`

### 6.2 REST

| Method | Path | Response |
|--------|------|----------|
| GET | `/health` | `{ ok: true }` |
| POST | `/api/chat` | SSE stream |

---

## 7. Service 详述

| Service | 职责 |
|---------|------|
| `requirement-service` | 需求 CRUD；`getRequirementDetail` JOIN 关联；`getWorkbenchSummary` 聚合 |
| `repository-service` | 仓库列表/详情；`runWorkspaceScan` 事务 UPSERT + 快照 |
| `people-service` | 人员 list/create |
| `association-service` | 关联边 CRUD；`getRepositoryRequirements` 反查；`touchRequirement` |
| `graph-service` | `getRequirementGraph` 构建 nodes/edges |
| `assistant-service` | `resolveAssistantIntent` 规则匹配 → reply + NavigationAction |

---

## 8. Git 扫描子系统

**链路**：`repositories.scanWorkspace` → `repository-service.runWorkspaceScan()` → `scanner/workspace-scanner.ts`

**算法**：

1. `workspacePath` = input 或 `settings.workspace_path`
2. 遍历 workspace **一级子目录**
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
| 有 `requirementId` | 以该需求为中心的局部图 |
| 无 | 全量总览图 |

**节点类型**：requirement, repository, person, milestone

Client 侧 ReactFlow 只读渲染；server 只提供 JSON 图数据。

---

## 10. 对话助手子系统

**实现**：规则引擎（非 LLM）

| 关键词 | NavigationAction |
|--------|------------------|
| 工作台/首页 | `openWorkbench` |
| 扫描/仓库扫描 | `openScanCenter` |
| 关系图/图谱/上下游 | `openGraph`（可带 requirementId） |
| 打开/查看/进入 + 详情 | `openRequirementDetail` |
| 风险 | `filterRequirements({ riskOnly: true })` |
| 提测/上线/开发中/并行 + 仓库名 | `filterRequirements({ keyword })` |
| 匹配需求名称 | `openRequirementDetail` |

**未实现**：LLM、`chat_sessions` 持久化

---

## 11. 构建与配置

| 配置项 | 位置 | 默认 |
|--------|------|------|
| 端口 | `process.env.PORT` | 3100 |
| 数据库 | `data/project-manager.db` | gitignore |
| workspace 路径 | `settings.workspace_path` | seed: `/Users/ningliu/Documents/CodeLab` |

**构建**：`tsc` → `dist/`；启动 `node dist/index.js`

**无** `.env`、ESLint、Vitest

---

## 12. 已实现 vs 规划

完整对照见 **[../IMPLEMENTATION_STATUS.md](../IMPLEMENTATION_STATUS.md)**。

| 能力 | 状态 |
|------|------|
| 需求 CRUD + 关联 | ⚠️ update API 有，client UI 缺 |
| Git 扫描 | ⚠️ 一级目录 |
| 规则对话助手 | ⚠️ MVP |
| 关系图谱 API | ✅ 只读 |
| projects / apps / dependencies | ❌ |
| chat_sessions | ❌ |
| DB migration | ❌ |
| LLM | ❌ |
| 外部系统 API | ❌ |

---

## 13. 关键文件索引

```
src/index.ts
src/trpc/router.ts
src/trpc/context.ts
src/routes/chat.ts
src/db/schema.ts
src/db/seed.ts
src/db/index.ts
src/scanner/workspace-scanner.ts
src/services/requirement-service.ts
src/services/repository-service.ts
src/services/people-service.ts
src/services/association-service.ts
src/services/graph-service.ts
src/services/assistant-service.ts
```
