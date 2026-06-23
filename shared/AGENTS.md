# Shared AGENTS.md

> **读者优先级：AI Agent > 人类开发者**
>
> 修改 `shared/` 时先读本文件，架构细节见同目录 `ARCHITECTURE.md`。Monorepo 总览与 SSOT 映射见根目录 [../AGENTS.md](../AGENTS.md#2-文档映射ssot)。

---

## 1. 包职责

`@project-manager/shared`：前后端共享的**领域与协议单一真相源**。导出 TypeScript 类型、枚举联合、中文标签常量，以及少量跨端通用 helper（飞书 deep link、周报周期、工作域模型）。

**负责**：实体 interface、视图 DTO、图谱/对话协议类型、枚举中文标签。

**不负责**：SQL、API 路由、UI、AppRouter 类型（AppRouter 在 `server/src/trpc/router.ts`，client 跨包引用）。

---

## 2. 快速定位

| 目标 | 文件 |
|------|------|
| 新增/修改实体字段 | `src/types.ts` |
| 新增枚举或联合类型 | `src/types.ts` |
| 新增中文标签常量 | `src/types.ts`（与 enum 同文件） |
| 工作域模块抽象 | `src/work-model.ts` |
| 飞书 OpenID / DeepLink 解析 | `src/feishu.ts` |
| 周报默认周期计算 | `src/report-week-range.ts` |
| 导出入口 | `src/index.ts`（统一 re-export） |
| 构建配置 | `tsconfig.json`, `package.json` |

---

## 3. 目录结构

```
shared/
├── AGENTS.md
├── ARCHITECTURE.md
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts               统一导出入口
│   ├── types.ts               领域类型与标签常量
│   ├── work-model.ts          工作域模块抽象
│   ├── feishu.ts              飞书 open_id 与 deep link helper
│   └── report-week-range.ts   周报时间范围 helper
└── dist/             tsc 产物（gitignore 或构建生成）
```

---

## 4. 消费方与同步义务

改 `shared` 后**必须同步**：

| 变更类型 | server | client |
|----------|--------|--------|
| 实体字段 | `db/schema.ts` + service `mapXxx` + router Zod | 相关 Page 展示/表单 |
| 新 enum 值 | router Zod `.enum([...])` + seed 若需 | Select/Tag 选项 + `labels.ts` 若扩展 |
| `NavigationActionType` | `assistant-service.ts` | `useNavigationAction.ts` |
| 新 interface（API 返回） | service 返回形状对齐 | tRPC 消费处类型自动跟随 |

**包依赖**：`client`、`server` 均通过 `"@project-manager/shared": "workspace:*"` 引用；**禁止** shared 依赖 client/server。

---

## 5. 编码约束

硬性约束见 **`.cursor/rules/shared.mdc`**、**`.cursor/rules/project-core.mdc`** 与 **[agents/engineering-rules.md](../agents/engineering-rules.md)**（唯一来源，本处不重复）。

---

## 6. 已知陷阱

| 陷阱 | 说明 | 处理 |
|------|------|------|
| **须先 build** | client/server 读 `dist/` | dev 时 `pnpm dev` 会 watch；单独改 shared 后跑 `pnpm --filter @project-manager/shared build` |
| **标签不完整** | 新增 enum 值未加 LABELS | TypeScript 会报 `Record<X, string>` 缺键 |
| **client 额外 labels** | `client/src/utils/labels.ts` 封装 direction 等 | 新 enum 若 UI 需要，同步扩展 labels.ts |
| **Zod 重复** | server router 手写 enum 列表 | 改 shared enum 时必须改 router Zod |
| **无 DB 类型生成** | 非 Prisma/Drizzle | 字段映射靠 server service 手工维护 |

---

## 7. 常见任务

### 7.1 给 Requirement 加字段

1. `src/types.ts` — `Requirement` interface 加属性
2. `../server/src/db/schema.ts` — 加列
3. `../server/src/services/requirement-service.ts` — SQL + `mapRequirement`
4. `../server/src/trpc/router.ts` — create/update Zod
5. `../client` — 列表/详情展示
6. `pnpm build`

### 7.2 新增 enum 值（如 RequirementStatus）

1. `src/types.ts` — 扩展联合类型 + `REQUIREMENT_STATUS_LABELS` 新键
2. `../server/src/trpc/router.ts` — 所有相关 `z.enum([...])`
3. `../client` — Select 选项（若硬编码）与 Tag 展示
4. seed 数据若用到该状态 — 改 `../server/src/db/seed.ts`

### 7.3 新增 NavigationAction 类型

1. `src/types.ts` — `NavigationActionType` 联合 + 文档注释 payload 含义
2. `../server/src/services/assistant-service.ts` — 产生新 action
3. `../client/src/hooks/useNavigationAction.ts` — switch 新 case

### 7.4 新增聚合/视图类型（仅类型，无新表）

1. `src/types.ts` — 如新的 `XxxSummary` interface
2. `../server` — service 返回该形状
3. `../client` — 消费 tRPC 结果

### 7.5 新增跨端 helper（非业务逻辑）

1. 优先放 `src/feishu.ts`、`src/report-week-range.ts`、`src/work-model.ts`
2. 保持纯函数、无 I/O、无第三方依赖
3. 在 `src/index.ts` 暴露并同步 client/server 调用点

---

## 8. 本地开发

见 **[agents/commands-checklist.md](../agents/commands-checklist.md)**。构建顺序：`shared` 必须在 `server`、`client` 之前（根 `pnpm build` 已保证）。

---

## 9. 延伸阅读

| 文档 | 用途 |
|------|------|
| `shared/ARCHITECTURE.md` | 类型体系、实体关系、与 DB 映射对照 |
| `../server/AGENTS.md` | schema / service / Zod 同步 |
| `../client/AGENTS.md` | UI 展示与 labels |
| `../ARCHITECTURE.md` | 全栈集成 |
| `../PROJECT_MANAGER_PRODUCT_DESIGN.md` | 领域语义（需求为中心、角色含义） |
