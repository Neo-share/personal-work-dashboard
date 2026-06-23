# TODO 总路线图

> **SSOT**：`TODO/` 目录的**索引与依赖关系**唯一来源。实现状态以 [IMPLEMENTATION_STATUS.md](../IMPLEMENTATION_STATUS.md) 为准；全项目文档映射见 [AGENTS.md §2.1](../AGENTS.md#21-权威映射表)。

个人工作台 AI 化相关待办已**基本收口**（五层底座 F0–F4、RAG E1–E3、测试 T1–T3、护栏 F3）。本文件仅索引**仍开放**的可选增强与规则细则待办。

---

## 本目录文档映射（SSOT）

| 文件 | 职责（唯一定义） | 引用方（勿重复展开） |
|------|------------------|----------------------|
| **roadmap.md**（本文件） | 优先级、依赖图、执行顺序 | 各子待办文首 |
| **docs/个人工作台/个人工作台-功能点.md** | L4 **产品功能点与完成状态** SSOT | `IMPLEMENTATION_STATUS` §13 · `个人工作台-技术功能点` |
| **docs/个人工作台/个人工作台-技术功能点.md** | TL1–TL4 **技术实现对照** | `test-coverage-validation-automation` · `server/src/assistant/ARCHITECTURE.md` |
| **server/src/assistant/ARCHITECTURE.md** | 五层底座**接口契约**与目录规划（F0–F4 已落地） | `guardrail-enhancement`、`test-coverage-validation-automation`、技术功能点 §TL1-05 |
| **guardrail-enhancement.md** | 四层护栏**规则细则**与验收场景 | `ARCHITECTURE.md` §3.3 仅保留接口 |
| **test-coverage-validation-automation.md** | 测试框架、覆盖率与 gate 基线（**T1–T3 已完成**，77 条用例） | 功能点 §实现状态总览 · 交付说明 §7 |

**产品需求**不在 `TODO/` 定义：`docs/个人工作台/个人工作台.md` 为个人工作台产品 SSOT；**向外交付**见 [个人工作台-交付说明.md](../docs/个人工作台/个人工作台-交付说明.md)。

---

## 仍开放项（可选 / 范围外）

| 项 | 状态 | 权威来源 |
|----|------|----------|
| RAG **E4** 本地 embedding | ❌ 可选 | [个人工作台-功能点.md §待完成](../docs/个人工作台/个人工作台-功能点.md#待完成明细) · [待办知识库-RAG方案.md](../docs/个人工作台/待办知识库-RAG方案.md) Phase E4 |
| 飞书 MCP **运行时验收** | ⚠️ 代码已落地 | [个人工作台-交付说明.md §9](../docs/个人工作台/个人工作台-交付说明.md#9-mcp-配置说明) |
| 外部日历 **真实 OAuth** | ❌ 范围外 | [个人工作台-功能点.md §待完成](../docs/个人工作台/个人工作台-功能点.md#待完成明细) |
| 护栏 token 脱敏扩展 | ❌ 可选 | [guardrail-enhancement.md §6](./guardrail-enhancement.md#6-总任务) |

---

## 已收口项（索引，不在 TODO 重复维护）

| 领域 | 状态 | 权威来源 |
|------|------|----------|
| 五层底座 F0–F4 | ✅ | [server/src/assistant/ARCHITECTURE.md](../server/src/assistant/ARCHITECTURE.md) |
| RAG E1–E3 | ✅ | [个人工作台-功能点.md §L1-09](../docs/个人工作台/个人工作台-功能点.md#l1-09-后续迭代待办知识库rag) |
| 测试 T1–T3 + gate | ✅ | [test-coverage-validation-automation.md](./test-coverage-validation-automation.md)（77 条 · 纳入范围 ~76%） |
| 护栏 F3 + F3+ 增强 | ✅ | [guardrail-enhancement.md](./guardrail-enhancement.md)（13 条单测） |
| 个人工作台 L1-01 ~ L1-08 | ✅ | [个人工作台-功能点.md §实现状态总览](../docs/个人工作台/个人工作台-功能点.md#实现状态总览) |

---

## 对应待办文件

- [guardrail-enhancement.md](./guardrail-enhancement.md)
- [test-coverage-validation-automation.md](./test-coverage-validation-automation.md)
