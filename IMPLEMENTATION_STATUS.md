# 实现状态对照（计划书 vs 代码）

> **SSOT**：计划书与当前代码的**唯一对照来源**。权威映射见 [AGENTS.md §2.1](./AGENTS.md#21-权威映射表)。
>
> **读者优先级：AI Agent > 人类开发者**
>
> 对照 [PROJECT_MANAGER_PLATFORM_PLAN.md](./PROJECT_MANAGER_PLATFORM_PLAN.md) 与 [PROJECT_MANAGER_PRODUCT_DESIGN.md](./PROJECT_MANAGER_PRODUCT_DESIGN.md)，以**当前代码**为准。最后核对日期：2026-06-12。

**图例**：✅ 已实现 · ⚠️ 部分实现 · ❌ 未实现

---

## 1. 分阶段总览

| 阶段 | 计划目标 | 状态 | 说明 |
|------|----------|------|------|
| **第一阶段 MVP** | 独立应用、扫描、SQLite、列表/详情、基础 CRUD | ✅ | 全部关单；`projects` 实体留第三阶段 |
| **第二阶段** | 图谱编辑、assistant-ui、人员视图、dependencies | ⚠️ | 只读图谱与规则对话已提前落地 |
| **第三阶段** | monorepo 子应用、环境/标签增强、助手结构化问答 | ⚠️ | 技术标签与环境脚本已有；子应用识别未做 |
| **第四阶段** | YApi/Sentry/Figma/CI/飞书等外部集成 | ❌ | 仅 `links` 表手工存 URL |

---

## 2. 第一阶段 MVP（详细对照）

> 计划来源：[PROJECT_MANAGER_PLATFORM_PLAN.md § 第一阶段 MVP：以需求为中心](./PROJECT_MANAGER_PLATFORM_PLAN.md)  
> 产品语义：[PROJECT_MANAGER_PRODUCT_DESIGN.md § 管理对象粒度](./PROJECT_MANAGER_PRODUCT_DESIGN.md)  
> **阶段目标**：MVP = **以需求为中心**的完整闭环（本体 CRUD + 关联 + 工作台 + 列表筛选）；仓库扫描与配置为需求提供上下文，同属第一阶段。

### 2.1 计划 vs 实现：语义差异

| 计划书表述 | 当前实现 | 说明 |
|------------|----------|------|
| 项目列表 / 项目详情 | **需求列表** / **需求详情** | 以 `requirements` 为管理主轴，符合产品设计「以我的需求为中心」 |
| `projects` 表 | 无；用 `repositories` 代替 | 仓库资产页承担「项目总览」部分能力；monorepo 子应用留第三阶段 |
| 基础 CRUD | 创建/编辑/删除 ✅；关联增删 ✅ | 需求编辑/删除在详情页；人员 CRUD 在 `/people` |

### 2.2 实施任务清单（计划书 § 实施任务 · 第一阶段范围）

| # | 任务 | 状态 | 实现位置 / 缺口 |
|---|------|------|-----------------|
| 1 | 独立本地 Web 应用，不侵入业务仓库 | ✅ | `project-manager/` monorepo（`client` / `server` / `shared`） |
| 2 | 初始化 React + Vite + TS 前端 | ✅ | `client/`；Ant Design 5 + React Router |
| 3 | 初始化 Node 本地 API | ✅ | `server/`；Fastify + tRPC |
| 4 | SQLite 核心表 | ⚠️ | `server/src/db/schema.ts`：8 张表 ✅；**`projects` / `apps` ❌**（非 MVP 必需，但计划书有列） |
| 5 | 工作区仓库扫描器 | ⚠️ | `server/src/scanner/workspace-scanner.ts`；**仅一级目录 `.git`** |
| 6 | 采集 Git 信息 | ✅ | remote / branch / dirty / last commit（simple-git） |
| 7 | 采集 package.json 技术标签 | ✅ | `detectTechTags`（Vue2/3、Vite、React、TS 等） |
| 8 | 采集 scripts 环境脚本 | ✅ | `detectEnvScripts`（dev/sit/uat/prod/gray） |
| 9 | 我的工作台页面 | ✅ | `MyWorkbenchPage` + `workbench.summary` |
| 10 | 需求列表页面 | ✅ | `RequirementsPage`；多维筛选（状态/人员/仓库/上线窗口/风险/未提测） |
| 11 | 需求详情页面 | ✅ | `RequirementDetailPage`；字段编辑 Modal ✅；关联 CRUD ✅ |
| 12 | 需求关联仓库 CRUD | ✅ | `addRepository` / `removeRepository` + UI Modal |
| 13 | 需求关联人员 CRUD | ✅ | `addPerson` / `removePerson` + 上游/下游 Modal |
| 14 | 里程碑 CRUD | ✅ | 新增/编辑/删除 ✅；`updateMilestone` API + UI |
| 15 | 外部链接 CRUD | ✅ | `addLink` / `removeLink` |
| 16 | 仓库资产列表 + 反查并行需求 | ✅ | `RepositoriesPage` + `repositories.requirements` |
| 17 | 人员主数据 | ✅ | `PeoplePage` 列表 + 新增/编辑/删除 ✅ |
| 18 | 扫描中心 | ✅ | `ScanCenterPage`；扫描 + 快照 + **异常仓库列表** ✅ |
| 19 | 工作区路径与忽略目录 | ✅ | `SettingsPage`；`workspace_path` + `scan_ignore_dirs` |
| 20 | 扫描快照持久化 | ✅ | `scan_snapshots` 表 + `latestScan` |
| 21 | 重新扫描不覆盖人工字段 | ✅ | 见 §2.7 字段分层；仓库 UPSERT 仅扫描列 |
| 22 | CodeLab 全量扫描验证 | ⚠️ | 需用户手动触发；默认路径 `/Users/ningliu/Documents/CodeLab` |

**第二阶段才纳入、当前已提前落地（骨架）**：

| 项 | 状态 | 位置 |
|----|------|------|
| 关系图谱（只读） | ⚠️ | `GraphPage` + `graph.get` |
| 对话助手 FAB | ⚠️ | `ChatPanel` + `/api/chat` SSE；规则引擎，非 assistant-ui |

### 2.3 第一阶段页面与 API 矩阵

| 页面 | 路由 | 读 | 写（前端） | 写（后端 API） |
|------|------|----|-----------|---------------|
| 我的工作台 | `/` | ✅ | — | — |
| 需求列表 | `/requirements` | ✅ | 新建 ✅ | `create` ✅ · 编辑/删除在详情页 ✅ |
| 需求详情 | `/requirements/:id` | ✅ | 编辑/删除/关联增删 ✅ | `update` · `delete` · 关联 mutation ✅ |
| 仓库资产 | `/repositories` | ✅ | — | — |
| 关联人员 | `/people` | ✅ | 新增/编辑/删除 ✅ | `create` · `update` · `delete` ✅ |
| 扫描中心 | `/scan` | ✅ | 触发扫描 ✅ | `scanWorkspace` ✅ |
| 配置中心 | `/settings` | ✅ | 路径 + 忽略目录 ✅ | `settings.*` ✅ |

**tRPC Router 一览（第一阶段相关）**：`settings` · `workbench` · `requirements` · `repositories` · `people`（`graph` 为第二阶段提前落地）。

### 2.4 第一阶段数据模型

| 表 | MVP 必需 | 状态 | 字段对齐 |
|----|----------|------|----------|
| `settings` | ✅ | ✅ | `workspace_path`、`scan_ignore_dirs`（JSON 数组） |
| `repositories` | ✅ | ✅ | 含 tech_tags / env_scripts JSON |
| `requirements` | ✅ | ✅ | status / priority / risk / blockers / 上线窗口 |
| `requirement_repositories` | ✅ | ✅ | 职责 / 分支 / 环境 / 状态 / 风险 |
| `requirement_people` | ✅ | ✅ | direction / managementRole / roleType / status |
| `milestones` | ✅ | ✅ | `updateMilestone` API ✅ |
| `links` | ✅ | ✅ | type 自由 string |
| `people` | ✅ | ✅ | `update` / `delete` ✅ |
| `scan_snapshots` | ✅ | ✅ | payload 存完整扫描 JSON |
| `projects` | 计划有 | ❌ | 第三阶段前以 repositories 代替 |

### 2.5 第一阶段验收标准

| 验收项（摘自计划书，限定 MVP 范围） | 状态 | 备注 |
|--------------------------------------|------|------|
| 打开平台后从「我的工作台」查看待推进/风险/上线需求 | ✅ | 四象限 + 统计卡片 |
| 进入需求详情，查看关联仓库/人员/里程碑/链接/风险 | ✅ | 无 apps 维度 |
| 查看工作区所有仓库，反查每个仓库并行需求 | ✅ | 需先执行扫描 |
| 展示自动采集 + 人工维护信息 | ✅ | 仓库侧 ✅；需求字段可编辑 ✅ |
| 可视化新增需求及关联（仓库/人员/里程碑/链接） | ✅ | |
| 可视化编辑/删除需求本体 | ✅ | 详情页 Modal + Popconfirm |
| 可视化编辑/删除人员 | ✅ | `PeoplePage` |
| 重新扫描不破坏需求关联数据 | ✅ | 关联表独立；仓库 UPSERT |
| 独立配置页设置工作区路径 | ✅ | `/settings` |

### 2.6 第一阶段后续（非 MVP，留第三阶段）

| 项 | 说明 |
|----|------|
| `projects` / `apps` 实体 | 与 monorepo 子应用识别一并规划 |

### 2.7 自动扫描 vs 人工字段分层

| 实体 | 自动扫描字段（UPSERT 覆盖） | 人工维护字段（扫描不触碰） |
|------|----------------------------|---------------------------|
| `repositories` | path, remote, branch, last_commit, is_dirty, tech_tags, env_scripts, scanned_at | 无独立人工列；名称以目录名为准 |
| `requirements` 及关联表 | — | 全部字段由 UI / API 维护，扫描不写 |
| `requirement_repositories` | — | 职责、分支、环境、状态、风险等 |
| 扫描配置 | — | `settings.workspace_path`、`settings.scan_ignore_dirs` |

**规则**：`runWorkspaceScan` 只对 `repositories` 表执行 `ON CONFLICT(name) DO UPDATE`，更新列限于上表「自动扫描字段」；`requirements` 及关联表与扫描流程完全隔离。

---

## 3. 六大核心能力（计划书 § 产品目标）

| 能力 | 状态 | 实现位置 / 缺口 |
|------|------|-----------------|
| 我的工作台 | ✅ | `MyWorkbenchPage` + `workbench.summary` |
| 需求总览 | ✅ | 列表/详情/CRUD ✅；多维筛选（状态/人员/仓库/上线窗口/风险/未提测） |
| 项目总览 | ⚠️ | **无 `projects` 表**；以 `repositories` 仓库资产代替；Git/标签/环境 ✅ |
| 上下游关系 | ⚠️ | `requirement_people` + 关系图谱 **只读**；无 `dependencies` 边模型 |
| 任务与里程碑 | ⚠️ | 里程碑 CRUD（需求详情内）✅；无独立「任务」实体 |
| 可视化 CRUD | ⚠️ | 需求/人员/关联/里程碑 CRUD ✅；**图谱编辑 ❌** |
| 对话式导航 | ⚠️ | SSE + 规则引擎 ✅；**assistant-ui、LLM、会话持久化 ❌** |

---

## 4. 页面规划对照

| 计划页面 | 状态 | 路由 / 备注 |
|----------|------|-------------|
| 对话助手（全局） | ⚠️ | `ChatPanel` 全页 FAB；非 assistant-ui |
| 个人 AI 助手工作台 | ✅ | `/` · `PersonalWorkbenchPage` |
| 开发域工作台 | ✅ | `/dev-dashboard` · `MyWorkbenchPage` |
| 需求列表 | ✅ | `/requirements`；服务端 `list` 筛选 + URL 同步 |
| 需求详情 | ✅ | `/requirements/:id`；编辑/删除/关联 CRUD ✅ |
| 项目/仓库列表 | ⚠️ | `/repositories`；反查并行需求 ✅；无业务域筛选 |
| 关系图谱 | ⚠️ | `/graph`；只读 ReactFlow；**拖拽/编辑边 ❌** |
| 关联人员视图 | ⚠️ | `/people` 主数据 CRUD ✅；**按人员查需求、独立 Person 视图 ❌** |
| 扫描中心 | ✅ | `/scan`；扫描 + 快照 + 异常仓库列表 |
| 配置中心 | ✅ | `/settings`；`settings.setWorkspacePath` |

---

## 5. 数据模型对照

| 计划表/模型 | 状态 | 说明 |
|-------------|------|------|
| `repositories` | ✅ | `server/src/db/schema.ts` |
| `requirements` | ✅ | 字段基本对齐产品设计 |
| `requirement_repositories` | ✅ | |
| `requirement_people` | ✅ | 含 direction、managementRole、roleType |
| `milestones` | ✅ | |
| `links` | ✅ | type 为自由 string，无枚举 |
| `people` | ✅ | |
| `scan_snapshots` | ✅ | |
| `settings` | ✅ | `workspace_path`、`scan_ignore_dirs` |
| `projects` | ❌ | |
| `apps` | ❌ | |
| `requirement_apps` | ❌ | |
| `project_people` | ❌ | 用 `requirement_people` 替代 |
| `dependencies` | ❌ | 图谱边未持久化 |
| `chat_sessions` / `chat_messages` | ❌ | |
| `navigation_actions` | ❌ | 动作类型在 `shared` 代码内硬编码 |

---

## 6. 自动扫描对照

| 计划采集项 | 状态 | 说明 |
|------------|------|------|
| 一级目录 `.git` 仓库 | ✅ | `workspace-scanner.ts` |
| Git remote/branch/dirty/last commit | ✅ | simple-git |
| package.json 技术标签 | ✅ | `detectTechTags` |
| scripts 环境 dev/sit/uat/prod/gray | ✅ | `detectEnvScripts` |
| monorepo `apps/*`、`packages/*` | ❌ | 不递归子目录 |
| pnpm workspace / Nx 配置识别 | ❌ | |
| README/配置线索 | ❌ | |
| 扫描不覆盖人工字段 | ✅ | 见 §2.7；需求关联独立 |

---

## 7. 技术架构对照

| 计划项 | 状态 | 实际 |
|--------|------|------|
| React + Vite + TS + Ant Design | ✅ | |
| React Router | ✅ | |
| TanStack Query | ✅ | |
| tRPC + Fastify | ✅ | router 合并为 settings/workbench/requirements/graph/repositories/people |
| SQLite + better-sqlite3 | ✅ | 无 migration |
| `@xyflow/react` 图谱 | ⚠️ | 只读 |
| `assistant-ui` | ❌ | 自研 `ChatPanel` |
| Zustand | ❌ | |
| LLM / AI 编排 | ❌ | `assistant-service` 正则规则 |
| `/api/chat` SSE | ✅ | |
| pnpm monorepo | ✅ | client / server / shared |

---

## 8. 对话动作对照

| 计划动作 | 状态 | 当前 `NavigationActionType` |
|----------|------|----------------------------|
| openProjectDetail | ⚠️ | → `openRequirementDetail`（以需求为中心，非项目） |
| filterProjects | ⚠️ | → `filterRequirements` |
| openDependencyGraph | ⚠️ | → `openGraph` |
| openPersonView | ❌ | |
| openEditForm | ❌ | |
| triggerWorkspaceScan | ❌ | 仅 `openScanCenter` 跳转 |
| openWorkbench | ✅ | 计划外补充 |
| openScanCenter | ✅ | 计划外补充 |

### 产品设计典型 NL 查询

| 查询示例 | 状态 |
|----------|------|
| 打开某需求详情 | ✅ |
| 查看风险需求 | ✅ |
| 按仓库名筛需求 | ⚠️ keyword 模糊匹配 |
| coin-h5 并行需求 | ⚠️ 仓库页反查 ✅；对话 ⚠️ |
| 按人员（如王五）查需求 | ✅ | 列表筛选 + 对话 `personId` |
| 本周上线 / 未提测 | ✅ | `releaseFrom/To`、`beforeTesting` + 对话 |
| 上游/下游人员列表 | ❌ 对话未支持；详情页可看 |
| 关联 Figma/YApi | ❌ 对话未支持；links 可手工维护 |

---

## 9. 验收标准对照（计划书 § 验收标准）

| 验收项 | 状态 |
|--------|------|
| 工作台查看待推进/风险/上线需求 | ✅ |
| 需求详情看关联仓库/人员/里程碑/链接/风险 | ✅（无 apps） |
| 所有仓库 + 反查并行需求 | ✅ |
| 项目展示自动 + 人工信息 | ⚠️ 仓库有；无 project 实体 |
| 可视化 CRUD 人员/需求/关联/里程碑 | ⚠️ 缺图谱编辑 |
| 对话完成核心导航 | ⚠️ 部分意图 |
| 重新扫描不覆盖人工维护 | ✅ | §2.7 字段分层 |
| 关系图回答协作/并行/风险问题 | ⚠️ 只读展示，无交互分析 |

---

## 10. 实施任务清单（计划书 § 实施任务）

| 任务 | 状态 |
|------|------|
| 独立本地 Web 应用 | ✅ |
| 初始化 React + Node API | ✅ |
| SQLite 核心表 | ⚠️ 缺 projects/apps/dependencies/chat |
| 工作区扫描器 | ⚠️ 一级目录 |
| 工作台/需求/关联 CRUD 页面 | ⚠️ 见 §2 |
| 关系图谱 + 节点/边编辑 | ⚠️ 只读 |
| assistant-ui + 流式对话 | ❌ |
| CodeLab 全量扫描验证 | ⚠️ 需用户手动扫描 |

---

## 11. 建议优先级（文档维护用）

与 README「下一步」及计划第四阶段对齐：

| 优先级 | 项 | 理由 |
|--------|-----|------|
| P0 | assistant-ui 替换 ChatPanel | 计划明确（第二阶段） |
| P1 | 对话：按人员查询、openEditForm | 验收与 NL 查询 |
| P2 | 图谱边编辑 / dependencies 表 | 计划第二阶段 |
| P2 | monorepo 子应用（apps 模型） | 第三阶段 |
| P2 | DB migration | 工程化 |
| P3 | 外部系统 MCP/API（YApi/Figma/Sentry/飞书） | 第四阶段 |
| P3 | LLM 编排 | 计划架构项 |

---

## 13. 个人 AI 助手工作台（产品考题）

> 产品 SSOT：[docs/个人工作台/个人工作台.md](./docs/个人工作台/个人工作台.md)  
> L4 功能点：[个人工作台-功能点.md](./docs/个人工作台/个人工作台-功能点.md)  
> **TL4 技术对照与完成状态 SSOT**：[个人工作台-技术功能点.md §实现状态总览](./docs/个人工作台/个人工作台-技术功能点.md#实现状态总览)  
> **未完成待办**：[TODO/personal-workbench-enhancement.md](./TODO/personal-workbench-enhancement.md)  
> 五层契约：[shared/src/assistant-contract.ts](./shared/src/assistant-contract.ts) · [TODO/architecture-foundation.md](./TODO/architecture-foundation.md)

本节为**索引**，详细 ✅/⚠️/❌ 状态不在此重复维护。

| 模块 | 状态 | 说明 |
|------|------|------|
| TL1-01 ~ TL1-05、07、08 | ✅ | 见技术功能点各 TL1 节 |
| TL1-06 AI 结果 | ⚠️ | 轮询已接；LLM 生成待 Phase E |
| TL1-09 RAG | ❌ | Phase E 待做 |
| 外部日历 OAuth | ❌ | 范围外，见 personal-workbench-enhancement |
| MCP 外部文档 | ❌ | 见 `TODO/mcp-integration.md` |

---

## 12. 相关文档

| 文档 | 用途 |
|------|------|
| [PROJECT_MANAGER_PLATFORM_PLAN.md](./PROJECT_MANAGER_PLATFORM_PLAN.md) | 原始技术方案 |
| [PROJECT_MANAGER_PRODUCT_DESIGN.md](./PROJECT_MANAGER_PRODUCT_DESIGN.md) | 产品语义与示例 |
| [README.md](./README.md) | 人类可读简介 |
| [AGENTS.md](./AGENTS.md) | Agent 操作入口 |

**维护约定**：功能合并或新增后，同步更新本文件对应行的状态。
