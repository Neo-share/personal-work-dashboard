---
name: start-project
description: 启动个人驾驶舱（project-manager）本地开发环境。安装依赖、运行 pnpm dev、验证前后端可用。用户说「启动项目」「跑起来」「开 dev」「启动开发环境」时使用。
disable-model-invocation: false
---

# 启动个人驾驶舱

pnpm monorepo 本地 Web 应用（**个人驾驶舱**）：**shared watch + server :3100 + client :5175**。

端口与命令见 **[agents/commands-checklist.md](../../agents/commands-checklist.md)** 与 **[agents/project-baseline.md](../../agents/project-baseline.md)**。

---

## 触发场景

- 启动项目 / 跑起来 / 开 dev / 启动开发环境
- 本地调试 / 预览驾驶舱
- 首次 clone 后搭建环境

---

## 前置条件

| 项 | 要求 |
|----|------|
| Node.js | 建议 18+ |
| pnpm | 9.x（根 `package.json` 声明 `pnpm@9.15.9`；无则 `corepack enable && corepack prepare pnpm@9.15.9 --activate`） |
| 工作目录 | monorepo 根目录 `project-manager/`（含 `pnpm-workspace.yaml`） |

---

## 标准流程

### 1. 进入项目根目录

```bash
cd /Users/ningliu/Documents/CodeLab/project-manager
```

路径以用户实际 workspace 为准；必须在含 `package.json` 与 `pnpm-workspace.yaml` 的目录执行。

### 2. 安装依赖（首次或 lockfile / package.json 变更后）

```bash
pnpm install
```

### 3. 启动开发环境

```bash
pnpm dev
```

等价于并行启动：

- `@project-manager/shared` — `tsc --watch`
- `@project-manager/server` — `tsx watch src/index.ts`
- `@project-manager/client` — `vite`（端口 5175）

**在后台运行**（Agent 终端）：使用 Shell 工具，`block_until_ms: 0` 或足够长的时间，避免阻塞会话。

### 4. 验证服务就绪

等待数秒后检查：

```bash
curl -s http://localhost:3100/health
# 期望：{"ok":true}
```

| 服务 | 地址 | 说明 |
|------|------|------|
| 前端 | http://localhost:5175 | 浏览器访问驾驶舱 |
| 后端 | http://localhost:3100 | Fastify API |
| 健康检查 | GET /health | `{ ok: true }` |
| tRPC | POST /trpc/* | 开发时由 Vite 代理到 3100 |

前端页面可打开 http://localhost:5175 确认 UI 加载。

### 5. 告知用户

启动成功后简要说明：

- 访问地址（前端 5175）
- 后端 3100 与代理关系
- 停止方式：终端 `Ctrl+C` 或结束对应后台进程

---

## 仅启动单包（可选）

依赖未全起时可能报错；**默认仍用根目录 `pnpm dev`**。

```bash
pnpm --filter @project-manager/shared dev   # 仅类型 watch
pnpm --filter @project-manager/server dev   # 仅后端（需 shared 已 build）
pnpm --filter @project-manager/client dev   # 仅前端（需 server 已运行）
```

---

## 生产构建与 API 启动（非 dev）

```bash
pnpm build    # shared → server → client
pnpm start    # 仅 node server/dist；不含静态前端托管
```

静态前端产物在 `client/dist/`，需单独托管；日常开发**不要**用 `pnpm start` 代替 `pnpm dev`。

---

## 常见问题

### 端口占用

- 3100 / 5175 被占用时，Vite 或 Fastify 启动失败
- 处理：结束占用进程，或 server 侧设置 `PORT=3101`（同时需改 `client/vite.config.ts` 代理目标）

### 依赖 / 构建错误

```bash
rm -rf node_modules client/node_modules server/node_modules shared/node_modules
pnpm install
pnpm --filter @project-manager/shared build
pnpm dev
```

### 改数据库 schema 后数据异常

```bash
rm -rf server/data/project-manager.db
pnpm dev
```

SQLite 无 migration；删库后 seed 会重建演示数据。

### pnpm 权限 / EPERM

若 sandbox 报 `EPERM` 写 global pnpm 目录，Shell 需 `required_permissions: ["all"]`。

### shared 类型未更新

单独改 shared 后若 client/server 报类型错误：

```bash
pnpm --filter @project-manager/shared build
```

---

## Agent 执行清单

- [ ] 确认 cwd 为 monorepo 根目录
- [ ] 无 `node_modules` 或 package 变更时先 `pnpm install`
- [ ] `pnpm dev` 后台运行
- [ ] `curl localhost:3100/health` 通过
- [ ] 向用户给出 http://localhost:5175
- [ ] 失败时根据上节排查，不重复无效重试

---

## 延伸阅读

| 文档 | 用途 |
|------|------|
| [AGENTS.md](../../AGENTS.md) | Monorepo 入口与文档索引 |
| [README.md](../../README.md) | 人类可读简介 |
| [agents/commands-checklist.md](../../agents/commands-checklist.md) | 命令与 DoD |
