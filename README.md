# 个人驾驶舱

个人定制的本地工作管理平台，以「工作项」为中心，按工作域管理开发、生活、学习等个人工作；开发域把 CodeLab 工作区内的 Git 仓库、协作联系人与上线节奏串在一起，数据保存在本机。

## 能做什么

- **驾驶舱概览**：集中查看进行中的工作项、脏仓库、阻塞项与计划上线
- **工作管理**：维护状态、优先级、风险，以及关联的仓库、人员、里程碑和外部链接
- **仓库资产**：扫描工作区 Git 仓库，查看分支、提交、技术标签与环境脚本
- **关系图谱**：可视化工作项与仓库、人员、里程碑之间的关联
- **对话助手**：通过自然语言跳转页面、筛选工作项、打开详情或扫描中心
- **扫描中心**：对工作区执行 Git 扫描，更新仓库资产快照
- **个人工作台**：待办、日程、定时任务与个人助手（[交付说明](docs/个人工作台/个人工作台-交付说明.md) · [产品需求](docs/个人工作台/个人工作台.md)）

## 技术栈

见 **[agents/project-baseline.md](./agents/project-baseline.md)**（唯一来源）。

## 启动

见 **[`.cursor/skills/start-project/SKILL.md`](./.cursor/skills/start-project/SKILL.md)** 或：

```bash
pnpm install
pnpm dev
```

- 前端：http://localhost:5175
- 后端：http://localhost:3100

## 目录结构

见 **[agents/project-baseline.md §目录映射](./agents/project-baseline.md)**。

## 文档

权威映射见 **[AGENTS.md §文档映射](./AGENTS.md#2-文档映射ssot)**。

| 读者 | 入口 |
|------|------|
| AI Agent | [AGENTS.md](./AGENTS.md) |
| 人类开发者 | 本文件 + [ARCHITECTURE.md](./ARCHITECTURE.md) |
| 实现进度 | [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) |
| 产品规划 | [产品设计](./PROJECT_MANAGER_PRODUCT_DESIGN.md) · [技术方案](./PROJECT_MANAGER_PLATFORM_PLAN.md) |
