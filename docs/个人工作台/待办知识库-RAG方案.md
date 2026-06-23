# 个人工作台 · 待办知识库（RAG）方案

> **SSOT**：个人工作台 RAG 能力的**规划定义**（后续迭代）。产品主需求见 [个人工作台.md](./个人工作台.md)；实现状态见 [IMPLEMENTATION_STATUS.md](../../IMPLEMENTATION_STATUS.md)。

---

## 1. 为什么要做

当前待办 AI 初步结果与多轮修改均为 **固定 HTML 模板**，与用户真实上下文无关。  
工作台 SQLite 里已有可检索的结构化 + 半结构化数据，可在 **不接入外部系统** 的前提下，让 AI 生成/修订「有依据」的结果。

**闭环定义**：数据写入、索引、检索、生成、版本回溯均在个人工作台链路内完成；用户不离开 `/personal-workbench` 即可验收。

---

## 2. 纳入范围（仅 2 条高价值链路）

### 2.1 待办 AI 初步结果生成（P0）

**触发**：待办创建 / 定时任务物化 / 手动添加后 `canAuto=true`（同 `个人工作台.md` §7.1）。

**检索 → 生成**：根据待办标题、截止时间、来源，从内部知识库召回片段，再调用 LLM 产出结构化 HTML。

| 结果类型 | 内部检索重点 | 生成目标 |
|----------|--------------|----------|
| minutes（纪要） | 截止日前后 **日程块**（标题、时段、来源标签）；同主题 **历史已确认纪要** | 进度 + 要点 + 结论 |
| review（复盘） | 同周期 **已完成待办**；同标题前缀历史 **review 结果** | 统计卡片 + 结论 |
| audit（审核） | 同关键词历史 **audit 清单**；关联待办描述 | 合规清单 |
| plan（方案） | 同域历史 **plan**；未完成待办中的方案类条目 | 背景 / 步骤 / 风险 |
| report / analysis / pick | 同类型历史 AI 结果；相关待办标题聚类 | 沿用 §6.3 形态 |

**典型闭环场景**：

1. 用户说「会后整理会议纪要」→ 创建待办  
2. RAG 召回当日「产品需求评审」日程 + 上次「做会议纪要」已确认 v2  
3. 生成纪要 HTML，带来源脚注（内部 docId，非外链）

### 2.2 AI 结果多轮修改（P0）

**触发**：个人助手修改模式 + `reviseAiResult`（`个人工作台.md` §7.2）。

**检索 → 修订**：

- 当前待办 **全部 `todo_ai_results` 版本**
- 绑定 `todo_id` 的 **`assistant_messages` 线程**
- 可选：同 `ai_result_type` 的 **其他待办优秀片段**（few-shot 风格参考）

**典型闭环场景**：

1. 待办「做会议纪要」已有 v1  
2. 用户输入「补充结论：排期推迟一周」  
3. RAG 召回 v1 全文 + 最近 5 条对话 + 当日相关日程  
4. 写入 v2，会话快照含 `ai_result_id`

---

## 3. 内部知识源（仅 SQLite）

| 表 | 索引内容 | 用途 |
|----|----------|------|
| `todos` | title, description, due_at, source, status, ai_result_type | 主题匹配、时间窗过滤、完成态参考 |
| `todo_ai_results` | html_content 切块, result_type, version, status | 历史结果、修改基线、同类型范例 |
| `assistant_messages` | content, role, ai_result_id | 多轮修改上下文 |
| `schedule_events` + `schedule_event_sources` | title, start_at, end_at, source | 纪要类待办的「会议发生了什么」 |
| `recurring_tasks` + `recurring_task_runs` | title, todo_description, trigger_at | 定时任务来源说明、物化历史 |
| `assistant_sessions` | todo_id 绑定 | 线程与待办关联 |

**不纳入**：`requirements`、`links`、扫描快照、开发域助手会话。

---

## 4. 明确不做（本轮）

| 能力 | 原因 |
|------|------|
| NL 意图分流 RAG | 分类问题，继续规则 / 轻量意图模型 |
| 飞书 / 外部文档 MCP | 非内部 RAG 闭环；运行时 F4 见 [个人工作台-交付说明.md §9](./个人工作台-交付说明.md#9-mcp-配置说明) |
| 周报文档段落填充 | 依赖需求 links 与外链 |
| 开发域需求问答 | 跨工作台边界 |
| Soul 偏好向量库 | 体量小，后续 prompt 注入即可 |
| 全库语义搜索 UI | 非考题验收项，避免范围膨胀 |

---

## 5. 架构落点

对齐 [server/src/assistant/ARCHITECTURE.md §3.4](../../server/src/assistant/ARCHITECTURE.md#34-contextretriever) 中的 **ContextRetriever**，第一版仅实现 **InternalTodoKnowledgeRetriever**：

```text
createTodo / materializeRecurringTask
  → detectCapability (canAuto)
  → InternalTodoKnowledgeRetriever.retrieve(todo, intent: 'generate')
  → LlmAiResultGenerator.generate(type, snippets)
  → todo_ai_results INSERT

reviseAiResult / 修改模式
  → InternalTodoKnowledgeRetriever.retrieve(todo, intent: 'revise', userDelta)
  → LlmAiResultGenerator.revise(...)
  → version +1, assistant_messages 快照
```

**降级**：LLM 不可用或检索 0 条时，回退现有 `generateAiHtml` 模板。

---

## 6. 检索策略（内部闭环可实现）

分阶段，避免一上来依赖向量服务：

| 阶段 | 策略 | 说明 |
|------|------|------|
| **R0** | 规则检索 | 时间窗（due_at ±1 天）+ 标题关键词 + result_type 过滤 |
| **R1** | 本地 embedding | 对 `todo_ai_results.html_content`、`schedule_events.title` 切块；SQLite 或 sidecar 向量表 |
| **R2** | 混合检索 | 时间/类型硬过滤 + 向量 rerank |

索引更新时机：

- 待办 CRUD / 完成 / 确认 AI → 更新该 todo 相关 chunk  
- 日程写入 / 同步 → 更新当日 schedule chunk  
- 物化定时任务 → 更新 recurring 关联 chunk  

---

## 7. 分阶段交付

### Phase E1 — 检索器骨架（无 LLM）

- [x] **E1.1** 新增 `server/src/services/internal-knowledge-retriever.ts`
- [x] **E1.2** 实现 R0 规则检索 API：`retrieveForTodo(todoId, intent)`
- [x] **E1.3** 单元测试：纪要待办能召回同日日程 + 历史同类型结果

### Phase E2 — 生成链路替换模板

- [x] **E2.1** 新增 `llm-ai-result-generator.ts`（或配置化 provider）
- [x] **E2.2** `createAiResultForTodo` 改为：retrieve → generate → 落库
- [x] **E2.3** 生成结果 metadata 记录 `snippetIds`（`todo_ai_results.provider`）

### Phase E3 — 修订链路

- [x] **E3.1** `reviseAiResult` 接入 retrieve(revise)
- [x] **E3.2** 修改模式 SSE 回复注明「已参考 vN 与日程上下文」

### Phase E4 — 可选 embedding（R1）

- [ ] **E4.1** 本地 embedding + 增量索引 job
- [ ] **E4.2** 黄金场景回归：C1/C3/C4/C9（见 [待办知识库-RAG方案.md §8](./待办知识库-RAG方案.md#8-验收标准内部闭环)）

---

## 8. 验收标准（内部闭环）

| # | 场景 | 预期 |
|---|------|------|
| K1 | 当日有「产品需求评审」日程，创建「整理会议纪要」待办 | AI 结果要点中出现评审时段/标题（来自 schedule，非幻觉编造外链） |
| K2 | 「做会议纪要」待办已有 seed v1，修改「补充结论」 | v2 保留 v1 要点并追加结论；`assistant_messages` 有快照 |
| K3 | 定时任务物化「复盘」待办 | 检索到近期已完成待办数量或同类 review 片段 |
| K4 | 检索 0 条 + LLM 失败 | 降级模板，待办仍可完成流转 |
| K5 | 全流程不调用外部 HTTP（除 LLM API） | 无 MCP / 无 OAuth |

---

## 9. 关键文件（预计）

| 区域 | 路径 |
|------|------|
| 检索 | `server/src/services/internal-knowledge-retriever.ts` |
| 生成 | `server/src/services/llm-ai-result-generator.ts` |
| 现有 AI | `server/src/services/ai-result-service.ts` |
| 待办 | `server/src/services/todo-service.ts` |
| 日程 | `server/src/services/schedule-service.ts` |
| 助手修订 | `server/src/services/personal-assistant-service.ts` |
| 会话 | `server/src/services/assistant-session-service.ts` |
| 类型（可选） | `shared/src/types.ts` — `KnowledgeSnippet`, `AiResultProvenance` |

---

## 10. 与路线图关系

- **前置**：个人工作台 Phase A–F 与 Phase E1–E3 已闭环；完成状态见 [个人工作台-功能点.md §实现状态总览](./个人工作台-功能点.md#实现状态总览)  
- **并行**：不阻塞五层底座；检索器接口与 ContextRetriever 契约对齐，便于后续替换
- **后置**：F4 MCP 可在 Internal 检索之上 **叠加** External 片段，不替代本方案（见 [交付说明 §9](./个人工作台-交付说明.md#9-mcp-配置说明)）

---

*— 文档结束 —*
