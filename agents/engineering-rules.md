# Agent 工程硬约束

> 工程硬约束的定义文档。Cursor 规则 `.cursor/rules/project-core.mdc` 与之对齐。

## 文档优先级

1. `AGENTS.md`（含文档索引）
2. `agents/workflow.md` + 本文件
3. 其他 `agents/*`
4. `docs/*`：归档与产品需求，不作为执行规范

## 项目硬约束

- 包管理使用 pnpm workspace。
- TypeScript strict + ESM。
- 包依赖方向：`shared` ← `server`、`client`；`client` 仅可类型引用 `server/src/trpc/router`。
- 数据流：router Zod 校验 → service 业务与 SQL → shared 返回形状；前端通过 tRPC 消费并 invalidate 相关 query。
- 关联类 mutation 必须在 router 内调用 `touchRequirement(requirementId)`。
- 不自动 commit。只有用户明确要求提交时才执行 git commit。

## Scope 命名

见 **[project-baseline.md §Scope 映射](./project-baseline.md)**。

## 编码要求

- 前端：React 函数组件、Ant Design 5、tRPC + TanStack Query、中文 UI 文案。
- 后端：router 不写 SQL；service 负责业务和映射；相对 import 带 `.js` 后缀。
- Shared：只放类型与常量，不加 runtime 依赖。
- CSS 不使用与 flex 搭配的 `gap` 属性。
- 复杂逻辑或硬编码需要添加简短注释说明维护原因。

## 完成判定

见 **[commands-checklist.md §交付前 DoD](./commands-checklist.md)**。
