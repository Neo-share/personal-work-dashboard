# 个人工作台

本地 Web 应用：待办、日程、定时任务与个人 AI 助手，数据保存在本机 SQLite。

## 能做什么

- **待办管理**：创建、完成、逾期筛选与 AI 结果生成/修订
- **日程时间线**：多渠道日历合并展示与本地日程创建
- **定时任务**：周期规则与到期物化待办
- **个人助手**：自然语言创建待办/日程/定时任务，SSE 驱动页面刷新

产品说明见 [个人工作台.md](docs/个人工作台/个人工作台.md) · [交付说明](docs/个人工作台/个人工作台-交付说明.md)

## 技术栈

见 **[agents/project-baseline.md](./agents/project-baseline.md)**。

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

文档索引见 **[AGENTS.md §2](./AGENTS.md#2-文档索引)**。

| 读者 | 入口 |
|------|------|
| AI Agent | [AGENTS.md](./AGENTS.md) |
| 人类开发者 | 本文件 |
| 功能与实现状态 | [个人工作台-功能点.md](docs/个人工作台/个人工作台-功能点.md) |
| 助手架构 | [server/src/assistant/ARCHITECTURE.md](server/src/assistant/ARCHITECTURE.md) |
