# Client AGENTS.md

> **读者优先级：AI Agent > 人类开发者**
>
> 修改 `client/` 时先读本文件。文档索引见根目录 [../AGENTS.md](../AGENTS.md#2-文档索引)。

---

## 1. 包职责

`@project-manager/client`：React SPA「个人工作台」UI。通过 tRPC 消费后端 API；通过 `POST /api/chat` SSE 驱动个人助手。

---

## 2. 快速定位

| 目标 | 首选文件 |
|------|----------|
| 页面入口 | `src/pages/PersonalWorkbenchPage.tsx` |
| 路由 | `src/App.tsx` |
| 个人工作台组件 | `src/components/personal-workbench/*` |
| 样式 | `src/styles/personal-workbench.css` |
| invalidate 契约 | `src/utils/personal-workbench-invalidate.ts` |
| tRPC 客户端 | `src/lib/trpc.ts` |

---

## 3. 路由与 tRPC

| 路径 | 页面 | 主要 tRPC / API |
|------|------|-----------------|
| `/` | `PersonalWorkbenchPage` | `personalWorkbench.*`, `todos.*`, `schedule.*`, `recurringTasks.*`, `assistant.*` |
| 其它 | — | 重定向至 `/` |

**助手**：`PersonalAssistantPanel` → `POST /api/chat` → SSE `text` / `refresh` / `modifyMode` / `blocked` / `done`

---

## 4. 数据流

```
Page → trpc.*.useQuery/useMutation → Vite proxy → server:3100
mutation 成功 → trpc.useUtils() → invalidate
个人助手 SSE refresh → PersonalWorkbenchPage.handleRefresh
```

---

## 5. 常见任务

### 5.1 新增个人工作台能力

1. 组件落在 `src/components/personal-workbench/*`
2. 接入对应 tRPC procedure
3. mutation 后 invalidate；助手触发时更新 `handleRefresh`

---

## 6. 本地开发

- 地址：http://localhost:5175
- 代理：`/trpc`、`/health`、`/api` → http://localhost:3100
