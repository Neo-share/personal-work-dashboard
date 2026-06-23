# MCP 待办

> **SSOT**：外部 MCP 接入个人工作台链路的**计划与验收**唯一来源（飞书文档等）。
>
> - 索引与依赖：[roadmap.md](./roadmap.md)
> - `ContextRetriever` / `externalSnippets` 接口：[architecture-foundation.md §3.4](./architecture-foundation.md#34-contextretriever)
> - 技术功能点 TL1-09.05（明确不做 MCP 于 RAG 内）：[个人工作台-技术功能点.md](../docs/个人工作台/个人工作台-技术功能点.md) §TL1-09
> - 护栏要求：[guardrail-enhancement.md](./guardrail-enhancement.md)
> - 实现状态：[IMPLEMENTATION_STATUS.md](../IMPLEMENTATION_STATUS.md)

---

## 1. 目标

将 MCP 纳入个人工作台核心链路，先完成 **Feishu Document MCP** 接入，作为知识库上下文来源；失败时可降级到本地规则流程。

---

## 2. 范围

| 纳入 | 不纳入（本待办） |
|------|------------------|
| 文档拉取 → 清洗 → 摘要 → `ContextRetriever.externalSnippets` | 待办知识库 RAG（内部 SQLite）→ [待办知识库-RAG方案](../docs/个人工作台/待办知识库-RAG方案.md) |
| 个人助手生成/修订时注入外部片段 | 外部日历 OAuth |
| 延迟与成本指标记录 | Soul 外链配置 |

---

## 3. 依赖

- [architecture-foundation.md](./architecture-foundation.md) F4：`ContextRetriever` 就绪
- [guardrail-enhancement.md](./guardrail-enhancement.md)：外部内容经输出层脱敏

---

## 4. 实施步骤（规划）

1. [x] 选型与配置 Feishu Document MCP（凭证与权限由人工配置，文档不记录密钥）
2. [x] 实现 `McpContextRetriever` 适配器，填充 `externalSnippets`
3. [x] 个人助手 AI 生成/修订链路消费片段（与 `ai-result-service` 或后续 LLM 层对接）
4. [x] 失败降级：无 MCP 时行为与当前规则模板一致
5. [x] 指标：`pw.mcp.latency_ms`、`pw.mcp.fail` 记入 MetricsLedger

---

## 5. 验收

- [ ] 至少 **3 个核心场景**可稳定拉取文档上下文并影响助手回复
- [ ] MCP 不可用时自动降级，用户仍可完成基础待办/日程操作
- [ ] 延迟与失败可查询或日志可追溯
- [x] 新 MCP 工具通过 `ToolRegistry` 注册，无需改 `routes/chat.ts`（见 architecture-foundation §7）

---

## 6. 总任务

- [ ] 将 MCP 纳入个人工作台核心链路
  - 目标：Feishu Document MCP 作为首要外部知识来源。
  - 范围：§4 实施步骤（代码已落地；需配置 `FEISHU_MCP_HTTP_URL` 与 HTTP 桥接后验收 §5 场景）。
  - 验收：§5 清单。
