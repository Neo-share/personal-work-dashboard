# 护栏完善待办

> **SSOT**：个人助手链路**四层护栏规则细则**与验收场景的唯一来源。
>
> - 索引与依赖：[roadmap.md](./roadmap.md)
> - 技术功能点 TL1-05 / TL1-09：[个人工作台-技术功能点.md](../docs/个人工作台/个人工作台-技术功能点.md)
> - 接口契约（`GuardrailEngine`、`GuardrailVerdict`、SSE `blocked`）：[architecture-foundation.md §3.3](./architecture-foundation.md#33-guardrailengine)
> - 实现：`server/src/assistant/guardrail-engine.ts`（**F3 已落地**）
> - 实现状态：[IMPLEMENTATION_STATUS.md](../IMPLEMENTATION_STATUS.md)

---

## 1. 目标

建立输入、意图、工具调用、输出四层护栏，降低误触发、越权执行与提示注入风险；与 `/api/chat`（`context=personal`）及个人助手编排链路对齐。

---

## 2. 四层护栏定义

| 层 | 检查项 | 失败动作 |
|---|---|---|
| **输入** | 长度上限、提示注入模式、空消息 | `blocked` + 原因，不写库 |
| **意图** | 低置信度 + 含敏感动作词 | 追问确认，不自动执行 |
| **工具** | 参数 Zod、动作白名单、`modifyTodoId` 归属校验 | 拒绝调用 |
| **输出** | 回复不含内部路径/密钥占位 | 脱敏后下发 |

SSE 扩展事件：`{ type: 'blocked', code, message }`（前端见 `PersonalAssistantPanel`）。

---

## 3. 规则细则

> **状态**：`PersonalGuardrailEngine` 已实现；单测见 `guardrail-engine.test.ts`（G1–G5）。未勾选项为增强项，非阻塞 MVP。

### 3.1 输入层

- [x] 消息最大长度（`MAX_INPUT_LENGTH = 2000`，硬编码见 `guardrail-engine.ts`）
- [x] 提示注入关键词/模式表（`INJECTION_PATTERNS`）
- [x] 空消息与纯空白拦截

### 3.2 意图层

- [x] `confidence=low` 时不自动执行副作用工具（orchestrator 配合 `unknown` 引导）
- [x] 敏感动作词列表（`SENSITIVE_ACTION_PATTERNS`）触发拒绝

### 3.3 工具层

- [x] 仅 `ToolRegistry` 已注册工具可被调用（白名单）
- [x] 各工具 params 经 Zod 校验（`tool-registry.ts`）
- [x] `todo.revise_ai` 校验 `modifyTodoId` 存在且有待办 AI 类型

### 3.4 输出层

- [x] 脱敏：文件路径（`sanitizeAssistantReply` + `checkOutput`）
- [x] 错误栈不直接下发给前端（`chat.ts` 统一 error 文案）

---

## 4. 审计与可观测

- [x] 拦截记录写入 `MetricsLedger`：`pw.guardrail.blocked { layer, code }`
- [ ] 关键场景可复盘（会话 ID + 层 + code）— 可选落 SQLite `metric_events`

---

## 5. 验收场景

| # | 场景 | 预期 |
|---|------|------|
| G1 | 超长输入 | SSE `blocked`，无 DB 写入 |
| G2 | 典型注入话术 | 输入层拦截 |
| G3 | 低置信度 + 「删除所有待办」 | 意图层追问或拒绝 |
| G4 | 伪造 `modifyTodoId` | 工具层拒绝 |
| G5 | 回复含 `server/data/` 路径 | 输出层脱敏 |

---

## 6. 总任务

- [x] 完善个人工作台与助手链路的护栏体系（F3）
  - 目标：§1。
  - 范围：§3 核心规则已落地至 `guardrail-engine.ts`。
  - 验收：§5 G1–G5 单测通过；与 [architecture-foundation.md §8](./architecture-foundation.md#8-验收清单实现阶段勾选) 一致。
- [ ] 可选增强：token/环境变量脱敏模式扩展、拦截落库复盘（§4 末项）

---

## 7. 不在本文件范围

- 五层接口类型定义 → [architecture-foundation.md](./architecture-foundation.md)
- 产品侧异常文案 → [personal-workbench-enhancement.md](./personal-workbench-enhancement.md) Phase C
- 外部 MCP 内容安全 → [mcp-integration.md](./mcp-integration.md)
