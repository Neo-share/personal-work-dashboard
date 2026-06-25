---
name: project-manager-architecture
description: >-
  project-manager 全栈技术架构模式：pnpm monorepo 三件套、router→service→DB 分层、
  React+tRPC 前端、Fastify+SQLite 后端、shared 契约层、tRPC+SSE 双通道。
  在新增页面/API/字段、排查包边界与数据流时使用。不含具体业务域，业务细节见各包 ARCHITECTURE.md。
---

# 全栈技术架构（无业务）

本 Skill 只描述 **技术分层与数据流模式**；实体、路由树、Service 清单等业务内容见各包文档，不在此重复。

| 层级 | 操作指南 | 架构详述 |
|------|----------|----------|
| 全栈 | [AGENTS.md](../../AGENTS.md) | [ARCHITECTURE.md](../../ARCHITECTURE.md) |
| 前端 | [client/AGENTS.md](../../client/AGENTS.md) | [client/ARCHITECTURE.md](../../client/ARCHITECTURE.md) |
| 后端 | [server/AGENTS.md](../../server/AGENTS.md) | [server/ARCHITECTURE.md](../../server/ARCHITECTURE.md) |
| 契约 | [shared/AGENTS.md](../../shared/AGENTS.md) | [shared/ARCHITECTURE.md](../../shared/ARCHITECTURE.md) |

---

## 1. Monorepo 指纹

```
pnpm workspace
├── shared/     类型与跨端契约（无运行时、无 AppRouter）
├── server/     HTTP + tRPC + 持久化 + 领域 service
└── client/     React SPA，消费 tRPC / REST

依赖: shared ← server, shared ← client（禁止反向）
通信: client :5175 ──proxy /trpc,/api──► server :3100 ──► SQLite
```

| 包 | 栈 | 技术职责 |
|----|-----|----------|
| `shared` | TypeScript ESM | 实体/DTO/协议类型、标签常量、纯函数 helper |
| `server` | Fastify + tRPC + Zod + better-sqlite3 | Transport、Service、Infra（db/定时/外部 I/O） |
| `client` | React + Vite + Ant Design + TanStack Query + tRPC | 页面、组件、客户端状态、API 消费 |

---

## 2. 双通道 API

| 通道 | 用途 | 典型路径 |
|------|------|----------|
| **tRPC** | 结构化 CRUD / query / mutation | `POST /trpc/<namespace>.<procedure>` |
| **REST + SSE** | 长连接、流式推送（如对话） | `POST /api/*` |

前端开发态：`vite.config.ts` 将 `/trpc`、`/api`、`/health` 代理到后端端口。

---

## 3. 分层与数据流（硬约束）

### 3.1 后端

```
trpc/router.ts   Zod 校验 + 薄路由（调 service，不写 SQL）
    ↓
services/*       业务逻辑 + SQL + mapRow → shared 类型
    ↓
db/              schema、连接、seed
```

- Router **不含 SQL**；关联/聚合类 mutation 的项目级后置钩子见 [server/AGENTS.md](../../server/AGENTS.md)
- ESM 相对 import **必须** `.js` 后缀
- 返回形状对齐 `@project-manager/shared`

### 3.2 前端

```
Page/Component → trpc.<ns>.<proc>.useQuery | useMutation
              → httpBatchLink('/trpc')
mutation 成功 → trpc.useUtils() → utils.<ns>.<proc>.invalidate()
```

- AppRouter 类型：`client/src/lib/trpc.ts` 跨包引用 `server/src/trpc/router`（**仅类型**）
- 服务端数据走 TanStack Query；URL 态用 `useSearchParams`；无全局 Redux/Zustand

### 3.3 Shared

- 跨端「是什么」：`shared/src/types.ts`（及按需拆分的契约文件）
- AppRouter **不在** shared；server router 的 Zod enum 与 shared 联合类型须手工同步
- 改 shared 后的同步义务见 [shared/AGENTS.md §4](../../shared/AGENTS.md)

### 3.4 数据库映射

- SQLite snake_case → TS camelCase（service 内 `mapXxx()`）
- JSON 列：`JSON.stringify` / `JSON.parse`；布尔：`INTEGER 0/1`
- **无 migration 框架**；改 `schema.ts` 后删 `server/data/*.db` 重启

---

## 4. 前端 Bootstrap

**入口** `client/src/main.tsx`：

```
StrictMode → ConfigProvider → trpc.Provider → QueryClientProvider → BrowserRouter → App
```

| 关注点 | 约定 |
|--------|------|
| 页面 | `client/src/pages/*`，default export |
| 路由注册 | `client/src/App.tsx` |
| 路径别名 | `@/` → `src/` |
| 样式 | `client/src/styles/*.css`，布局 class 复用见 client AGENTS |
| tRPC 客户端 | `client/src/lib/trpc.ts` |

Provider 默认：`staleTime: 30s`，`refetchOnWindowFocus: false`。

---

## 5. 后端 Bootstrap

**入口** `server/src/index.ts` 典型顺序：

1. 加载 env（`server/.env` 或根 `.env`）
2. `getDb()` — 执行 schema + seed
3. 注册 Fastify 插件（CORS、tRPC prefix `/trpc`）
4. 注册 REST 路由（如 SSE、`/health`）
5. 启动后台任务（scheduler 等，若有）
6. `listen(PORT ?? 3100)`

**目录角色**（模式级）：

| 目录 | 职责 |
|------|------|
| `trpc/` | `appRouter`、context |
| `routes/` | 非 tRPC HTTP（SSE 等） |
| `services/` | 领域 service，`*-service.ts` |
| `db/` | schema、index、seed |
| 其他 | 按技术域分子目录，见 server ARCHITECTURE |

---

## 6. 改动定位（技术视角）

```
改动类型 → 触及层
├── 新 tRPC 能力     shared(类型?) → service → router → client hook + invalidate
├── 实体字段         shared → schema → service map → router Zod → client 表单/展示
├── 新页面           pages/* + App.tsx Route + tRPC 消费
├── REST/SSE 协议    routes/* + shared 事件类型 + client 事件 handler
├── 纯 UI/样式       client 组件与 css
└── 基础设施         db/、env、vite 代理、build 脚本
```

通用步骤模板见 [examples.md](examples.md)；端口、构建、目录索引见 [reference.md](reference.md)。

---

## 7. 构建与验证

```bash
pnpm dev      # shared watch + server + client 并行
pnpm build    # 顺序: shared → server → client
pnpm start    # 仅 server（生产 API；静态前端单独托管 dist/）
```

改代码后最低验证：

1. `pnpm build` exit 0
2. 改 schema → 删 DB 文件后重启
3. 改 router → client `lib/trpc.ts` 类型仍一致
4. 全栈任务 → `pnpm agent:scope:auto` → `pnpm agent:scope:<scope>` → `pnpm agent:gate:dev`

本地启动：[@start-project](../start-project/SKILL.md)。

---

## 8. 常见陷阱（技术）

| 陷阱 | 处理 |
|------|------|
| AppRouter 跨包引用 | 改 procedure 命名/签名须同步 client |
| client import server 运行时代码 | 只允许 import router **类型** |
| shared 依赖 client/server | 禁止；破坏依赖方向 |
| router 写 SQL | 下沉到 service |
| shared 未编译 | `pnpm --filter @project-manager/shared build` |
| 改 schema 不重建 DB | 无 ALTER migration，旧库缺列 |
| 生产部署 | `pnpm start` 不含前端静态资源，需反向代理 `/trpc` 与 `/api` |
