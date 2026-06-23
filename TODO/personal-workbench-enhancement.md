# 个人工作台完善待办

> **SSOT**：个人工作台**实施 Phase 清单**与**回归验收表**的唯一来源。
>
> | 内容 | 权威来源 |
> |------|----------|
> | 产品需求（布局、字段、交互） | [docs/个人工作台/个人工作台.md](../docs/个人工作台/个人工作台.md) |
> | L4 功能点清单（验收级） | [个人工作台-功能点.md](../docs/个人工作台/个人工作台-功能点.md) |
> | L4 技术对照 | [个人工作台-技术功能点.md](../docs/个人工作台/个人工作台-技术功能点.md) |
> | 内部 RAG 方案 | [待办知识库-RAG方案.md](../docs/个人工作台/待办知识库-RAG方案.md) |
> | 五层底座契约 | [architecture-foundation.md](./architecture-foundation.md) |
> | 索引与依赖 | [roadmap.md](./roadmap.md) |
> | 实现状态汇总 | [IMPLEMENTATION_STATUS.md](../IMPLEMENTATION_STATUS.md) |
>
> **执行策略**：Phase A–D、B4、Phase F 已收口；**未完成项仅 Phase E（RAG）** 与范围外 OAuth/MCP。

---

## TL1 技术域 ↔ Phase 对照

> **核对来源**：[个人工作台-技术功能点.md](../docs/个人工作台/个人工作台-技术功能点.md) · **核对日期**：2026-06-23

| TL1 技术域 | 主模块（client / server） | 对应 Phase | TL4 状态 |
|------------|---------------------------|------------|----------|
| TL1-01 页面框架 | `PersonalWorkbenchPage` · `personalWorkbench.summary` | A6 | ✅ 全项 |
| TL1-02 待办 | `TodoPanel` · `todo-service` · `ai-result-service` | A1 · B2 | ✅ 全项 |
| TL1-03 日程 | `ScheduleTimeline` · `schedule-service` | F2 | ✅ 全项（渠道 seed mock） |
| TL1-04 定时任务 | `RecurringTaskPanel` · `recurring-task-*` | A2–A4 | ✅ 全项 |
| TL1-05 个人助手 | `PersonalAssistantPanel` · `assistant/*` | C · D1 | ✅ 全项 |
| TL1-06 AI 结果 | `AiResultPanel` · `todo_ai_results` | A5 · **B4** | ✅ 轮询已接；**LLM 替换 → E2** |
| TL1-07 流程联动 | `personal-orchestrator` · `handleRefresh` | B1 · B3 | ✅ 全项 |
| TL1-08 非功能 | CSS 断点 · SQLite · SSE error | **F1–F3** | ✅ 全项 |
| TL1-09 RAG | `context-retriever` 扩展 · `rag/*`（规划） | **E1–E4** | ❌ 待做 |

**SSE 事件（TL1-05 / TL1-07）**：`text` · `refresh` · `modifyMode` · `blocked` · `error` · `done` — 见技术功能点 §TL1-05。

**invalidate 矩阵（TL1-07）**：见技术功能点 §TL1-07；实现于 `PersonalWorkbenchPage.handleRefresh`。

---

## 功能点对照缺口（L4 / TL4）

> **核对来源**：[个人工作台-功能点.md](../docs/个人工作台/个人工作台-功能点.md) · **核对日期**：2026-06-23 · **代码对照**：[个人工作台-技术功能点.md](../docs/个人工作台/个人工作台-技术功能点.md)

**图例**：✅ 已实现 · ⚠️ 部分实现 / Demo 已满足 · ❌ 未实现

### 按 L1 模块汇总

| L1 模块 | 功能点数 | ✅ | ⚠️ | ❌ | 说明 |
|---------|---------|----|----|-----|------|
| L1-01 页面框架 | 7 | 7 | 0 | 0 | `/` 无 DevShell 导航；1100/900 断点已实现 |
| L1-02 待办管理 | 20 | 20 | 0 | 0 | 筛选 / 卡片 / AI 面板 / 历史已完成 |
| L1-03 日程管理 | 13 | 13 | 0 | 0 | 去重 / 多渠道开关 / NL 写入；渠道数据为 seed mock |
| L1-04 定时任务 | 13 | 13 | 0 | 0 | 物化规则 + 调度器 + 不走 LLM |
| L1-05 个人助手 | 28 | 28 | 0 | 0 | Soul 设置已持久化至 settings KV |
| L1-06 AI 结果 | 15 | 15 | 0 | 0 | pending 轮询 + 规则模板；LLM 生成属 Phase E |
| L1-07 流程联动 | 6 | 6 | 0 | 0 | refresh 契约 + 胶囊联动 |
| L1-08 交互与非功能 | 12 | 12 | 0 | 0 | 640 断点、手动加日程、Soul 已补全 |
| L1-09 RAG（规划） | 5 | 1 | 0 | 4 | 表结构已有；E1–E4 未做 |

### 未完成 / 部分完成明细

| 编号 | L4 功能点 | 状态 | 缺口说明 | 对应待办 |
|------|-----------|------|----------|----------|
| 05.01 | Soul 设置 | ✅ | settings KV + Modal 持久化 | — |
| 06.02 | 异步生成 + 生成中 disabled | ✅ | `scheduleAiResultGeneration` 1.5s + 前端 800ms 轮询 | — |
| 08.02 | 添加日程弹窗 | ✅ | `ScheduleTimeline` + `schedule.createLocal` | — |
| 08.04 | 编辑保存 Toast | ✅ | 待办/定时任务均已走 tRPC mutation 持久化 | — |
| 08.05 | Soul / 附件 Toast | ✅ | Soul Modal 已替换 Demo Toast | — |
| 08.11 | 640px 断点 | ✅ | `personal-workbench.css` @media 640 | — |
| 09.01 | RAG 内部检索生成 | ❌ | 仍为规则 HTML 模板 | **E1–E2** |
| 09.02 | 分类型检索策略 | ❌ | 未实现 retriever 策略 | **E1–E2** |
| 09.03 | 修订 RAG 上下文 | ❌ | `reviseAiResult` 仍为关键词规则 | **E3** |
| 09.04 | 知识源表 | ✅ | SQLite 表已就绪 | — |
| 09.05 | NL 意图 RAG / Soul 向量库 | — | 明确不做 | [mcp-integration.md](./mcp-integration.md) |

### 范围外（另有待办文件）

| 编号 | 功能点 | 状态 | 待办文件 |
|------|--------|------|----------|
| 03.04（延伸） | 飞书/钉钉/Outlook 真实 OAuth 同步 | ❌ | 本文件 §不在本阶段范围 |
| 09.05 | 飞书 MCP / Soul 向量库 | — | [mcp-integration.md](./mcp-integration.md) |

### 已验收话术（L1-05 §05.22–05.28）

11 条黄金话术已由 `personal-assistant-golden.test.ts` 覆盖（含冲突优先级、重复周期分流）。

---

## 总目标

补齐待办、日程、定时任务、个人助手之间的协同闭环，提升稳定性、可用性与可观测性。

---

## Phase A — 闭环补全

- [x] **A1** 待办编辑弹窗（标题 / 描述 / 截止 / 紧急）
- [x] **A2** 定时任务编辑弹窗
- [x] **A3** 到期自动物化调度器（启动扫描 + 周期 tick）
- [x] **A4** 创建定时任务后自动物化；物化后 refresh 待办与统计
- [x] **A5** 历史对话：待办 AI 线程列表 + 结果预览 + 继续修改
- [x] **A6** 概览胶囊日程数随小月历选中日期变化

## Phase B — 刷新与一致性

- [x] **B1** `PersonalWorkbenchPage.handleRefresh` 统一 invalidate 契约
- [x] **B2** 待办/定时任务 mutation `onError` 用户提示
- [x] **B3** 助手 SSE 处理 `modifyMode` / `error` 事件
- [x] **B4** AI `pending` 态轮询（真异步接入时启用）

## Phase C — 异常降级

- [x] **C1** `/api/chat` 异常返回 SSE `error` 事件
- [x] **C2** 助手面板错误文案 + 可继续输入
- [x] **C3** 意图无法识别 / 时间解析失败的结构化回复（orchestrator 结构化引导）

## Phase D — 可观测与文档

- [x] **D1** 服务端 MetricsLedger 意图/工具指标（替代 `[pw.metrics]` 占位）
- [x] **D2** `IMPLEMENTATION_STATUS.md` 个人工作台专章
- [x] **D3** 黄金话术回归接 `agent:gate`（见 [test-coverage-validation-automation.md](./test-coverage-validation-automation.md)）

## Phase E — 待办知识库 RAG（内部闭环）

> **TL1-09 技术对照**：[个人工作台-技术功能点.md](../docs/个人工作台/个人工作台-技术功能点.md) §TL1-09 · 表结构 ✅（09.04）

方案详述见 **[待办知识库-RAG方案.md](../docs/个人工作台/待办知识库-RAG方案.md)**（不依赖 MCP / 外链）。

- [ ] **E1** 内部检索器 R0（规则：时间窗 + 标题 + result_type）
- [ ] **E2** AI 初步结果：retrieve → LLM 生成，替换纯模板
- [ ] **E3** AI 多轮修改：召回版本 + 会话 + 日程上下文
- [ ] **E4**（可选）本地 embedding 索引与 K1–K5 验收

## Phase F — 功能点补全（非阻塞）

> 对照 [个人工作台-功能点.md](../docs/个人工作台/个人工作台-功能点.md) L1-08 / L1-05 缺口；不影响当前 Demo 闭环验收。

- [x] **F1** 响应式补全 **640px** 断点（`08.11` · `personal-workbench.css`）
- [x] **F2** 日程 **手动添加** 弹窗或工具栏入口（`08.02` · 调用 `schedule.createLocal`）
- [x] **F3** Soul 设置真实配置面板（`05.01` / `08.05` · 替换 Demo Toast）

---

## 不在本阶段范围

- 五层底座代码实现 → [architecture-foundation.md](./architecture-foundation.md)
- 外部日历 OAuth（真实渠道同步）→ 见 [IMPLEMENTATION_STATUS.md](../IMPLEMENTATION_STATUS.md) §13.4
- 外部文档 MCP → [mcp-integration.md](./mcp-integration.md)

---

## 回归清单

> 本表为**验收场景**唯一来源；产品原文描述见 [个人工作台.md](../docs/个人工作台/个人工作台.md)。

### 核心场景

| # | 场景 | 预期 |
|---|------|------|
| C1 | 手动添加含「纪要」待办 | 待办 + AI 条 |
| C2 | Chip「明天下午3点项目评审会」 | 仅日程，统计更新 |
| C3 | 「本周五完成 UI 改版方案」 | 待办 + plan AI |
| C4 | 「会后整理会议纪要」 | 待办，非日程 |
| C5 | 「每天下午5点复盘港股」 | 定时任务 + 物化待办 |
| C6 | 定时任务「立即生成」 | 来源=定时任务 |
| C7 | 服务运行跨过 `next_trigger_at` | 自动物化（A3） |
| C8 | 确认 AI 结果 | 进历史已完成 |
| C9 | 修改模式补充结论 | 版本 +1 |
| C10 | 切换月历日期 | 日程数胶囊与当日一致 |
| C11 | 编辑待办 / 定时任务 | 保存后列表更新 |

### 异常场景

| # | 场景 | 预期 |
|---|------|------|
| E1 | 空输入 | 不请求 |
| E2 | 后端不可用 | 明确错误文案 |
| E3 | 回访类待办 | 需人工，无 AI 条 |
| E4 | 停用后物化 | 0 条或提示 |

护栏专项场景见 [guardrail-enhancement.md §5](./guardrail-enhancement.md#5-验收场景)。

---

## 关键文件

实现触点索引（与技术功能点附录 B/C 对齐）：

| 区域 | 路径 |
|------|------|
| 页面 | `client/src/pages/PersonalWorkbenchPage.tsx` |
| 组件 | `client/src/components/personal-workbench/*` |
| 样式 | `client/src/styles/personal-workbench.css` |
| 待办/AI | `server/src/services/todo-service.ts` · `ai-result-service.ts` |
| 日程 | `server/src/services/schedule-service.ts` |
| 调度 | `server/src/services/recurring-task-service.ts` · `recurring-task-scheduler.ts` |
| 五层编排 | `server/src/assistant/personal-orchestrator.ts` · `intent-router.ts` · `tools/*` |
| 助手入口 | `server/src/services/personal-assistant-service.ts` |
| 会话/线程 | `server/src/services/assistant-session-service.ts` |
| 契约 | `shared/src/assistant-contract.ts` · `shared/src/types.ts` |
| 路由 | `server/src/trpc/router.ts` · `server/src/routes/chat.ts` |
