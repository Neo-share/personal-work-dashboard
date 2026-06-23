# Shared ARCHITECTURE.md

> **读者优先级：AI Agent > 人类开发者**
>
> 共享类型包架构说明。操作指南见 `AGENTS.md`；全栈视图见 `../ARCHITECTURE.md`。文档索引见 [../AGENTS.md §2](../AGENTS.md#2-文档索引)。

---

## 1. 在系统中的位置

```mermaid
flowchart LR
  Types[shared/src]
  Server[server services + assistant]
  Client[client pages]
  DB[(SQLite)]

  Types -.->|import 类型/契约| Server
  Types -.->|import 类型| Client
  Server -->|mapRow → interface| Types
  Client -->|tRPC 结果形状| Types
  Server --> DB
```

| 属性 | 值 |
|------|-----|
| 包名 | `@project-manager/shared` |
| 运行时 | 无独立进程；编译为 ESM + `.d.ts` |
| 依赖 | 仅 `typescript`（dev） |
| 入口 | `dist/index.js` / `dist/index.d.ts` |

**设计原则**：shared 定义「是什么」；server 定义「怎么存、怎么算」；client 定义「怎么展示」。AppRouter **不在** shared 中。个人助手**实现**在 `server/src/assistant/`，**接口契约**在 `assistant-contract.ts`。

---

## 2. 模块结构

```
src/
├── index.ts               统一导出入口
├── types.ts               领域模型 / 开发域与个人域 / 协议 / 标签常量
├── assistant-contract.ts  个人助手五层 F0 契约（IntentRouter … Orchestrator）
├── work-model.ts          工作域模块、WorkItem 别名、能力开关
├── feishu.ts              飞书 open_id 解析与 lark:// deep link
└── report-week-range.ts   周报默认周期（上周五 00:00 — 本周四 23:59:59）
```

| 文件 | 职责边界 |
|------|----------|
| `types.ts` | 持久化实体、聚合 DTO、开发/个人对话协议、中文标签 |
| `assistant-contract.ts` | 个人助手编排层接口、工具名、意图映射常量；**不含** zod / SQL / LLM |
| `work-model.ts` | 跨工作域逻辑抽象（`WorkItem` = `Requirement` 别名） |
| `feishu.ts` / `report-week-range.ts` | 无 I/O 纯函数 helper |

实现侧五层目录与分阶段说明见 [../server/src/assistant/ARCHITECTURE.md](../server/src/assistant/ARCHITECTURE.md)。

---

## 3. 类型分层

```mermaid
flowchart TB
  subgraph Enums["枚举 / 联合类型"]
    RS[RequirementStatus / Priority / WorkDomain]
    Collab[CollaborationDirection / ManagementRole / PersonCollaborationStatus]
    Graph[GraphNodeType / NavigationActionType]
    Personal[TodoStatus / TodoSource / CalendarSourceType / RecurringFrequency]
    AI[AiResultType / AiResultStatus / TodoAiStatus / TodoFilter]
    Soul[PersonalAssistantSoulTone / PersonalAssistantRefresh]
  end

  subgraph EntitiesDev["开发域实体"]
    Req[Requirement + domain]
    Repo[Repository / RepositoryBranches]
    Per[Person + feishuOpenId]
    RR[RequirementRepository / RequirementPerson]
    Mil[Milestone / Link]
  end

  subgraph EntitiesPersonal["个人域实体"]
    Todo[TodoItem + isOverdue / latestAiVersion]
    AIRes[TodoAiResult]
    Sch[ScheduleEvent / ScheduleEventSource / CalendarSource]
    Rec[RecurringTask]
    Sess[AssistantSession / AssistantMessage / TodoAiThread]
  end

  subgraph Aggregates["聚合 / 视图模型"]
    RD[RequirementDetail]
    WS[WorkbenchSummary]
    PWS[PersonalWorkbenchSummary]
    WR[WeeklyReport + sections]
    SR[ScanResult + ScanFailure]
    RG[RequirementGraph]
    Hist[RequirementStatusHistory]
  end

  subgraph Protocol["跨端协议"]
    NA[NavigationAction / ChatMessage]
    PAR[PersonalAssistantResult / PersonalAssistantSoulSettings]
    Block[PersonalAssistantBlockedEvent / GuardrailBlocked]
  end

  subgraph AssistantContract["个人助手契约 assistant-contract.ts"]
    IR[IntentRouter / PersonalIntentType / IntentSlot]
    TR[ToolRegistry / PersonalToolName / PERSONAL_INTENT_TOOL_MAP]
    GR[GuardrailEngine / GuardrailVerdict]
    CR[ContextRetriever / AssistantContext / ExternalSnippet]
    ML[MetricsLedger / PersonalOrchestrator]
  end

  subgraph Labels["中文标签常量"]
    RSL[REQUIREMENT_STATUS_LABELS 等]
    SoulL[PERSONAL_ASSISTANT_SOUL_TONE_LABELS]
    WRL[WEEKLY_REPORT_SECTION_LABELS]
  end

  Enums --> EntitiesDev
  Enums --> EntitiesPersonal
  EntitiesDev --> Aggregates
  EntitiesPersonal --> Aggregates
  Enums --> Labels
  Enums --> Protocol
  AssistantContract --> Protocol
```

---

## 4. 枚举与标签

### 4.1 带中文标签的枚举

| 类型 | 值 | 标签常量 |
|------|-----|----------|
| `RequirementStatus` | pending_review … paused（7 个） | `REQUIREMENT_STATUS_LABELS` |
| `Priority` | high, medium, low | `PRIORITY_LABELS` |
| `WorkDomain` | dev/life/learning/admin/other | `WORK_DOMAIN_LABELS` |
| `WeeklyReportSectionKey` | completed/testing/developing | `WEEKLY_REPORT_SECTION_LABELS` |
| `TodoSource` | manual/natural_language/recurring_task | `TODO_SOURCE_LABELS` |
| `CalendarSourceType` | feishu/dingtalk/outlook/local | `CALENDAR_SOURCE_LABELS` |
| `RecurringFrequency` | daily/weekly/monthly | `RECURRING_FREQUENCY_LABELS` |
| `AiResultType` | minutes/review/audit/plan/report/analysis/pick | `AI_RESULT_TYPE_LABELS` |
| `PersonalAssistantSoulTone` | formal/concise/friendly | `PERSONAL_ASSISTANT_SOUL_TONE_LABELS` |

**模式**：`Record<EnumType, string>` 与联合类型同文件，新增 enum 成员必须补标签键。

### 4.2 无 shared 标签的枚举

以下 enum 在 client 通过 `utils/labels.ts` 或页面内映射展示：

| 类型 | 用途 |
|------|------|
| `CollaborationDirection` | upstream / downstream |
| `ManagementRole` | owner, participant, watcher, acceptor, release_coordinator |
| `PersonCollaborationStatus` | 人员协作状态 |
| `MilestoneStatus` | 里程碑状态 |
| `GraphNodeType` | 图谱节点类型 |
| `NavigationActionType` | 开发域助手导航动作 |
| `TodoStatus` / `TodoAiStatus` | 待办生命周期与 AI 状态 |
| `TodoFilter` | 待办筛选 |
| `AiResultStatus` | AI 结果版本状态 |
| `PersonalAssistantRefresh` | 个人助手 refresh 指令集合 |
| `PersonalIntentType` / `PersonalToolName` / `GuardrailLayer` | 个人助手契约层（server 实现侧使用） |

---

## 5. 实体模型

### 5.1 开发域核心实体

| Interface | 说明 | 主键 |
|-----------|------|------|
| `Requirement` | 工作项主体（含 `domain: WorkDomain`） | id |
| `Repository` | Git 仓库资产（含分支、脏状态、techTags） | id |
| `Person` | 人员主数据（含 `feishuOpenId`） | id |

**仓库分支视图**（非独立表实体）：`RepositoryBranchItem`, `RepositoryBranches`, `RepositoryBranchSyncResult`。

### 5.2 开发域关联实体

| Interface | 关系 |
|-----------|------|
| `RequirementRepository` | Requirement ↔ Repository M:N 属性 |
| `RequirementPerson` | Requirement ↔ Person M:N 属性 |
| `Milestone` | Requirement 1:N |
| `Link` | Requirement 1:N 外部链接 |
| `RequirementStatusHistory` | Requirement 状态变更审计 |

### 5.3 个人工作台实体

| Interface | 说明 |
|-----------|------|
| `TodoItem` | 待办主体（含 AI 状态、逾期计算字段 `isOverdue`、`latestAiVersion`） |
| `TodoAiResult` | 待办 AI 结果版本（htmlContent） |
| `ScheduleEvent` / `ScheduleEventSource` | 去重后日程与来源明细 |
| `CalendarSource` | 日历来源开关 |
| `RecurringTask` | 定时任务配置 |
| `AssistantSession` / `AssistantMessage` | 个人助手会话消息 |
| `TodoAiThread` | 历史对话左栏：带 AI 结果的待办线程摘要 |

### 5.4 聚合类型

| Interface | 组成 |
|-----------|------|
| `RequirementDetail` | Requirement + repositories[]（含嵌套 Repository）+ people[]（含嵌套 Person）+ milestones[] + links[] |
| `WorkbenchSummary` | pendingPush / pendingConfirm / riskRequirements / upcomingRelease + 计数 |
| `PersonalWorkbenchSummary` | scheduleCount / todoCount / overdueCount / completedCount / rawScheduleCount |
| `WeeklyReport` | weekStart/End + content + `sections`（completed/testing/developing）+ risks |
| `ScanResult` | scannedAt + repositoryCount + repositories[] + failures[] |
| `RequirementGraph` | requirementId? + GraphNode[] + GraphEdge[] |

### 5.5 工作域抽象（work-model.ts）

| 导出 | 含义 |
|------|------|
| `WorkItem` | `Requirement` 类型别名 |
| `WorkItemStatus` | `Requirement['status']` |
| `WorkbenchSnapshot` | `WorkbenchSummary` 别名 |
| `WorkContextKind` | repository / link / person / milestone |
| `WORK_DOMAIN_MODULES` | 各域 label 与 `devCapabilities` 开关 |
| `isDevWorkDomain` / `getWorkDomainModule` | 开发域能力判定 helper |

---

## 6. 与 SQLite 字段对照

shared 使用 **camelCase**；server service 层从 snake_case 映射。

| Interface 字段 | SQLite 列（典型） |
|----------------|-------------------|
| `domain` | `domain` |
| `targetVersion` | `target_version` |
| `plannedReleaseAt` | `planned_release_at` |
| `actualReleaseAt` | `actual_release_at` |
| `defaultBranch` | `default_branch` |
| `currentBranch` | `current_branch` |
| `lastCommit` / `lastCommitAuthor` / `lastCommitAt` | `last_commit` / `last_commit_author` / `last_commit_at` |
| `isDirty` | `is_dirty` (0/1) |
| `techTags` / `envScripts` | `tech_tags` / `env_scripts` (JSON text) |
| `feishuOpenId` | `feishu_open_id` |
| `requirementId` | `requirement_id` |
| `managementRole` | `management_role` |
| `roleType` | `role_type` |
| `dueAt` / `aiStatus` / `aiResultType` | `due_at` / `ai_status` / `ai_result_type` |
| `isUrgent` | `is_urgent` (0/1) |
| `recurringTaskId` | `recurring_task_id` |
| `htmlContent` | `html_content` |
| `isMerged` | `is_merged` (0/1) |
| `timeOfDay` / `dayOfWeek` / `dayOfMonth` | `time_of_day` / `day_of_week` / `day_of_month` |
| `nextTriggerAt` | `next_trigger_at` |
| `messageCount` | service 层聚合计算 |

**不在 shared 建模**：`settings` KV、`scan_snapshots.payload` 内部结构、`recurring_task_runs` 运行记录（ScanResult / 助手上下文为 API 层 DTO）。

完整表结构见 [../server/ARCHITECTURE.md](../server/ARCHITECTURE.md) 数据模型章节。

---

## 7. 图谱、对话与助手协议

### 7.1 关系图谱

```typescript
GraphNode   { id, type: GraphNodeType, label, meta? }
GraphEdge   { id, source, target, label }
RequirementGraph { requirementId: number | null, nodes, edges }
```

- `id` 为 string（server 生成，如 `req-1`, `repo-3`）
- `meta` 可选键值，供 GraphPage Tooltip 等

### 7.2 开发域对话助手

```typescript
NavigationAction { type: NavigationActionType, payload?: Record<string, string | number | boolean> }
ChatMessage      { role: 'user' | 'assistant', content, action? }
```

**payload 约定**（跨端事实标准，非 TS 强制）：

| action.type | payload 键 |
|-------------|------------|
| `openRequirementDetail` | `requirementId: number` |
| `openGraph` | `requirementId?: number` |
| `filterRequirements` | `riskOnly?`, `keyword?`, `status?`, `beforeTesting?`, `personId?`, `repositoryId?`, `releaseFrom?`, `releaseTo?` |
| `openWorkbench` / `openScanCenter` | 通常无 payload |

### 7.3 个人域对话助手

```typescript
PersonalAssistantResult {
  reply, refresh?, modifyTodoId?, modifyVersion?
}
PersonalAssistantRefresh = 'todos' | 'schedule' | 'recurringTasks' | 'summary' | 'all'
PersonalAssistantSoulSettings { tone, customInstructions }
PersonalAssistantBlockedEvent { type: 'blocked', code, message }
GuardrailBlocked { blocked: true, layer, code, message }
```

SSE 事件与上述类型对齐：`text` / `refresh` / `modifyMode` / `blocked` / `error` / `done`。

### 7.4 个人助手五层契约（assistant-contract.ts）

| 层 | 核心类型 | 冻结常量 |
|----|----------|----------|
| IntentRouter | `PersonalIntentType`, `IntentSlot`, `IntentRouteResult` | — |
| ToolRegistry | `PersonalToolName`, `ToolDefinition`, `ToolInvokeResult` | `PERSONAL_INTENT_TOOL_MAP` |
| GuardrailEngine | `GuardrailLayer`, `GuardrailVerdict` | — |
| ContextRetriever | `AssistantContext`, `ExternalSnippet` | — |
| MetricsLedger | `MetricEvent`, `MetricsLedger` | — |
| 编排 | `PersonalOrchestrator`, `PersonalOrchestratorInput/Output` | — |

**PersonalToolName**（F0）：`todo.create`, `todo.revise_ai`, `schedule.create_local`, `recurring.create`, `recurring.materialize`, `mcp.feishu.get_doc`。

**PersonalIntentType**（F0）：`schedule`, `todo`, `recurring`, `recurring_schedule`, `revise_ai`, `unknown`。

### 7.5 通用 helper

| 文件 | 能力 |
|------|------|
| `work-model.ts` | `WORK_DOMAIN_MODULES`, `isDevWorkDomain`, `getWorkDomainModule` |
| `feishu.ts` | `resolveFeishuOpenId`, `getFeishuChatDeepLink`（`lark://` 协议） |
| `report-week-range.ts` | `getReportWeekRange(referenceDate?)` |

---

## 8. 构建与发布

**package.json exports**：

```json
".": {
  "types": "./dist/index.d.ts",
  "import": "./dist/index.js"
}
```

**tsconfig**：`declaration: true`，`outDir: dist`，`moduleResolution: bundler`

**脚本**：

| 命令 | 作用 |
|------|------|
| `pnpm build` | `tsc` → `dist/` |
| `pnpm dev` | `tsc --watch` |

Monorepo 根 `pnpm build` 顺序：**shared → server → client**。

---

## 9. 刻意不在 shared 的内容

| 内容 | 所在位置 | 原因 |
|------|----------|------|
| `AppRouter` | `server/src/trpc/router.ts` | tRPC 路由与 shared 领域解耦 |
| Zod schema | server router / assistant tools | 运行时校验属 server |
| DB row 类型 | server service 内部 | 避免泄漏持久化细节 |
| 助手实现类 | `server/src/assistant/*.ts` | 契约在 shared，逻辑在 server |
| UI 专用 props | client components | 展示层类型 |
| `projects` / `apps` 模型 | 未实现 | 见 PLATFORM_PLAN |

---

## 10. 实现状态

**实现状态**：[../IMPLEMENTATION_STATUS.md](../IMPLEMENTATION_STATUS.md)。类型定义见 `shared/src/types.ts` 与 `assistant-contract.ts`。

扩展新实体时：先在 `types.ts` 定义 interface + enum，再向下游 server/client 同步。

---

## 11. 关键文件索引

```
src/types.ts              领域模型、协议、标签常量（主文件）
src/assistant-contract.ts 个人助手五层 F0 契约
src/work-model.ts         工作域抽象与 WorkItem 别名
src/feishu.ts             飞书 open_id / deep link helper
src/report-week-range.ts  周报周期 helper
src/index.ts              导出入口
package.json              exports 与 workspace 包名
tsconfig.json             编译选项
dist/index.d.ts           消费方类型解析目标
```
