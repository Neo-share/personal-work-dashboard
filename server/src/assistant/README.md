# 个人助手五层底座（实现目录）

> **契约定义**：`shared/src/assistant-contract.ts`（F0 已冻结，2026-06-23）
>
> **设计说明**：`server/src/assistant/ARCHITECTURE.md` §3–§4
>
> **状态**：F1–F4 已落地（orchestrator + tools + context-retriever + MCP externalSnippets）。

## 目标文件

| 文件 | 职责 | 契约接口 | 状态 |
|------|------|----------|------|
| `intent-router.ts` | 规则型 NL → 意图 | `IntentRouter` | ✅ |
| `tool-registry.ts` | 工具注册与调用 | `ToolRegistry` | ✅ |
| `guardrail-engine.ts` | 四层护栏 | `GuardrailEngine` | ✅ |
| `context-retriever.ts` | 会话/待办上下文 | `ContextRetriever` | ✅ |
| `metrics-ledger.ts` | 指标记录与查询 | `MetricsLedger` | ✅ |
| `personal-orchestrator.ts` | 编排入口 | `PersonalOrchestrator` | ✅ |
| `tools/*.ts` | 各工具 execute 实现 | `ToolDefinition` | ✅ |

## 迁移原则

- `personal-assistant-service.ts` 保留薄封装，内部委托 `personal-orchestrator`
- 行为与黄金话术 11 条单测保持一致（见 `personal-assistant-golden.test.ts`）
- 护栏规则细则见 `TODO/guardrail-enhancement.md`
