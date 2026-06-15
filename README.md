# 个人驾驶舱

个人定制的本地工作管理平台，以「工作项」为中心，按工作域管理开发、生活、学习等个人工作；开发域把 CodeLab 工作区内的 Git 仓库、协作联系人与上线节奏串在一起，数据保存在本机，不依赖云端服务。

## 能做什么

- **驾驶舱概览**：集中查看进行中的工作项、脏仓库、阻塞项与计划上线
- **工作管理**：维护状态、优先级、风险，以及关联的仓库、人员、里程碑和外部链接
- **仓库资产**：扫描工作区 Git 仓库，查看分支、提交、技术标签与环境脚本
- **关系图谱**：可视化工作项与仓库、人员、里程碑之间的关联
- **对话助手**：通过自然语言跳转页面、筛选工作项、打开详情或扫描中心
- **扫描中心**：对工作区执行 Git 扫描，更新仓库资产快照

## 技术栈

- Monorepo：pnpm workspace（`client` / `server` / `shared`）
- 前端：React + Vite + TypeScript + Ant Design + tRPC + TanStack Query
- 后端：Node.js + Fastify + tRPC + SQLite + simple-git
- 共享类型：`shared/`

## 启动

```bash
cd project-manager
pnpm install
pnpm dev
```

- 前端：http://localhost:5175
- 后端：http://localhost:3100

## 目录结构

```text
project-manager/
├── client/      # React 前端
├── server/      # Fastify + tRPC + SQLite
├── shared/      # 前后端共享类型
└── README.md
```

## 更多文档

- [产品设计说明书](./PROJECT_MANAGER_PRODUCT_DESIGN.md)
- [平台技术方案](./PROJECT_MANAGER_PLATFORM_PLAN.md)
- [Monorepo 指南](./AGENTS.md) · [架构说明](./ARCHITECTURE.md)
- [实现状态对照](./IMPLEMENTATION_STATUS.md)（计划书 vs 代码，供开发参考）
