# Agent 控制层导航

本目录是 Agent 执行控制层。文档索引见根目录 [AGENTS.md §2](../AGENTS.md#2-文档索引)。

**细则不在本文件重复**：工作流见 `workflow.md`；工程约束见 `engineering-rules.md`；命令见 `commands-checklist.md`。

## 阅读路径

### 新需求或跨包改动

1. `workflow.md`
2. `project-baseline.md`
3. `engineering-rules.md`
4. `agent-orchestration.tasks.yaml`
5. 对应 `tasks/*.tasks.yaml`

### 修 Bug 或小改动

1. `engineering-rules.md`
2. `commands-checklist.md`
3. `pitfalls.md`
4. 必要时读取对应包的 `AGENTS.md`

### 多 Agent / worktree 协作

1. `workflow.md`
2. `.cursor/rules/worktree.mdc`
3. `agent-orchestration.tasks.yaml`

## 机读入口

- 总入口：`agents/agent-orchestration.tasks.yaml`
- 前端任务：`agents/tasks/web.tasks.yaml`
- 后端任务：`agents/tasks/api.tasks.yaml`
- 共享类型任务：`agents/tasks/shared.tasks.yaml`

改代码后的校验顺序见 **[commands-checklist.md](./commands-checklist.md)**。
