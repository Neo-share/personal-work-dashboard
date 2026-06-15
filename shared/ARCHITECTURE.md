# Shared ARCHITECTURE.md

> **读者优先级：AI Agent > 人类开发者**
>
> 共享类型包架构参考。操作指南见 `AGENTS.md`；全栈视图见 `../ARCHITECTURE.md`。

---

## 1. 在系统中的位置

```mermaid
flowchart LR
  Types[shared/types.ts]
  Server[server services]
  Client[client pages]
  DB[(SQLite)]

  Types -.->|import 类型| Server
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

**设计原则**：shared 定义「是什么」；server 定义「怎么存、怎么算」；client 定义「怎么展示」。AppRouter **不在** shared 中。

---

## 2. 模块结构

```
src/
├── index.ts     export * from './types.js'
└── types.ts     全部导出（单文件域模型）
```

**为何单文件**：MVP 规模下类型集中便于 AI 与人类检索；拆文件时在 `index.ts` 聚合导出即可。

---

## 3. 类型分层

```mermaid
flowchart TB
  subgraph Enums["枚举 / 联合类型"]
    RS[RequirementStatus]
    P[Priority]
    CD[CollaborationDirection]
    MR[ManagementRole]
    PCS[PersonCollaborationStatus]
    MS[MilestoneStatus]
    GNT[GraphNodeType]
    NAT[NavigationActionType]
  end

  subgraph Entities["实体"]
    Req[Requirement]
    Repo[Repository]
    Per[Person]
    RR[RequirementRepository]
    RP[RequirementPerson]
    Mil[Milestone]
    Lnk[Link]
  end

  subgraph Aggregates["聚合 / 视图"]
    RD[RequirementDetail]
    WS[WorkbenchSummary]
    SR[ScanResult]
    RG[RequirementGraph]
  end

  subgraph Protocol["跨端协议"]
    NA[NavigationAction]
    CM[ChatMessage]
  end

  subgraph Labels["中文标签常量"]
    RSL[REQUIREMENT_STATUS_LABELS]
    PL[PRIORITY_LABELS]
  end

  Enums --> Entities
  Entities --> Aggregates
  Enums --> Labels
  Enums --> Protocol
```

---

## 4. 枚举与标签

### 4.1 带中文标签的枚举

| 类型 | 值 | 标签常量 |
|------|-----|----------|
| `RequirementStatus` | pending_review … paused（7 个） | `REQUIREMENT_STATUS_LABELS` |
| `Priority` | high, medium, low | `PRIORITY_LABELS` |

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
| `NavigationActionType` | 助手导航动作 |

---

## 5. 实体模型

### 5.1 核心实体

| Interface | 说明 | 主键 |
|-----------|------|------|
| `Requirement` | 需求主体 | id |
| `Repository` | Git 仓库资产 | id |
| `Person` | 人员主数据 | id |

### 5.2 关联实体

| Interface | 关系 |
|-----------|------|
| `RequirementRepository` | Requirement ↔ Repository M:N 属性 |
| `RequirementPerson` | Requirement ↔ Person M:N 属性 |
| `Milestone` | Requirement 1:N |
| `Link` | Requirement 1:N 外部链接 |

### 5.3 聚合类型

| Interface | 组成 |
|-----------|------|
| `RequirementDetail` | Requirement + repositories[]（含嵌套 Repository）+ people[]（含嵌套 Person）+ milestones[] + links[] |
| `WorkbenchSummary` | 四个 Requirement[] 分区 + 计数统计 |
| `ScanResult` | scannedAt + repositoryCount + Repository[] |
| `RequirementGraph` | requirementId? + GraphNode[] + GraphEdge[] |

---

## 6. 与 SQLite 字段对照

shared 使用 **camelCase**；server service 层从 snake_case 映射。

| Interface 字段 | SQLite 列（典型） |
|----------------|-------------------|
| `targetVersion` | `target_version` |
| `plannedReleaseAt` | `planned_release_at` |
| `defaultBranch` | `default_branch` |
| `isDirty` | `is_dirty` (0/1) |
| `techTags` | `tech_tags` (JSON text) |
| `requirementId` | `requirement_id` |
| `managementRole` | `management_role` |
| `roleType` | `role_type` |

**不在 shared 建模**：`settings` KV、`scan_snapshots` 内部 payload 结构（ScanResult 为 API 层 DTO）。

完整表结构见 `../server/ARCHITECTURE.md § 数据模型`。

---

## 7. 图谱与对话协议

### 7.1 关系图谱

```typescript
GraphNode   { id, type: GraphNodeType, label, meta? }
GraphEdge   { id, source, target, label }
RequirementGraph { requirementId: number | null, nodes, edges }
```

- `id` 为 string（server 生成，如 `req-1`, `repo-3`）
- `meta` 可选键值，供 GraphPage  Tooltip 等

### 7.2 对话助手

```typescript
NavigationAction { type: NavigationActionType, payload?: Record<string, string | number | boolean> }
ChatMessage      { role: 'user' | 'assistant', content, action? }
```

**payload 约定**（非 TS 强制，跨端事实标准）：

| action.type | payload 键 |
|-------------|------------|
| `openRequirementDetail` | `requirementId: number` |
| `openGraph` | `requirementId?: number` |
| `filterRequirements` | `riskOnly?: boolean`, `keyword?: string` |
| `openWorkbench` / `openScanCenter` | 通常无 payload |

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
| Zod schema | server router | 运行时校验属 server |
| DB row 类型 | server service 内部 | 避免泄漏持久化细节 |
| UI 专用 props | client components | 展示层类型 |
| `projects` / `apps` 模型 | 未实现 | 见 PLATFORM_PLAN |

---

## 10. 规划 vs 实现

完整对照见 **[../IMPLEMENTATION_STATUS.md](../IMPLEMENTATION_STATUS.md)**。

| 规划类型 | 状态 |
|----------|------|
| 当前 MVP 实体与协议 | ✅ |
| `projects`, `apps`, `requirement_apps` | ❌ |
| `dependencies` | ❌ |
| `chat_sessions` 持久化类型 | ❌ |
| 外部系统 link type 枚举 | ❌ |

扩展新实体时：先在本包定义 interface + enum，再向下游 server/client 同步。

---

## 11. 关键文件索引

```
src/types.ts      领域模型、协议、标签常量（主文件）
src/index.ts      导出入口
package.json      exports 与 workspace 包名
tsconfig.json     编译选项
dist/index.d.ts   消费方类型解析目标
```
