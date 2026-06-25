---
name: todo-knowledge-rag
description: >-
  个人工作台待办知识库 RAG 方案与实现指南：internal-knowledge-retriever 规则检索、
  LLM 生成/修订链路、降级策略、ContextRetriever 与 MCP 外部片段边界。
  在改待办 AI 生成、多轮修订、检索策略、snippet 溯源、RAG 验收时使用。
  用户提及 RAG、知识库、检索、retrieveForTodo、AI 结果生成/修订时加载。
---

# 待办知识库 RAG

本 Skill 抽象个人工作台 **内部 RAG 闭环**（检索 → 生成/修订 → 版本回溯），供 Agent 改 server 侧 AI 链路前对齐边界。

**权威文档（按需深读）**：

| 文档 | 用途 |
|------|------|
| [待办知识库-RAG方案.md](../../docs/个人工作台/待办知识库-RAG方案.md) | 范围、分阶段、验收 K1–K5 |
| [server/src/assistant/ARCHITECTURE.md §3.4](../../server/src/assistant/ARCHITECTURE.md) | ContextRetriever 契约（助手编排） |
| [个人工作台.md §7](../../docs/个人工作台/个人工作台.md) | 产品触发条件 |

---

## 1. 两套「检索」勿混淆

| 体系 | 入口 | 用途 | 消费者 |
|------|------|------|--------|
| **Internal RAG** | `retrieveForTodo(todoId, { intent })` | 待办 AI 生成/修订的知识片段 | `ai-result-service` → `llm-ai-result-generator` |
| **ContextRetriever** | `mcpContextRetriever.retrieve(sessionId, opts)` | 个人助手编排上下文（会话、待办、日程统计） | `personal-orchestrator` |

Internal RAG 是 **待办 AI 结果** 的主链路；ContextRetriever 是 **助手对话** 的上下文组装。MCP 外部片段（F4）可 **叠加** 到 Internal RAG，不替代内部检索。

---

## 2. 闭环定义

数据写入、检索、生成、版本回溯均在个人工作台 SQLite 内完成：

```
createTodo / materializeRecurringTask (canAuto=true)
  → scheduleAiResultGeneration
  → retrieveForTodo(generate) [+ 可选 MCP external]
  → generateAiResultWithLlm / generateAiHtml 降级
  → todo_ai_results INSERT (provider 含 snippetIds)

reviseAiResult / 修改模式
  → retrieveForTodo(revise, userDelta) [+ 可选 MCP external]
  → reviseAiResultWithLlm / applyRevisionRules 降级
  → version+1, assistant_messages 快照
```

**降级铁律**：LLM 不可用或检索 0 条时，仍须能完成待办流转（规则模板 / 关键词修订）。

---

## 3. 纳入范围（仅 2 条链路）

| 链路 | 触发 | 检索重点 |
|------|------|----------|
| **P0 初步生成** | 待办创建 / 定时物化 / canAuto=true | 按 `AiResultType` 召回日程、历史 AI、已完成待办等 |
| **P0 多轮修订** | `reviseAiResult` / 修改模式 | 当前 todo 全部 AI 版本 + 助手线程 + 日程 + userDelta |

---

## 4. 明确不做

| 能力 | 原因 |
|------|------|
| NL 意图分流 RAG | 继续规则 / 轻量意图 |
| 飞书/外部文档作为 **内部 RAG 替代** | F4 MCP 仅叠加 ExternalSnippet |
| 周报段落 / 开发域需求问答 | 跨工作台边界 |
| Soul 向量库 / 全库语义搜索 UI | 范围外 |
| **E4 embedding（R1）** | 规划中，当前仅 R0 规则检索 |

---

## 5. 内部知识源（SQLite）

| 表 | 检索用途 |
|----|----------|
| `schedule_events` + `schedule_event_sources` | 纪要类：due_at ±1 天日程 |
| `todo_ai_results` | 同类型历史结果；修订时当前 todo 全版本 |
| `todos` | 近 7 天已完成；标题关键词 LIKE |
| `assistant_messages` | 修订：绑定 todo 的会话线程 |
| `assistant_sessions` | todo_id 关联 |

**不纳入**：`requirements`、`links`、扫描快照、开发域助手会话。

---

## 6. R0 检索策略（当前实现）

实现：`server/src/services/internal-knowledge-retriever.ts`

| resultType | generate 召回顺序 |
|------------|-------------------|
| `minutes` | 日程窗 → 同类型历史 AI |
| `review` | 近 7 天已完成待办 → 同类型历史 AI |
| `audit` / `plan` / `report` / `analysis` / `pick` | 同类型历史 AI → 标题关键词待办 |
| 无类型 | 标题关键词待办 |

| intent | 额外逻辑 |
|--------|----------|
| `revise` | 当前 todo AI 全版本 → 助手线程 → 日程 → userDelta 片段 |

**硬参数**：

- 默认 `limit=5` 片段
- 单片段 `excerpt` 上限 300 字符
- 日程窗：`due_at ±1 天`（无 due_at 则以当前时间为锚）
- 标题停用词：`完成`、`整理`、`待办` 等（见源码 `TITLE_STOP_WORDS`）

---

## 7. 生成与溯源

| 模块 | 路径 |
|------|------|
| 检索 | `server/src/services/internal-knowledge-retriever.ts` |
| 编排 | `server/src/services/ai-result-service.ts` |
| LLM | `server/src/llm/llm-ai-result-generator.ts` |
| MCP 合并 | `mergeExternalSnippetsIntoKnowledge()` |

**provider 字段**（`todo_ai_results.provider`）：

| 值 | 含义 |
|----|------|
| `rule-template` | LLM 未配置或失败，规则 HTML |
| `llm` | LLM 生成，无 snippet |
| `llm-rag:id1,id2` | LLM + 内部/MCP 片段 |
| `llm-cache` / `llm-cache-rag:...` | 修订会话缓存命中 |

修订 SSE 文案：`buildReviseContextSummary()` → 「已参考 vN 与日程上下文」等。

---

## 8. MCP 外部片段（F4，可选）

- 配置 `FEISHU_MCP_HTTP_URL` 后，`McpContextRetriever` 从用户消息解析飞书 doc 链接
- 创建待办时 `pendingExternalSnippets` 暂存，异步生成时 `mergeExternalSnippetsIntoKnowledge` 置于片段前列
- **未配置 MCP**：纯 Internal RAG，主链路不受影响

详见 [个人工作台-交付说明 §9](../../docs/个人工作台/个人工作台-交付说明.md)。

---

## 9. 任务决策树

```
改什么？
├── 新 resultType 检索策略     → internal-knowledge-retriever retrieveForGenerate switch
├── 调整召回规则/窗/上限       → internal-knowledge-retriever 常量与 SQL
├── 改 LLM prompt/结构         → llm-ai-result-generator RESULT_TYPE_HINTS
├── 改降级/异步/scheduling     → ai-result-service
├── 改 provider 溯源格式       → formatAiResultProvider / formatReviseCacheProvider
├── 叠加外部文档               → mcp-context-retriever + mergeExternalSnippetsIntoKnowledge
└── 助手会话上下文（非 AI 结果）→ context-retriever / personal-orchestrator
```

步骤与测试模板见 [examples.md](examples.md)；验收 K1–K5、Phase 清单见 [reference.md](reference.md)。

---

## 10. 验证清单

1. `pnpm --filter @project-manager/server test` — 含 `internal-knowledge-retriever.test.ts`
2. 纪要场景：同日日程 + 历史 minutes 能被召回（K1）
3. 修订场景：v1 + userDelta → v2，provider 含 snippetIds（K2）
4. LLM 关闭 / 检索 0 条：仍降级模板，待办可完成（K4）
5. 全流程除 LLM API 外无外部 HTTP（K5，MCP 未配置时）

改 schema 涉及知识源表：删 `server/data/project-manager.db` 重启。

---

## 11. 分阶段状态

| Phase | 内容 | 状态 |
|-------|------|------|
| E1 | 检索器骨架 + R0 API + 单测 | 已完成 |
| E2 | generate 链路 retrieve → LLM → provider | 已完成 |
| E3 | revise 链路 + SSE 上下文摘要 | 已完成 |
| E4 | 本地 embedding + 混合检索 | 未做 |

R1/R2 演进策略见 RAG 方案 §6，实现前须更新方案文档。
