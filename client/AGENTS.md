# Client AGENTS.md

> **读者优先级：AI Agent > 人类开发者**
>
> 修改 `client/` 时先读本文件，架构细节见同目录 `ARCHITECTURE.md`。Monorepo 总览与 SSOT 映射见根目录 [../AGENTS.md](../AGENTS.md#2-文档映射ssot)。

---

## 1. 包职责

`@project-manager/client`：React SPA「个人驾驶舱」UI。通过 tRPC 消费后端 API；通过 `POST /api/chat` SSE 驱动对话助手。

**不负责**：业务逻辑、SQLite、Git 扫描（见 `../server/AGENTS.md`）。

---

## 2. 快速定位

| 目标 | 首选文件 | 次选文件 |
|------|----------|----------|
| 新增页面 | `src/pages/XxxPage.tsx` | `src/App.tsx` |
| 修改导航/布局壳 | `src/App.tsx` | `src/styles/global.css` |
| 全局样式/主题 | `src/styles/global.css` | — |
| 列表/表格复用 | `src/components/RequirementList.tsx` | 各 Page |
| 开发助手 UI | `src/components/ChatPanel.tsx` | — |
| 个人工作台 | `src/pages/PersonalWorkbenchPage.tsx` | `src/components/personal-workbench/*` |
| 个人助手 UI | `src/components/personal-workbench/PersonalAssistantPanel.tsx` | `src/pages/PersonalWorkbenchPage.tsx` |
| 助手导航执行 | `src/hooks/useNavigationAction.ts` | — |
| 中文标签 | `src/utils/labels.ts` | `../shared/src/types.ts` |
| tRPC 客户端 | `src/lib/trpc.ts` | `src/main.tsx` |
| 关系图谱页 | `src/pages/GraphPage.tsx` | — |
| Vite/代理/别名 | `vite.config.ts` | `tsconfig.json` |

---

## 3. 目录结构

```
client/
├── AGENTS.md
├── ARCHITECTURE.md
├── index.html
├── vite.config.ts
├── tsconfig.json
└── src/
    ├── main.tsx              bootstrap + Provider 栈
    ├── App.tsx               路由 + 导航 + ChatPanel 挂载
    ├── lib/trpc.ts           createTRPCReact<AppRouter>
    ├── pages/                9 个页面（default export）
    ├── components/           ChatPanel, RequirementList, personal-workbench/*
    ├── hooks/                useNavigationAction
    ├── utils/labels.ts       中文标签 helper
    └── styles/global.css     全局 CSS 变量与布局 class
```

---

## 4. 路由与 tRPC 对照

| 路径 | 页面 | 主要 tRPC / API |
|------|------|-----------------|
| `/` | `PersonalWorkbenchPage` | `personalWorkbench.summary`, `todos.*`, `schedule.*`, `recurringTasks.*`, `assistant.*` |
| `/dev-dashboard` | `MyWorkbenchPage` | `workbench.summary` |
| `/requirements` | `RequirementsPage` | `requirements.list`, `create`；`?riskOnly=1`, `?keyword=` |
| `/requirements/:id` | `RequirementDetailPage` | `requirements.detail` + 关联 mutations |
| `/weekly-report` | `WeeklyReportPage` | `weeklyReport.generate` |
| `/graph` | `GraphPage` | `graph.get`；`?requirementId=` |
| `/repositories` | `RepositoriesPage` | `repositories.list`, `branches`, `setBranchNote`, `syncBranches`, `openInCursor` |
| `/people` | `PeoplePage` | `people.list`, `create`, `update`, `delete` |
| `/scan` | `ScanCenterPage` | `settings.get/set*`, `repositories.scanWorkspace`, `latestScan` |

全局：`ChatPanel` → `POST /api/chat`（SSE，非 tRPC）

---

## 5. 数据流约定

```
Page → trpc.namespace.procedure.useQuery / useMutation
     → httpBatchLink('/trpc') → Vite proxy → server:3100
mutation 成功 → trpc.useUtils() → utils.xxx.invalidate()
```

- 类型来自 `src/lib/trpc.ts`，**跨包引用** `../../../server/src/trpc/router` 的 `AppRouter`
- 领域展示类型用 `@project-manager/shared`

---

## 6. 编码约束

硬性约束见 **`.cursor/rules/client.mdc`**、**`.cursor/rules/project-core.mdc`** 与 **[agents/engineering-rules.md](../agents/engineering-rules.md)**（唯一来源，本处不重复）。

---

## 7. 已知陷阱

| 陷阱 | 说明 | 处理 |
|------|------|------|
| **AppRouter 跨包引用** | `lib/trpc.ts` 引 server 源码类型 | 改 server router 后 client 类型自动跟随；勿从 shared 导出 AppRouter |
| **双助手并存** | 开发域 `ChatPanel` 与个人域 `PersonalAssistantPanel` 走同一 `/api/chat` | 区分 `context=dev/personal`，避免串用数据流 |
| **个人域刷新依赖 refresh 指令** | 个人助手通过 SSE `refresh` 驱动 query 失效 | 新增助手能力时同步更新 refresh 目标与 invalidate |
| **对话非 LLM** | ChatPanel 展示规则引擎回复 | 勿在前端接 OpenAI，除非用户明确要求 |
| **生产部署** | `pnpm build` → `client/dist/` | 需静态服务器托管；API 走反向代理 |

---

## 8. 常见任务

### 8.1 新增页面

1. `src/pages/XxxPage.tsx`（default export）
2. `src/App.tsx` — `navItems` + `<Route>`
3. 需要助手跳转时 — 改 `shared` 的 `NavigationActionType`、`server` 的 `assistant-service.ts`、`useNavigationAction.ts`

### 8.2 接新 tRPC 接口

1. 确认 server 已暴露 procedure（见 `../server/AGENTS.md` § tRPC）
2. 页面内 `trpc.xxx.useQuery` / `useMutation`
3. mutation 后 `utils.xxx.invalidate()`

### 8.3 新增 URL 筛选

- 用 `useSearchParams`（参考 `RequirementsPage` 的 `riskOnly` / `keyword`）
- 助手筛选通过 `useNavigationAction` 的 `filterRequirements` 写入 searchParams

### 8.4 展示新需求字段

1. 按 `../shared/AGENTS.md` §7.1 更新类型，并同步 server
2. 改 `RequirementDetailPage` / `RequirementsPage` / `RequirementList`
3. `pnpm build`

### 8.5 新增个人工作台能力

1. 优先落在 `src/components/personal-workbench/*`
2. 接入 `trpc.todos/schedule/recurringTasks/personalWorkbench` 对应 procedure
3. mutation 成功后同步 invalidate `todos.list`、`schedule.listDay`、`recurringTasks.list`、`personalWorkbench.summary`

---

## 9. 本地开发

见 **[`.cursor/skills/start-project/SKILL.md`](../.cursor/skills/start-project/SKILL.md)** 与 **[agents/commands-checklist.md](../agents/commands-checklist.md)**。

- 开发地址：http://localhost:5175
- API 代理：`/trpc`、`/health`、`/api` → http://localhost:3100（`vite.config.ts`）

---

## 10. 延伸阅读

| 文档 | 用途 |
|------|------|
| `client/ARCHITECTURE.md` | Provider 栈、状态管理、Chat/Graph 子系统 |
| `../server/AGENTS.md` | API 与后端任务 |
| `../shared/AGENTS.md` | 领域类型变更与同步义务 |
| `../shared/ARCHITECTURE.md` | 类型体系与 DB 对照 |
| `../ARCHITECTURE.md` | 全栈集成与 Monorepo 总览 |
