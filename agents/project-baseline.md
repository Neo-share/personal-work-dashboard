# 项目 Baseline

> 技术栈、目录与 **Scope 映射**。

## 项目定位

本项目是本地 Web 应用「个人驾驶舱」。它以工作项为中心，管理个人工作域，并在开发域关联 Git 仓库、协作人员、里程碑和外部链接。数据存储在 SQLite。

## 技术栈

- Monorepo：pnpm workspace
- 语言：TypeScript strict
- 模块：ESM
- 前端：React 18、Vite、Ant Design 5、tRPC、TanStack Query
- 后端：Fastify、tRPC、better-sqlite3、simple-git、Zod
- 共享包：`@project-manager/shared`，提供领域类型与中文标签常量

## 目录映射

| 目录 | 包 | 职责 |
|---|---|---|
| `client/` | `@project-manager/client` | React SPA UI |
| `server/` | `@project-manager/server` | API、SQLite、扫描、对话助手 |
| `shared/` | `@project-manager/shared` | 前后端共享领域类型 |
| `agents/` | Agent 控制层 | S0-S5、任务编排、工程规则 |
| `ops/` | 控制层脚本 | scope 校验、门禁编排 |

## Scope 映射

| scope | 允许目录 |
|---|---|
| `web` | `client/` |
| `api` | `server/` |
| `backend` | `server/` |
| `contract` | `shared/` |
| `shared` | `shared/` |
| `all` | 全仓库 |

任何 scope 都允许修改控制层与项目级文档：`agents/`、`docs/`、`ops/`、`.github/workflows/`、`.cursor/rules/`、`.cursor/skills/workflow-driven-requirements/`、`AGENTS.md`、`CLAUDE.md`、`CODEX.md`、`ARCHITECTURE.md`、`package.json`、`pnpm-workspace.yaml`。

## 默认验证

见 **[commands-checklist.md](./commands-checklist.md)**。当前 `pnpm agent:gate` 绑定 `pnpm build`，构建顺序为 shared → server → client。
