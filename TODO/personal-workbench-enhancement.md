# 个人工作台待办

> **SSOT**：个人工作台**未完成**功能点与实施 Phase 的唯一来源。
>
> | 内容 | 权威来源 |
> |------|----------|
> | L4 产品功能点 | [个人工作台-功能点.md](../docs/个人工作台/个人工作台-功能点.md) |
> | L4 → TL4 技术对照与**完成状态** | [个人工作台-技术功能点.md §实现状态总览](../docs/个人工作台/个人工作台-技术功能点.md#实现状态总览) |
> | 内部 RAG 方案 | [待办知识库-RAG方案.md](../docs/个人工作台/待办知识库-RAG方案.md) |
> | 五层底座契约 | [architecture-foundation.md](./architecture-foundation.md) |
> | 索引与依赖 | [roadmap.md](./roadmap.md) |
>
> **已完成项**（Phase A–D、B4、F 等）不在此维护，见技术功能点文档各 TL1 节状态列。

---

## Phase E — 待办知识库 RAG（内部闭环）

> **TL1-09 技术对照**：[个人工作台-技术功能点.md §TL1-09](../docs/个人工作台/个人工作台-技术功能点.md#tl1-09-后续迭代待办知识库rag) · 表结构 ✅（09.04）

方案详述见 **[待办知识库-RAG方案.md](../docs/个人工作台/待办知识库-RAG方案.md)**（不依赖 MCP / 外链）。

| 编号 | L4 | 待办项 | 状态 |
|------|-----|--------|------|
| E1 | 09.01–09.02 | 内部检索器 R0（规则：时间窗 + 标题 + result_type） | ❌ |
| E2 | 06.02 · 09.01 | AI 初步结果：retrieve → LLM 生成，替换纯模板 | ❌ |
| E3 | 09.03 | AI 多轮修改：召回版本 + 会话 + 日程上下文 | ❌ |
| E4 | — | （可选）本地 embedding 索引与 K1–K5 验收 | ❌ |

- [ ] **E1** 内部检索器 R0（规则：时间窗 + 标题 + result_type）
- [ ] **E2** AI 初步结果：retrieve → LLM 生成，替换纯模板
- [ ] **E3** AI 多轮修改：召回版本 + 会话 + 日程上下文
- [ ] **E4**（可选）本地 embedding 索引与 K1–K5 验收

---

## 范围外待办

| 编号 | 功能点 | 说明 | 待办文件 |
|------|--------|------|----------|
| 03.04（延伸） | 飞书/钉钉/Outlook 真实 OAuth 同步 | Demo 渠道为 seed mock | 本文件（待规划） |
| 09.05 | 飞书 MCP / Soul 向量库 | 明确不做于 RAG 内 | [mcp-integration.md](./mcp-integration.md) |

---

## 关键文件（Phase E 触点）

| 区域 | 路径 |
|------|------|
| 检索扩展 | `server/src/assistant/context-retriever.ts` |
| AI 生成 | `server/src/services/ai-result-service.ts` |
| 修订 | `server/src/services/todo-service.ts` · `reviseAiResult` |
| 方案 | [待办知识库-RAG方案.md](../docs/个人工作台/待办知识库-RAG方案.md) |
