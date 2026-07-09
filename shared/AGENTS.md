# Shared AGENTS.md

> **读者优先级：AI Agent > 人类开发者**
>
> 修改 `shared/` 时先读本文件。文档索引见根目录 [../AGENTS.md](../AGENTS.md#2-文档索引)。

---

## 1. 包职责

`@project-manager/shared`：前后端共享的个人工作台领域类型与个人助手契约。

**负责**：`Todo*`、`Schedule*`、`Recurring*`、`PersonalWorkbench*`、`assistant-contract.ts`、中文标签常量、飞书 deep link helper。

**不负责**：SQL、API 路由、UI、AppRouter（在 `server/src/trpc/router.ts`）。

---

## 2. 快速定位

| 目标 | 文件 |
|------|------|
| 领域类型 | `src/types.ts` |
| 个人助手契约 | `src/assistant-contract.ts` |
| 刷新目标映射 | `src/personal-workbench-refresh.ts` |
| 飞书 helper | `src/feishu.ts` |
| 导出入口 | `src/index.ts` |

---

## 3. 同步义务

改 `shared` 后同步 `server`（schema + service + router Zod）与 `client`（展示/表单）。

`PersonalAssistantRefresh` 变更须同步 `PersonalWorkbenchPage.handleRefresh`。

---

## 4. 常见任务

### 4.1 新增个人工作台字段

1. `src/types.ts`
2. `server/src/db/schema.ts` + service + router
3. `client` 展示
4. `pnpm build`

### 4.2 扩展个人助手能力

1. `src/assistant-contract.ts`
2. `server/src/assistant/*`
3. 若新增 refresh 目标，扩展 `PersonalAssistantRefresh`

---

## 5. 本地开发

`pnpm --filter @project-manager/shared build`（client/server 读 `dist/`）
