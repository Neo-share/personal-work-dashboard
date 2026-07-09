# Server AGENTS.md

> **读者优先级：AI Agent > 人类开发者**
>
> 修改 `server/` 时先读本文件。架构细节见 `src/assistant/ARCHITECTURE.md`。文档索引见根目录 [../AGENTS.md](../AGENTS.md#2-文档索引)。

---

## 1. 包职责

`@project-manager/server`：本地 API 服务。提供个人工作台 tRPC、SQLite 持久化、个人助手五层编排（SSE）、可选 LLM 待办 AI 结果生成。

**不负责**：React UI、Vite 代理（见 `../client/AGENTS.md`）。

---

## 2. 快速定位

| 目标 | 首选文件 |
|------|----------|
| 新增/修改 tRPC | `src/trpc/router.ts` |
| 业务逻辑 | `src/services/*-service.ts` |
| 数据库表/字段 | `src/db/schema.ts` |
| 种子数据 | `src/db/seed.ts` |
| DB 连接与 settings KV | `src/db/index.ts` |
| 个人助手入口 | `src/services/personal-assistant-service.ts` |
| 个人助手五层底座 | `src/assistant/` |
| 待办 AI 结果 | `src/services/ai-result-service.ts` |
| SSE 路由 | `src/routes/chat.ts` |

---

## 3. 数据流约定

```
router (Zod 校验) → service (业务 + SQL) → 返回 shared 类型形状
```

个人助手链路：

```
routes/chat.ts → personal-assistant-service → personal-orchestrator
  → GuardrailEngine → IntentRouter → ToolRegistry → ContextRetriever → MetricsLedger
```

---

## 4. tRPC 命名空间速查

```
personalWorkbench.summary | getSoulSettings | setSoulSettings
todos.list | detail | create | update | complete | restore | cancel | delete
todos.aiResults | confirmAiResult | reviseAiResult
schedule.listDay | detail | createLocal | delete | sources | setSourceEnabled
recurringTasks.list | create | update | toggle | delete | materializeNow
assistant.sessions | todoThreads | messages | createSession | appendMessage | resolveIntent | metricsSummary
```

**REST**：`GET /health`、`GET /health/llm`、`POST /api/chat`（个人助手 SSE）

---

## 5. 编码约束

见 **`.cursor/rules/server.mdc`**、**`agents/engineering-rules.md`**。

- 个人助手意图路由为规则引擎，不直接调用 LLM
- 待办 AI 结果在配置 `LLM_API_KEY` 时走 LLM，否则规则模板兜底

---

## 6. 常见任务

### 6.1 新增 tRPC 接口

1. `src/services/*-service.ts` 实现
2. `src/trpc/router.ts` 注册
3. 同步 `../client/` 消费端

### 6.2 新增个人助手意图/工具

1. `shared/src/assistant-contract.ts`
2. `src/assistant/intent-router.ts` + `tools/*.ts`
3. `src/assistant/personal-orchestrator.ts`
4. 同步 client `handleRefresh`

细则见 `src/assistant/ARCHITECTURE.md`。

---

## 7. 本地开发

- 端口：**3100**
- 数据库：`server/data/project-manager.db`
- 单测：`pnpm --filter @project-manager/server test`
