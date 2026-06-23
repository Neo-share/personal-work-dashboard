# 个人驾驶舱架构设计

> **SSOT**：工作项跨域演进的**设计定义**。类型与枚举权威来源：`shared/src/work-model.ts`、`shared/src/types.ts`（本文件不重复字段表）。
>
> 从「开发需求管理」演进为「个人全领域工作管理」的逻辑分层与迁移路径。

---

## 1. 设计目标

| 目标 | 说明 |
|------|------|
| **统一工作项模型** | 开发、生活、学习、事务等共用同一套 CRUD、状态、优先级、里程碑 |
| **工作域隔离能力** | 通过 `domain` 区分领域，非开发域不暴露 Git/仓库等专属能力 |
| **平滑演进** | 保留 `requirements` 表名与 tRPC 路由，避免大爆炸式重命名 |
| **可扩展上下文** | 链接、人员、里程碑为通用资产；仓库为开发域可选挂载 |

---

## 2. 概念分层

```
┌─────────────────────────────────────────────────────────┐
│  呈现层 (client)                                         │
│  驾驶舱 · 工作列表 · 详情 · 仓库/扫描/图谱（dev 能力）    │
└───────────────────────────┬─────────────────────────────┘
                            │ tRPC
┌───────────────────────────▼─────────────────────────────┐
│  应用层 (server/router + service)                        │
│  requirements.*  →  requirement-service                  │
│  workbench.*     →  跨域聚合快照                          │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│  领域模型 (shared/work-model.ts + types.ts)              │
│  WorkItem (= Requirement) · WorkDomain · WorkContextKind │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│  持久化 (SQLite)                                         │
│  requirements (+ domain) · links · milestones · people   │
│  requirement_repositories（仅 dev 域语义上使用）          │
└─────────────────────────────────────────────────────────┘
```

---

## 3. 核心抽象

### 3.1 工作项 `WorkItem`

- **定义**：个人范围内一条可跟踪的工作（名称、状态、优先级、风险、阻塞、备注、时间）。
- **实现**：`shared/src/work-model.ts` 中 `type WorkItem = Requirement`。
- **持久化**：`requirements` 表；新增列 `domain TEXT NOT NULL DEFAULT 'dev'`。

### 3.2 工作域 `WorkDomain`

| 值 | 标签 | 开发专属能力 |
|----|------|--------------|
| `dev` | 开发 | ✅ 仓库关联、扫描、图谱、分支备注 |
| `life` | 生活 | ❌ |
| `learning` | 学习 | ❌ |
| `admin` | 事务 | ❌ |
| `other` | 其他 | ❌ |

模块定义见 `WORK_DOMAIN_MODULES`；UI 用 `isDevWorkDomain(domain)` 控制区块显隐。

### 3.3 上下文资产 `WorkContextKind`

| 类型 | 表/关联 | 适用域 |
|------|---------|--------|
| `link` | `links` | 全域 |
| `person` | `requirement_people` | 全域（协作人） |
| `milestone` | `milestones` | 全域 |
| `repository` | `requirement_repositories` |  primarily `dev` |

### 3.4 工作台快照 `WorkbenchSnapshot`

- **定义**：跨工作域聚合的个人视图（进行中、阻塞、待评审、计划上线等）。
- **实现**：`WorkbenchSummary` 别名；当前统计仍以开发流程状态为主，后续可按 `domain` 分桶。

---

## 4. 数据流（不变）

见 [AGENTS.md §5 跨包数据流](./AGENTS.md#5-跨包数据流)（唯一来源）。

列表筛选新增 `domain`；创建/更新支持 `domain` 字段。

---

## 5. UI 约定

| 场景 | 行为 |
|------|------|
| 导航 | 「工作列表」替代「任务列表」 |
| 新建/编辑 | 必选工作域，默认 `dev` |
| 列表 | 工作域列 + 筛选 |
| 详情 | 展示工作域；非 `dev` 隐藏「关联仓库」「关系图」 |
| 通用 | 链接、里程碑、协作联系人全域可用 |

API 路由名仍为 `requirements.*`，避免 client/server 大面积重命名。

---

## 6. 迁移路径（未来）

### 阶段 A（当前）✅

- [x] `WorkDomain` + `domain` 列与迁移
- [x] `work-model.ts` 类型别名与模块定义
- [x] 列表/详情/创建支持工作域
- [x] 非 dev 域隐藏仓库 UI

### 阶段 B（可选）

- 工作台按 `domain` 分 Tab 或分指标
- 非 dev 域简化状态机（如 `todo / doing / done`），与开发状态并存或映射
- 助手意图识别工作域（`assistant-service`）

### 阶段 C（长期）

- 表重命名：`requirements` → `work_items`（视图或 migration 脚本）
- tRPC 命名空间：`workItems.*` 与 `requirements.*` 并存 deprecate
- 新上下文类型：日历事件、习惯打卡、文档片段等

---

## 7. 文件索引

| 层级 | 路径 |
|------|------|
| 领域模型 | `shared/src/work-model.ts`、`shared/src/types.ts` |
| Schema | `server/src/db/schema.ts`、`server/src/db/index.ts`（migrate） |
| 业务 | `server/src/services/requirement-service.ts` |
| API | `server/src/trpc/router.ts` |
| 列表/详情 | `client/src/pages/RequirementsPage.tsx`、`RequirementDetailPage.tsx` |
| 标签 | `client/src/utils/labels.ts` |

---

## 8. 本地验证

```bash
pnpm build
# 若 domain 列未自动迁移：删除 server/data/project-manager.db 后重启
pnpm dev
```

新建「生活」或「学习」域工作项，确认详情页无「关联仓库」区块；开发域行为与改造前一致。
