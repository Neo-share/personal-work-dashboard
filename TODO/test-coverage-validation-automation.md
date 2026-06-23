# 测试与验证自动化

> **SSOT**：测试框架、覆盖率与**门禁接入**的唯一来源。  
> **状态**：T1–T3 **已完成**（核对日期：2026-06-23，以 `pnpm test` / `pnpm test:coverage` 为准）。
>
> - 索引与依赖：[roadmap.md](./roadmap.md)
> - 五层接口契约（单测对齐基准）：[server/src/assistant/ARCHITECTURE.md](../server/src/assistant/ARCHITECTURE.md) · [shared/src/assistant-contract.ts](../shared/src/assistant-contract.ts)
> - 门禁命令与 DoD：[agents/commands-checklist.md](../agents/commands-checklist.md)
> - 个人工作台验收回归：[个人工作台-功能点.md §实现状态总览](../docs/个人工作台/个人工作台-功能点.md#实现状态总览)
> - TL4 测试范围对照：[个人工作台-技术功能点.md](../docs/个人工作台/个人工作台-技术功能点.md)
> - 实现状态：[IMPLEMENTATION_STATUS.md](../IMPLEMENTATION_STATUS.md)

---

## 1. 目标

为个人工作台与助手核心模块建立可持续的单元测试与覆盖率体系，并纳入 `agent:gate` / CI 验证链路。

**现状**：目标已达成。新增用例以 [个人工作台-技术功能点.md](../docs/个人工作台/个人工作台-技术功能点.md) TL1 模块为范围索引。

---

## 2. 范围

| 纳入 | 不纳入 |
|------|--------|
| 测试框架选型与根脚本 | E2E 浏览器全量（可后续单独待办） |
| 五层 `assistant/` 与个人工作台相关 `services/` 单测 | 开发域 service 单测与覆盖率（`requirement-service` 等） |
| 覆盖率报告（分母不含开发域 service；见 `vitest.config.ts`） | 生产监控告警 |
| 黄金话术清单自动化（接 gate） | LLM 在线评测 |
| F4 MCP HTTP 桥接单测 | 业务仓库扫描器全量回归 |

---

## 3. TL1 模块 ↔ 测试文件

| TL1 | 测试覆盖 | 文件 | 用例数 |
|-----|----------|------|--------|
| TL1-04 定时任务 | 物化规则 | `services/recurring-task-service.test.ts` | 5 |
| TL1-04 调度 | tick + 物化联动 | `assistant/metrics-ledger.test.ts`（`describe('recurring-task-scheduler')`） | 3 |
| TL1-05 意图分流 | 路由 + 黄金话术 | `assistant/intent-router.test.ts` · `services/personal-assistant-golden.test.ts` | 13 · 11 |
| TL1-05 工具 | 白名单 + Zod + todo 工具 | `assistant/tool-registry.test.ts` · `assistant/tools/register-tools.test.ts` · `assistant/tools/todo-tools.test.ts` | 5 · 1 · 3 |
| TL1-05 编排 | 护栏 / 分支 / revise | `assistant/personal-orchestrator.test.ts` | 7 |
| TL1-05 上下文 | DB 上下文组装 | `assistant/context-retriever.test.ts` | 2 |
| TL1-05 护栏 | G1–G5 + G2b–G3c | `assistant/guardrail-engine.test.ts` | 13 |
| TL1-05 指标 | MetricsLedger | `assistant/metrics-ledger.test.ts`（`describe('InMemoryMetricsLedger')`） | 1 |
| TL1-05 MCP（F4） | externalSnippets | `assistant/mcp-context-retriever.test.ts` · `assistant/mcp/feishu-doc-client.test.ts` · `assistant/mcp/feishu-url.test.ts` | 2 · 4 · 2 |
| TL1-09 RAG | E1–E3 | `services/internal-knowledge-retriever.test.ts` · `services/ai-result-service.test.ts` | 2 · 3 |
| TL1-09 RAG | E4 embedding | — | 待做 |

**合计**：15 个测试文件 · **77** 条用例（`pnpm test` exit 0）。

---

## 4. 分阶段落地

| 阶段 | 依赖 | 状态 |
|------|------|------|
| T1 | 无 | ✅ 框架与 gate 路径 |
| T2 | F0 契约 | ✅ 五层 + 个人工作台 service 核心单测 |
| T3 | T2 | ✅ 覆盖率报告 + `agent:gate` 阻断 |

### T1 — 框架基线

- [x] Vitest + `@vitest/coverage-v8`（`server/vitest.config.ts`）
- [x] 根目录与 `server/`：`pnpm test` / `pnpm test:coverage`
- [x] `pnpm agent:gate` = `build && test:coverage`（根 `package.json`）
- [x] CI：`.github/workflows/agent-ready-gate.yml` → `pnpm gate:pr` → `agent:gate`
- [x] 单测 glob：`server/src/**/*.test.ts`

### T2 — 核心单测

- [x] `RuleBasedIntentRouter`（`intent-router.test.ts`，含黄金话术路由）
- [x] `PersonalToolRegistry`（`tool-registry.test.ts` + `register-tools.test.ts`）
- [x] `recurring-task-service` 物化（`recurring-task-service.test.ts`）
- [x] `recurring-task-scheduler` tick（同文件 `metrics-ledger.test.ts` 内独立 `describe`）
- [x] `PersonalGuardrailEngine` G1–G5 + G2b–G3c（`guardrail-engine.test.ts`，13 条）
- [x] `PersonalAssistantOrchestrator` 护栏 / 分支 / revise（`personal-orchestrator.test.ts`）
- [x] `DbContextRetriever`（`context-retriever.test.ts`）
- [x] `todo-tools` create / revise（`tools/todo-tools.test.ts`）
- [x] 编排链路黄金话术（`personal-assistant-golden.test.ts`，11 条）
- [x] RAG E1–E3（`internal-knowledge-retriever` · `ai-result-service`）
- [x] MCP F4 HTTP 桥接（`mcp-context-retriever` · `feishu-doc-client` · `feishu-url`）

### T3 — 覆盖率与门禁

- [x] 覆盖率：Vitest v8，输出至 `server/coverage/`（`text` + `json-summary`）
- [x] 覆盖范围：`src/assistant/**` + 个人工作台 `services/`（见 `vitest.config.ts` 中 `PERSONAL_WORKBENCH_SERVICES`；**不含** `requirement-service`、`repository-service` 等开发域文件）
- [x] 阈值：lines/functions/branches/statements 均为 **0**（初版宽松，见 `vitest.config.ts`）
- [x] 交付门禁：`pnpm agent:gate` 失败阻断；DoD 见 [commands-checklist.md](../agents/commands-checklist.md)

---

## 5. 覆盖率快照（2026-06-23）

运行 `pnpm test:coverage` 后的典型数值（随单测增减波动）：

| 范围 | 行覆盖 | 说明 |
|------|--------|------|
| **纳入范围合计** | **~76%** | `assistant/` + 个人工作台 `services/`（开发域不计入分母） |
| `assistant/` 合计 | **~93%** | 五层 + MCP + tools |
| 个人工作台 `services/` 合计 | **~63%** | 9 个 service 文件（见 `vitest.config.ts`） |
| `guardrail-engine.ts` | **~95%** | F3+ 归一化、扩展注入/敏感动作模式 |

**开发域排除清单**（`vitest.config.ts` 未纳入 include）：`requirement-service`、`repository-service`、`people-service`、`association-service`、`graph-service`、`weekly-report-service`、`assistant-service`、`cursor-service`、`feishu-service`。

**范围内已补强**（2026-06-23）：`personal-orchestrator.test.ts` · `context-retriever.test.ts` · `tools/todo-tools.test.ts` · `guardrail-engine.test.ts`（13 条）。

**可选后续补测**（非阻塞）：

| 文件 | 约行覆盖 | 缺口 |
|------|----------|------|
| `personal-orchestrator.ts` | ~85%+ | `buildReplyForIntent` 部分 intent 分支仍靠 golden |
| `mcp-feishu-tools.ts` | ~63% | MCP tool execute 未单测 |

---

## 6. 验收

- [x] `pnpm test` 稳定 exit 0（**77** 条）
- [x] `pnpm test:coverage` 可生成报告（纳入范围合计 **~76%** 行覆盖）
- [x] `pnpm agent:gate` / `pnpm gate:pr` 接入 CI，失败阻断交付
- [x] 与 [commands-checklist.md §交付前 DoD](../agents/commands-checklist.md) 一致

---

## 7. 总任务

- [x] 建立测试 / 覆盖率 / 验证自动化基线（§1–§6）

---

## 8. 可选后续（不在 T1–T3 范围）

| 项 | 状态 | 说明 |
|----|------|------|
| RAG E4 embedding 单测 | ❌ | 见 [功能点 §待完成](../docs/个人工作台/个人工作台-功能点.md#待完成明细) |
| E2E 浏览器全量 | ❌ | 交付说明 §5 已标注未做 |
| `mcp-feishu-tools` execute 单测 | ❌ 可选 | F4 桥接已测，ToolRegistry 注册已测 |
| 收紧 coverage thresholds | ❌ 可选 | 开发域已从分母排除；可按模块逐步设阈值 |

---

*核对命令：`pnpm test` · `pnpm test:coverage` · `pnpm agent:gate`*
