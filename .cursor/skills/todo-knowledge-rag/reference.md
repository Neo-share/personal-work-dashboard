# RAG 参考（待办知识库）

> 附录；权威 SSOT 见 [待办知识库-RAG方案.md](../../docs/个人工作台/待办知识库-RAG方案.md)。

---

## KnowledgeSnippet 结构

```typescript
interface KnowledgeSnippet {
  id: string;              // 如 schedule_events:12、todo_ai_results:5
  sourceTable: 'schedule_events' | 'todo_ai_results' | 'todos' | 'assistant_messages';
  sourceId: number;
  label: string;           // UI/LLM 可读标签
  excerpt: string;         // 截断后正文，max 300 字符
}
```

定义：`server/src/services/internal-knowledge-retriever.ts`（尚未迁入 shared）

---

## retrieveForTodo API

```typescript
retrieveForTodo(todoId: number, options: {
  intent: 'generate' | 'revise';
  userDelta?: string;   // revise 时用户修改意见
  limit?: number;       // 默认 5
}): RetrieveForTodoResult
```

返回：`{ todoId, intent, resultType, snippets }`；todo 不存在时 `snippets=[]`。

---

## 按 resultType 的检索重点（产品层）

| 类型 | generate 内部检索重点 | 生成目标 |
|------|----------------------|----------|
| minutes | due ±1 天日程；历史 confirmed minutes | 进度 + 要点 + 结论 |
| review | 近 7 天已完成待办；历史 review | 统计卡片 + 结论 |
| audit | 同类型历史 audit；关键词待办 | 合规清单 |
| plan | 同类型历史 plan；方案类待办 | 背景 / 步骤 / 风险 |
| report / analysis / pick | 同类型历史；标题聚类 | 沿用产品 §6.3 形态 |

---

## LLM Prompt 约束

`llm-ai-result-generator.ts`：

- `buildContextBlock(snippets)` — 每条 `- [label] (id) excerpt`
- 系统 prompt：只输出 HTML 片段、优先采信内部资料、勿编造外链
- `MAX_TOKENS_BY_TYPE` 按 resultType 限制 completion
- Soul：`tone` + `customInstructions` 注入表达风格

---

## ai-result-service 关键函数

| 函数 | 职责 |
|------|------|
| `detectCapability(title, desc)` | canAuto + resultType（关键词规则） |
| `scheduleAiResultGeneration` | 延迟 1.5s 异步生成 |
| `createAiResultForTodo` | generate 主路径 |
| `reviseAiResult` | revise 主路径 |
| `resolveAiResultHtml` | retrieve → LLM → 降级 |
| `resolveRevisedAiResultHtml` | revise + 可选 revise-session-cache |
| `mergeExternalSnippetsIntoKnowledge` | MCP 片段转 KnowledgeSnippet 并前置 |
| `formatAiResultProvider` | provider 溯源字符串 |
| `buildReviseContextSummary` | 修订 SSE 用户可见摘要 |

---

## ContextRetriever（助手编排，非 Internal RAG）

```typescript
// shared/src/assistant-contract.ts
interface AssistantContext {
  sessionId: number;
  recentMessages: AssistantMessage[];
  activeTodo?: TodoItem;
  todayScheduleCount: number;
  soulSettings: PersonalAssistantSoulSettings;
  externalSnippets?: ExternalSnippet[];  // F4 MCP
}
```

| 实现 | 路径 |
|------|------|
| `DbContextRetriever` | `assistant/context-retriever.ts` — 近 20 条消息、activeTodo、当日日程数 |
| `McpContextRetriever` | `assistant/mcp-context-retriever.ts` — DB + 飞书 doc |

个人助手工具调用 **不** 直接走 `retrieveForTodo`；待办 AI 结果 **不** 依赖 ContextRetriever。

---

## 验收标准 K1–K5

| # | 场景 | 预期 |
|---|------|------|
| K1 | 当日有「产品需求评审」日程 + 创建「整理会议纪要」 | AI 要点含评审时段/标题（来自 schedule） |
| K2 | 「做会议纪要」已有 v1，修改「补充结论」 | v2 保留 v1 并追加；messages 有快照 |
| K3 | 定时物化「复盘」待办 | 召回近期已完成或同类 review |
| K4 | 检索 0 条 + LLM 失败 | 降级模板，待办仍可流转 |
| K5 | 全流程 | 除 LLM API 外无外部 HTTP（MCP 未配置） |

---

## Phase 交付清单

### E1 — 检索器骨架（已完成）

- [x] `internal-knowledge-retriever.ts`
- [x] `retrieveForTodo(todoId, intent)`
- [x] 单测：纪要召回日程 + 历史同类型

### E2 — 生成链路（已完成）

- [x] `llm-ai-result-generator.ts`
- [x] `createAiResultForTodo`：retrieve → generate → 落库
- [x] `provider` 记录 snippetIds

### E3 — 修订链路（已完成）

- [x] `reviseAiResult` 接入 retrieve(revise)
- [x] SSE / 摘要注明参考 vN 与日程

### E4 — embedding R1（未做）

- [ ] 本地 embedding + 增量索引
- [ ] 黄金场景 C1/C3/C4/C9 回归

---

## 检索演进路线（规划）

| 阶段 | 策略 |
|------|------|
| **R0**（当前） | 时间窗 + 关键词 + result_type 过滤 |
| **R1** | html_content / schedule.title 切块 + sidecar 向量 |
| **R2** | 硬过滤 + 向量 rerank |

索引更新时机（R1+）：待办 CRUD/确认 AI、日程写入、定时物化。

---

## 关键文件索引

```
server/src/services/internal-knowledge-retriever.ts
server/src/services/internal-knowledge-retriever.test.ts
server/src/services/ai-result-service.ts
server/src/services/ai-result-service.test.ts
server/src/llm/llm-ai-result-generator.ts
server/src/llm/revise-session-cache.ts
server/src/assistant/context-retriever.ts
server/src/assistant/mcp-context-retriever.ts
server/src/assistant/mcp/feishu-doc-client.ts
shared/src/assistant-contract.ts   ExternalSnippet, AssistantContext
docs/个人工作台/待办知识库-RAG方案.md
```
