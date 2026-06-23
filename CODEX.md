# Codex 入口摘要

> 权威映射见 [AGENTS.md §文档映射](./AGENTS.md#2-文档映射ssot)。本文件为**入口**，细则见链接文档。

先读 `AGENTS.md`，再按 `agents/README.md` 进入控制层。

## 执行规则

- 修改代码：S0 → S1 → S2 → S3 → S4 → S5（见 [agents/workflow.md](./agents/workflow.md)）。
- S1/S2 默认等待用户确认；S3 写入前必须确认具体路径。
- 改动后固定执行（见 [agents/commands-checklist.md](./agents/commands-checklist.md)）：

```bash
pnpm agent:scope:auto
pnpm agent:scope:<scope>
pnpm agent:gate
```

- CI 只验证，不自动修代码、不 commit、不写回分支。
- gate 未绿不得宣称完成。

## Scope

见 **[agents/project-baseline.md §Scope 映射](./agents/project-baseline.md)**（唯一来源）。
