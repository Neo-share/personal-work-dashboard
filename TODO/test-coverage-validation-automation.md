# 测试与验证自动化待办

> **SSOT**：测试框架、覆盖率与**门禁接入计划**的唯一来源。
>
> - 索引与依赖：[roadmap.md](./roadmap.md)
> - 五层接口契约（单测对齐基准）：[architecture-foundation.md](./architecture-foundation.md) F0 · [shared/src/assistant-contract.ts](../shared/src/assistant-contract.ts)
> - 门禁命令与 DoD：[agents/commands-checklist.md](../agents/commands-checklist.md)
> - 个人工作台已验收回归：见 [个人工作台-技术功能点.md §已验收](../docs/个人工作台/个人工作台-技术功能点.md#实现状态总览)
> - TL4 测试范围对照：[个人工作台-技术功能点.md](../docs/个人工作台/个人工作台-技术功能点.md)
> - 实现状态：[IMPLEMENTATION_STATUS.md](../IMPLEMENTATION_STATUS.md)

---

## 1. 目标

为个人工作台与助手核心模块建立可持续的单元测试与覆盖率体系，并纳入 `agent:gate` / CI 验证链路。

**前置策略**：F0 契约与 T1–T3 **已完成**；新增用例以 [个人工作台-技术功能点.md](../docs/个人工作台/个人工作台-技术功能点.md) TL1 模块为范围索引。

---

## 2.1 TL1 模块 ↔ 测试文件

| TL1 | 测试覆盖 | 文件 |
|-----|----------|------|
| TL1-04 定时任务 | 物化规则 | `recurring-task-service.test.ts` |
| TL1-05 意图分流 | 黄金话术 11 条 | `intent-router.test.ts` · `personal-assistant-golden.test.ts` |
| TL1-05 工具 | 白名单 + Zod | `tool-registry.test.ts` |
| TL1-05 护栏 | G1–G5 | `guardrail-engine.test.ts` |
| TL1-05 指标 | MetricsLedger | `metrics-ledger.test.ts` |
| TL1-09 RAG | — | Phase E 落地后新增 |

---

## 2. 范围

| 纳入 | 不纳入 |
|------|--------|
| 测试框架选型与根脚本 | E2E 浏览器全量（可后续单独待办） |
| `IntentRouter` / `ToolRegistry` / `guardrail-engine` 单测 | 业务仓库扫描器全量回归 |
| 覆盖率报告产出与阈值（初版可宽松） | 生产监控告警 |
| 黄金话术清单自动化（接 gate） | LLM 在线评测 |

---

## 3. 分阶段

| 阶段 | 依赖 | 说明 |
|------|------|------|
| T1 | 无 | 框架与 gate 路径，可与 F0 并行 |
| T2–T3 | F0 契约冻结 | 五层模块单测以 [architecture-foundation.md §3](./architecture-foundation.md#3-分层设计) 为准 |
| T2 现有 service | 无 | `recurring-task-scheduler` 等可在 T1 后独立推进 |

### T1 — 框架基线（无 F0 依赖）

- [x] 选定 runner（Vitest，与 Vite 生态一致）
- [x] 根目录与 `server/` 增加 `pnpm test` / `test:coverage` 脚本
- [x] `agent:gate` 接入 `build + test:coverage`；CI 经 `gate:pr` 继承
- [x] 单测目录：`server/src/assistant/*.test.ts`、`server/src/services/*.test.ts`

### T2 — 核心单测（F0 后，以契约为准）

- [x] `RuleBasedIntentRouter` 黄金话术 11 条（`intent-router.test.ts`）
- [x] `PersonalToolRegistry` 注册/invoke/Zod/白名单（`tool-registry.test.ts`）
- [x] `recurring-task-service` 物化逻辑（`recurring-task-service.test.ts`）
- [x] `recurring-task-scheduler` tick（`metrics-ledger.test.ts`）
- [x] `PersonalGuardrailEngine` G1–G5（`guardrail-engine.test.ts`）
- [x] E2E 黄金话术回归（`personal-assistant-golden.test.ts`）

### T3 — 覆盖率与门禁

- [x] 覆盖率报告（Vitest v8，`server/coverage/`）
- [x] `pnpm agent:gate` = `build && test:coverage`，失败阻断交付
- [x] 黄金话术回归已接 `agent:gate`（见 [个人工作台-技术功能点.md §已验收](../docs/个人工作台/个人工作台-技术功能点.md#实现状态总览)）

---

## 4. 验收

- [x] 核心模块测试可稳定执行（`pnpm test` exit 0，当前 43 条）
- [x] 覆盖率报告可生成并可追踪（`assistant/` 层约 89% 行覆盖）
- [x] 验证自动化接入门禁，失败可阻断交付
- [x] 与 [commands-checklist.md §交付前 DoD](../agents/commands-checklist.md) 表述一致

---

## 5. 总任务

- [x] 建立测试 / 覆盖率 / 验证自动化基线
  - 目标：§1。
  - 范围：§2–§3。
  - 验收：§4。
