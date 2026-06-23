# 个人助手五层架构

> 五层助手底座**接口契约**、目录规划与分阶段落地说明。
>
> - 实现目录索引：[README.md](./README.md)
> - 技术功能点对照：[个人工作台-技术功能点.md](../../../docs/个人工作台/个人工作台-技术功能点.md) §TL1-05 · §附录 C
> - 护栏**规则细则**（非接口）：[TODO/guardrail-enhancement.md](../../../TODO/guardrail-enhancement.md)
> - MCP 运行时配置与验收：[个人工作台-交付说明.md §9](../../../docs/个人工作台/个人工作台-交付说明.md#9-mcp-配置说明)
> - 实现状态：[IMPLEMENTATION_STATUS.md](../../../IMPLEMENTATION_STATUS.md) §13
>
> 状态：**F0 契约已冻结（2026-06-23）**；**F1–F4 已落地**。类型见 `shared/src/assistant-contract.ts`，实现目录见 §4。

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

**验收**：接口契约冻结；关键链路可观测；注入防护与动作白名单；MCP/Skill 可复用 ToolRegistry。

---

## 2. 现状与接入点

**当前个人助手链路**：

```text
POST /api/chat (context=personal)
  → personal-assistant-service.resolvePersonalAssistantIntent
  → PersonalOrchestrator.handle (personal-orchestrator.ts)
  → GuardrailEngine.checkInput / checkIntent / checkToolCall / checkOutput
  → IntentRouter.route (RuleBasedIntentRouter)
  → ToolRegistry.invoke (todo / schedule / recurring tools)
  → McpContextRetriever.retrieve (DB + 可选 externalSnippets)
  → MetricsLedger.record
  → SSE: text | refresh | modifyMode | blocked | error | done
```

**MCP 可选**：配置 `FEISHU_MCP_HTTP_URL` 后拉取 `externalSnippets`；未配置时自动降级为纯 DB 上下文（见交付说明 §9）。

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

四层护栏**检查项与失败动作**见 **[guardrail-enhancement.md §2](../../../TODO/guardrail-enhancement.md#2-四层护栏定义)**。本处定义编排层接口：

```typescript
interface GuardrailEngine {
  checkInput(message: string): GuardrailVerdict;
  checkIntent(route: IntentRouteResult): GuardrailVerdict;
  checkToolCall(tool: PersonalToolName, params: unknown): GuardrailVerdict;
  checkOutput(reply: string): GuardrailVerdict;
}
```

SSE 扩展事件：`{ type: 'blocked', code, message }`。

**F3+ 增强（2026-06，实现见 `guardrail-engine.ts`）**

| 项 | 说明 |
|----|------|
| 输入归一化 | `normalizeGuardrailText`：NFKC、去零宽字符、折叠空白 |
| 注入模式 | `INJECTION_PATTERNS`：指令覆盖、提示词提取、越狱、模板分隔符、XSS；中英双语 |
| 敏感动作 | `SENSITIVE_ACTION_PATTERNS`：删库/批量清空待办·日程·定时/SQL/`rm -rf` 等 |
| 输入层直拦 | 高风险敏感动作 `code: sensitive_action`，不依赖意图置信度 |
| 意图层二次 | 低置信度 + 敏感动作词 → `sensitive_action_low_confidence` |
| 可观测 | `pw.guardrail.blocked { layer, code }` |

验收场景与单测（13 条）：[guardrail-enhancement.md §5](../../../TODO/guardrail-enhancement.md#5-验收场景) · 向外交付摘要见 [个人工作台-交付说明.md §4.1](../../../docs/个人工作台/个人工作台-交付说明.md#41-个人助手四层护栏安全增强)。

### 3.4 ContextRetriever

```typescript
interface AssistantContext {
  sessionId: number;
  recentMessages: AssistantMessage[];
  activeTodo?: TodoItem;
  todayScheduleCount?: number;
  /** F4：MCP 外部文档片段 */
  externalSnippets?: Array<{ source: string; excerpt: string }>;
}
```

DB 内会话 + 可选待办由 `context-retriever.ts` 组装；外部片段由 `mcp-context-retriever.ts` 经 HTTP 桥接填充（配置见交付说明 §9）。

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
// pw.mcp.latency_ms / pw.mcp.fail { source, tool }
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
├── context-retriever.ts      DB 上下文组装
├── mcp-context-retriever.ts  DB + MCP externalSnippets
├── metrics-ledger.ts         记录与查询
├── personal-orchestrator.ts  编排入口
├── mcp/                      飞书 HTTP 桥接客户端
└── tools/
    ├── todo-tools.ts
    ├── schedule-tools.ts
    └── recurring-tools.ts
```

`personal-assistant-service.ts` 保留薄封装，内部委托 `personal-orchestrator`。

---

## 5. 分阶段落地

| 阶段 | 内容 | 状态 |
|------|------|------|
| **F0** | 接口冻结 → `shared/src/assistant-contract.ts` | ✅ |
| **F1** | MetricsLedger + ToolRegistry + tools 注册 | ✅ |
| **F2** | IntentRouter + personal-orchestrator 切换 | ✅ |
| **F3** | GuardrailEngine 四层 + SSE `blocked` | ✅ |
| **F4** | ContextRetriever.externalSnippets + MCP HTTP 桥接 | ✅（代码）；⚠️ 需配置 `FEISHU_MCP_HTTP_URL` 后验收 |

完成状态见 [个人工作台-功能点.md §实现状态总览](../../../docs/个人工作台/个人工作台-功能点.md#实现状态总览)。

---

## 6. 相关文档

| 文档 | 关系 |
|------|------|
| [guardrail-enhancement.md](../../../TODO/guardrail-enhancement.md) | GuardrailEngine **规则细则** |
| [test-coverage-validation-automation.md](../../../TODO/test-coverage-validation-automation.md) | 五层单测与 gate |
| [待办知识库-RAG方案.md](../../../docs/个人工作台/待办知识库-RAG方案.md) | 内部 RAG（E1–E3 ✅；E4 可选） |
| [个人工作台-交付说明.md §9](../../../docs/个人工作台/个人工作台-交付说明.md#9-mcp-配置说明) | MCP 配置与验收 |

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

## 8. 验收清单

- [x] 五层接口类型在 `shared/src/assistant-contract.ts` 冻结
- [x] 五层实现文件在 `server/src/assistant/` 落地
- [x] `/api/chat` 个人上下文走 orchestrator，行为与迁移前回归一致
- [x] 黄金话术 11 条自动化回归通过
- [x] 护栏拦截可 SSE `blocked` 且不落库（F3+：13 条单测覆盖 G1–G5 / G2b–G3c）
- [x] MetricsLedger 可查询最近一次请求的 intent + tools + latency
- [x] MCP 工具经 `McpContextRetriever` 注入，无需改 chat 路由（**F4**）

---

*F0–F4 已落地 · 2026-06-23*
