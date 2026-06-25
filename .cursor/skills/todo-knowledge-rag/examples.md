# RAG 任务示例

按改动类型给出最小路径；须遵守 [SKILL.md](SKILL.md) 范围与降级铁律。

---

## 示例 1：为 audit 类型增强 generate 检索

**场景**：audit 待办应优先召回同关键词的历史 audit 清单。

1. 打开 `internal-knowledge-retriever.ts` 的 `retrieveForGenerate` switch
2. 在 `case 'audit':` 分支调整顺序或新增 SQL（如标题 LIKE 权重）
3. 保持 `limit` 与 `SNIPPET_EXCERPT_MAX_CHARS` 不变，避免 prompt 膨胀
4. 在 `internal-knowledge-retriever.test.ts` 增加 fixture + 断言

```typescript
// 测试骨架
const todoId = insertTodo({ title: '合规审核清单', aiResultType: 'audit', dueAt: '...' });
const result = retrieveForTodo(todoId, { intent: 'generate' });
expect(result.snippets.some((s) => s.sourceTable === 'todo_ai_results')).toBe(true);
```

---

## 示例 2：调整日程召回时间窗

**场景**：纪要待办希望召回 due_at 前后 2 天日程。

1. 修改 `getDueWindow()` 中 `DAY_MS` 倍数（或抽常量 `SCHEDULE_WINDOW_DAYS`）
2. 更新测试中日程 insert 时间与断言
3. **勿**改 ContextRetriever 的 `listDaySchedule`（助手统计用，非同一链路）

---

## 示例 3：扩展 LLM 对 snippets 的使用方式

**场景**：在 prompt 中强调日程片段优先级。

1. 改 `llm-ai-result-generator.ts` 的 `buildContextBlock` 或 `buildSystemPrompt`
2. 保持「只输出 HTML、勿编造外链」约束
3. 手动验证：配置 `LLM_API_KEY`，创建 minutes 待办，检查生成 HTML 是否引用 schedule label

---

## 示例 4：新增 resultType 的全链路

**场景**：产品新增 `AiResultType = 'brief'`。

| 顺序 | 文件 |
|------|------|
| 1 | `shared/src/types.ts` — 扩展联合 + `AI_RESULT_TYPE_LABELS` |
| 2 | `ai-result-service.ts` — `AUTO_KEYWORD_MAP` + `generateAiHtml` 模板 |
| 3 | `internal-knowledge-retriever.ts` — `retrieveForGenerate` 分支 |
| 4 | `llm-ai-result-generator.ts` — `RESULT_TYPE_HINTS` + `MAX_TOKENS_BY_TYPE` |
| 5 | `router.ts` Zod（若暴露给前端） |
| 6 | 单测 + `pnpm build` |

---

## 示例 5：修订链路调试

**场景**：用户说「补充结论：排期推迟一周」，v2 未保留 v1。

排查顺序：

1. `retrieveForTodo(todoId, { intent: 'revise', userDelta })` — snippets 是否含 `当前结果 v1`
2. `resolveRevisedAiResultHtml` — LLM 是否被调用；失败则检查 `applyRevisionRules` 关键词
3. `todo_ai_results` — `provider` 是否为 `llm-rag:...` 或 `rule-template`
4. `assistant_messages` — 是否有 ai_result 快照

---

## 示例 6：MCP 外部片段叠加（F4）

**场景**：用户消息含飞书 doc 链接，创建待办时希望 AI 参考文档。

1. 配置 `FEISHU_MCP_HTTP_URL`（见交付说明 §9）
2. `personal-orchestrator` 创建待办时已可传递 `externalSnippets`
3. `scheduleAiResultGeneration(todoId, type, title, externalSnippets)` 暂存
4. `createAiResultForTodo` → `mergeExternalSnippetsIntoKnowledge` 前置外部片段
5. 验收：`provider` 含 `external_mcp:` 前缀 id；**不**删除 Internal 检索

---

## 示例 7：实现 E4 embedding（规划，未做）

**前置**：更新 [待办知识库-RAG方案.md](../../docs/个人工作台/待办知识库-RAG方案.md) §6–§7。

建议步骤：

1. 新增 sidecar 表或 JSON 向量存储（仍 SQLite 闭环）
2. 在待办 CRUD / AI 确认 / 日程写入 hook 增量索引
3. `retrieveForTodo` 内：R0 硬过滤 → embedding top-k → rerank
4. 保留 R0 为 fallback；K4 降级行为不变
5. 黄金场景 K1–K3 回归

**禁止**：用 embedding 替代 NL 意图路由；用外部向量 SaaS 破坏 K5（除非用户明确要求）。

---

## 反例（禁止）

| 反例 | 原因 |
|------|------|
| 在 ContextRetriever 里实现 todo AI 检索 | 职责分离；应走 `retrieveForTodo` |
| 检索失败阻断待办创建 | 违反 K4 降级铁律 |
| 从 requirements/links 表检索 | 方案明确不纳入 |
| 检索 0 条时不写 provider | 应仍记录 `rule-template` 或 `llm` |
| 未经方案文档直接上向量服务 | E4 未立项；范围失控 |
| 前端直接调 retrieveForTodo | 无 tRPC 暴露；逻辑仅在 server |

---

## 单测参考（纪要场景）

见 `internal-knowledge-retriever.test.ts`：

1. insert 日程「产品需求评审」于 due 当日
2. insert 历史 todo + confirmed minutes AI 结果
3. insert 目标 todo「整理会议纪要」
4. `retrieveForTodo(targetId, { intent: 'generate' })`
5. 断言 snippets 含 schedule label 与 `todo_ai_results`

运行：

```bash
pnpm --filter @project-manager/server test internal-knowledge-retriever
```
