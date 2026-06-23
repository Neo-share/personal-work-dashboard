# 架构底座待办

> **SSOT**：五层助手底座**接口契约**、目录规划与分阶段落地的唯一来源。
>
> - 索引与依赖：[roadmap.md](./roadmap.md)
> - 技术功能点对照：[个人工作台-技术功能点.md](../docs/个人工作台/个人工作台-技术功能点.md) §TL1-05 · §附录 C
> - 护栏**规则细则**（非接口）：[guardrail-enhancement.md](./guardrail-enhancement.md)
> - MCP 接入计划：[mcp-integration.md](./mcp-integration.md)
> - 实现状态：[IMPLEMENTATION_STATUS.md](../IMPLEMENTATION_STATUS.md)
>
> 状态：**F0 契约已冻结（2026-06-23）**；**F1–F3 已落地**；**F4（MCP 片段）待排期**。类型见 `shared/src/assistant-contract.ts`，实现目录见 §4。

---

## 1. 目标

沉淀可复用的五层能力，作为个人助手、`/api/chat`、MCP、Skill 与评估体系的统一底座：

| 层 | 职责 | 不负责 |
|---|---|---|
| **IntentRouter** | NL → 意图类型 + 结构化槽位 | 不直接写 DB |
| **ToolRegistry** | 注册/发现/调用副作用工具 | 不做 UI refresh |
| **GuardrailEngine** | 输入/意图/工具/输出四层护栏 | 不替代业务规则 |
| **ContextRetriever** | 会话、待办、日程等上下文组装 | 不调用外部 LLM |
| **MetricsLedger** | 时延、错误、调用次数、分桶统计 | 不做告警推送 |

**验收（实现阶段）**：接口契约冻结；关键链路可观测；注入防护与动作白名单；MCP/Skill 可复用 ToolRegistry。

---

## 2. 现状与接入点

**当前个人助手链路（F1–F3 已落地）**：

```text
POST /api/chat (context=personal)
  → personal-assistant-service.resolvePersonalAssistantIntent
  → PersonalOrchestrator.handle (personal-orchestrator.ts)
  → GuardrailEngine.checkInput / checkIntent / checkToolCall / checkOutput
  → IntentRouter.route (RuleBasedIntentRouter)
  → ToolRegistry.invoke (todo / schedule / recurring tools)
  → ContextRetriever.retrieve (DB 上下文)
  → MetricsLedger.record
  → SSE: text | refresh | modifyMode | blocked | error | done
```

**遗留**：`ContextRetriever.externalSnippets` 仍为空；MCP 接入见 F4 · [mcp-integration.md](./mcp-integration.md)。

---

## 3. 分层设计

### 3.1 IntentRouter

```typescript
/** F0 冻结 — 见 shared/src/assistant-contract.ts */
type PersonalIntentType =
  | 'schedule'
  | 'todo'
  | 'recurring'
  | 'recurring_schedule' // 重复周期 + 纯会议/例会 → 写日程，不建定时任务
  | 'revise_ai'
  | 'unknown';

interface IntentRouteContext {
  sessionId: number;
  modifyTodoId?: number;
}

interface IntentRouter {
  route(message: string, context: IntentRouteContext): IntentRouteResult;
}
```

**迁移策略**：将 `personal-assistant-service.ts` 内关键词表、`parseTimeFromText` 等迁入 `RuleBasedIntentRouter`（第一版仍规则，非 LLM）。

### 3.2 ToolRegistry

```typescript
type PersonalToolName =
  | 'todo.create'
  | 'todo.revise_ai'
  | 'schedule.create_local'
  | 'recurring.create'
  | 'recurring.materialize';

interface ToolDefinition<TParams, TResult> {
  name: PersonalToolName;
  description: string;
  paramsSchema: ZodType<TParams>;
  /** 白名单：仅允许已注册工具被 Intent 映射调用 */
  execute: (params: TParams, ctx: ToolContext) => Promise<TResult>;
}

interface ToolContext {
  sessionId: number;
  metrics: MetricsLedger;
}

interface ToolInvokeResult {
  tool: PersonalToolName;
  refresh?: PersonalAssistantRefresh[];
  payload?: unknown;
}
```

**映射表（意图 → 工具）**：

| Intent | Tools |
|--------|-------|
| `schedule` | `schedule.create_local` |
| `todo` | `todo.create`（内含能力判定 → AI） |
| `recurring` | `recurring.create` → `recurring.materialize` |
| `recurring_schedule` | `schedule.create_local` |
| `revise_ai` | `todo.revise_ai` |

### 3.3 GuardrailEngine

四层护栏**检查项与失败动作**见 **[guardrail-enhancement.md §2](./guardrail-enhancement.md#2-四层护栏定义)**（唯一来源）。本处仅定义编排层接口：

```typescript
interface GuardrailEngine {
  checkInput(message: string): GuardrailVerdict;
  checkIntent(route: IntentRouteResult): GuardrailVerdict;
  checkToolCall(tool: PersonalToolName, params: unknown): GuardrailVerdict;
  checkOutput(reply: string): GuardrailVerdict;
}
```

SSE 扩展事件：`{ type: 'blocked', code, message }`（个人工作台 Phase C 已预留）。

### 3.4 ContextRetriever

```typescript
interface AssistantContext {
  sessionId: number;
  recentMessages: AssistantMessage[];
  activeTodo?: TodoItem;
  todayScheduleCount?: number;
  /** 后续 MCP */
  externalSnippets?: Array<{ source: string; excerpt: string }>;
}
```

第一版仅组装 DB 内会话 + 可选待办。外部片段由 [mcp-integration.md](./mcp-integration.md) 填充 `externalSnippets`（接口字段定义见上）。

```typescript
interface ContextRetriever {
  retrieve(sessionId: number, options?: { modifyTodoId?: number }): AssistantContext;
}
```

### 3.5 MetricsLedger

```typescript
interface MetricEvent {
  name: string;
  ts: string;
  tags?: Record<string, string>;
  value?: number;
}

// 示例指标
// pw.intent.routed { type, confidence }
// pw.tool.invoked { tool, ok }
// pw.tool.latency_ms { tool }
// pw.guardrail.blocked { layer, code }
```

第一版：内存环形缓冲 + `server` 日志；第二版：可选落 SQLite `metric_events` 表或对接 Sentry。

```typescript
interface MetricsLedger {
  record(event: MetricEvent): void;
  queryRecent(filter?: { name?: string; limit?: number }): MetricEvent[];
}
```

### 3.6 编排入口

```typescript
interface PersonalOrchestratorInput {
  message: string;
  sessionId?: number;
  modifyTodoId?: number;
}

type PersonalOrchestratorOutput = PersonalAssistantResult | GuardrailBlocked;

interface PersonalOrchestrator {
  handle(input: PersonalOrchestratorInput): Promise<PersonalOrchestratorOutput>;
}
```

---

## 4. 目录与类型落库（F0 冻结）

**协议类型**：`shared/src/assistant-contract.ts`（client/server 可引用协议，不引用实现）

**实现目录**：

```text
server/src/assistant/
├── intent-router.ts          RuleBasedIntentRouter
├── tool-registry.ts          注册表 + invoke
├── guardrail-engine.ts       四层检查
├── context-retriever.ts      上下文组装
├── metrics-ledger.ts         记录与查询
├── personal-orchestrator.ts  编排入口（替代 resolvePersonalAssistantIntent 单体）
└── tools/
    ├── todo-tools.ts
    ├── schedule-tools.ts
    └── recurring-tools.ts
```

`personal-assistant-service.ts` 保留薄封装，内部委托 `personal-orchestrator`，避免一次性大重构。

---

## 5. 分阶段落地

| 阶段 | 内容 | 依赖 | 状态 |
|------|------|------|------|
| **F0** | 接口冻结 → `shared/src/assistant-contract.ts` | — | ✅ |
| **F1** | MetricsLedger + ToolRegistry + tools 注册 | F0 | ✅ |
| **F2** | IntentRouter + personal-orchestrator 切换 | F1 | ✅ |
| **F3** | GuardrailEngine 四层 + SSE `blocked` | F2 | ✅ |
| **F4** | ContextRetriever.externalSnippets + MCP | mcp-integration | ❌ |

个人工作台 **不阻塞于 F4**；F1–F3 已完成，行为见 [个人工作台-技术功能点.md §实现状态总览](../docs/个人工作台/个人工作台-技术功能点.md#实现状态总览)。

---

## 6. 与相关待办关系

| 文档 | 关系 |
|------|------|
| [personal-workbench-enhancement.md](./personal-workbench-enhancement.md) | 未完成 Phase E；完成状态见 [技术功能点 §实现状态总览](../docs/个人工作台/个人工作台-技术功能点.md#实现状态总览) |
| [guardrail-enhancement.md](./guardrail-enhancement.md) | GuardrailEngine **规则细则** |
| [mcp-integration.md](./mcp-integration.md) | ContextRetriever 外部片段 |
| [test-coverage-validation-automation.md](./test-coverage-validation-automation.md) | F0 契约冻结后，以 §3 接口为准编写单测与 gate；T1 框架可与 F0 并行 |

---

## 7. F0 评审记录（2026-06-23）

| # | 议题 | 决议 |
|---|------|------|
| R1 | `PersonalIntentType` 是否含 `recurring_schedule` | **新增**（重复周期 + 纯会议 → 日程） |
| R2 | 契约类型落库 | **shared/src/assistant-contract.ts** + server/src/assistant/ 实现 |
| R3 | 编排入口 | **PersonalOrchestrator.handle(input)** → Result \| GuardrailBlocked |
| R4 | IntentRouter / GuardrailEngine / MetricsLedger | 补全方法签名（见 §3 与 assistant-contract.ts） |
| R5 | 黄金话术行为基准 | 产品 §6.4 + `personal-assistant-golden.test.ts` 11 条 |

---

## 8. 验收清单（实现阶段勾选）

- [x] 五层接口类型在 `shared/src/assistant-contract.ts` 冻结
- [x] 五层实现文件在 `server/src/assistant/` 落地（F1–F2：orchestrator + tools + context-retriever）
- [x] `/api/chat` 个人上下文走 orchestrator，行为与迁移前回归一致
- [x] 黄金话术 11 条自动化回归通过
- [x] 护栏拦截可 SSE `blocked` 且不落库
- [x] MetricsLedger 可查询最近一次请求的 intent + tools + latency
- [ ] MCP tool 可通过 ToolRegistry 注册，无需改 chat 路由（**F4**）

---

*F0–F3 已落地 · 2026-06-23 · 下一步 F4（MCP externalSnippets）*
