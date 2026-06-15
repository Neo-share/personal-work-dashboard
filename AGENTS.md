# AGENTS.md

> **读者优先级：AI Agent > 人类开发者**
>
> Monorepo 入口文档。修改 **前端** 读 `client/AGENTS.md`；修改 **后端** 读 `server/AGENTS.md`；修改 **共享类型** 读 `shared/AGENTS.md`。

---

## 1. 项目一句话

本地 Web 应用「个人驾驶舱」：以**工作项**为中心，按工作域（开发/生活/学习等）管理个人工作；开发域关联 Git 仓库、协作人员、里程碑与外部链接；数据存 SQLite。

---

## 2. 文档地图

| 包 | 操作指南 | 架构参考 |
|----|----------|----------|
| **Monorepo 根** | 本文件 | `ARCHITECTURE.md`、`PERSONAL_WORK_ARCHITECTURE.md` |
| **client/** | `client/AGENTS.md` | `client/ARCHITECTURE.md` |
| **server/** | `server/AGENTS.md` | `server/ARCHITECTURE.md` |
| **shared/** | `shared/AGENTS.md` | `shared/ARCHITECTURE.md` |

**硬性约束**：`.cursor/rules/`（`project-core.mdc` 全项目；`client.mdc` / `server.mdc` / `shared.mdc` 按目录）

**启动项目**：`.cursor/skills/start-project/SKILL.md`（用户要求启动 / 跑 dev 时加载）

**产品/规划**（方向参考，以代码为准）：

- [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) — **计划书 vs 代码对照（推荐先读）**
- `PROJECT_MANAGER_PRODUCT_DESIGN.md`
- `PROJECT_MANAGER_PLATFORM_PLAN.md`

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
| 需求 CRUD UI | `client/src/pages/*` | `server/src/services/requirement-service.ts` | `shared/src/types.ts`（见 `shared/AGENTS.md`） |
| 需求 API | — | `server/src/trpc/router.ts` | — |
| 关联编辑 | `RequirementDetailPage` | `association-service.ts` | — |
| Git 扫描 | `ScanCenterPage` | `scanner/workspace-scanner.ts` | — |
| 关系图谱 | `GraphPage` | `graph-service.ts` | `RequirementGraph` |
| 对话助手 | `ChatPanel` + `useNavigationAction` | `assistant-service.ts` + `routes/chat.ts` | `NavigationAction` |
| 中文标签 | `client/src/utils/labels.ts` | — | `REQUIREMENT_STATUS_LABELS` 等 |

---

## 5. 跨包数据流

```
server: router (Zod) → service (SQL) → shared 类型形状
client: trpc.useQuery/useMutation → invalidate
关联 mutation: router 内 touchRequirement(requirementId)
对话: client POST /api/chat SSE ← server assistant-service
```

---

## 6. 运行与验证

```bash
pnpm install
pnpm dev              # shared watch + server:3100 + client:5175
pnpm build            # shared → server → client
pnpm start            # 仅 server dist
```

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

---

## 8. 提交信息规范

用户要求 commit 时：简体中文祈使句，格式 `AI: #<ID> <message>`；ID 从最近 commit 提取，否则 `000000`。

---

## 9. 方案 vs 实现

完整对照表见 **[IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md)**（按阶段、页面、数据模型、扫描、对话、验收标准逐项标注 ✅/⚠️/❌）。

**当前主要缺口（摘要）**：

- 无 `projects` / `apps` / `dependencies` / `chat_sessions` 等表
- 需求 `update` API 有、UI 无；无需求删除
- 配置中心、`settings.setWorkspacePath` 持久化 UI 无
- `assistant-ui`、LLM、Zustand、DB migration 未实现
- 图谱只读；monorepo 子应用扫描未做
- 外部系统仅 links 存 URL，无 API/MCP

新增功能前先查 IMPLEMENTATION_STATUS，避免重复规划已实现项。
