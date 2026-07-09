# Agent 常见误区

> Agent 执行陷阱清单。工程约束见 [engineering-rules.md](./engineering-rules.md)。

## 误把计划当完成

只写完代码不等于完成。必须执行 scope 校验和 `pnpm agent:gate:dev`（日常）；提 PR 前另须 `pnpm agent:gate`。失败时不能宣称完成。

## 忽略已有脏工作区

当前工作树可能有用户改动。Agent 只能修改本任务相关内容，不得回滚或覆盖无关改动。

## 跨包依赖反向

`shared` 不能依赖 `client` 或 `server`。`client` 引用 `server/src/trpc/router` 仅用于 AppRouter 类型。

## Router 写业务逻辑

后端 router 只做 Zod input 并调用 service。SQL 和业务逻辑放在 service。

## Shared 放运行时逻辑

`shared/` 只维护类型、联合类型和标签常量，不添加第三方 runtime 依赖。

## Schema 改动忘记 DB

本项目无 migration。改 `server/src/db/schema.ts` 后，需要删除 `server/data/project-manager.db` 重启或手动迁移。

## 前端样式偏离项目

优先复用 `global.css` 中的布局 class 和 Ant Design 组件。CSS 实现时不要使用与 flex 搭配的 `gap` 属性。
