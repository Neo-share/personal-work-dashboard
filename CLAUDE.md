# Claude Code 入口

> 权威映射见 [AGENTS.md §文档映射](./AGENTS.md#2-文档映射ssot)。本文件为**入口**，不重复定义 workflow 细则。

进入任务前先读取 `AGENTS.md`。项目级执行规范以 `agents/workflow.md` 和 `agents/engineering-rules.md` 为准。

## 必须遵守

1. 会修改代码时按 [agents/workflow.md](./agents/workflow.md) 的 S0–S5 推进。
2. S1/S2 默认须人类确认。
3. S3 写入前必须完成 G.2 改动范围确认。
4. 改代码后执行 `pnpm agent:scope:auto` → `pnpm agent:scope:<scope>`（见 [commands-checklist](./agents/commands-checklist.md)）。
5. 完成前执行 `pnpm agent:gate`，exit 0 才能宣称完成。
6. 不自动 commit，不回滚用户已有改动。

## 项目速查

- 前端：`client/AGENTS.md`
- 后端：`server/AGENTS.md`
- 共享类型：`shared/AGENTS.md`
- 机读任务：`agents/agent-orchestration.tasks.yaml`
