# S2 任务计划模板

> 模板文件。工作流阶段见 [workflow.md](./workflow.md)；验证命令见 [commands-checklist.md](./commands-checklist.md)。

## 需求摘要

- 目标：
- 非目标：
- 验收标准：

## Scope

- 预计 scope：
- 触发原因：

## 预计改动文件

- `path/to/file`

## 实施步骤

1. 
2. 
3. 

## 验证计划

```bash
pnpm agent:scope:auto
pnpm agent:scope:<scope>
pnpm agent:gate
```

## 回滚思路

- 只回滚本任务新增或修改的文件。
- 不回滚用户已有改动。

## G.2 范围确认

进入 S3 前，等待用户确认以上预计改动文件。
