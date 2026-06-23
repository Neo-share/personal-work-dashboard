---
name: workflow-driven-requirements
description: 强制按 agents/workflow.md 的 S0-S5 状态机执行需求。用户说「按工作流」「S0-S5」「走控制层」时启用。
---

# 需求按工作流执行

> 工作流细则见 [agents/workflow.md](../../agents/workflow.md)；命令见 [agents/commands-checklist.md](../../agents/commands-checklist.md)。勿在本 Skill 复制全文。

1. 读取 `AGENTS.md`、`agents/workflow.md`、`agents/engineering-rules.md`。
2. S0 确认上下文。
3. S1 输出 Spec，并按任务复杂度等待确认。
4. S2 输出任务计划、预计改动文件和验证命令，并完成 G.2 范围确认。
5. S3 在确认范围内实施。
6. S4 执行 `pnpm agent:s4:mechanical-loop` 与 `pnpm agent:gate`（见 commands-checklist）。
7. S5 交付报告包含计划 vs 实际、验证结果和残余风险。
