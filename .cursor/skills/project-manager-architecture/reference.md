# 技术参考（无业务）

> 业务向 Router 树、Service 索引、表结构、SSE 载荷定义见 `server/AGENTS.md` 与 `server/src/assistant/ARCHITECTURE.md`。

---

## 目录骨架

```
project-manager/
├── pnpm-workspace.yaml
├── package.json                 dev/build 脚本入口
├── shared/src/
│   ├── index.ts                 统一 export
│   └── types.ts                 跨端类型 SSOT
├── server/src/
│   ├── index.ts                 Fastify 入口
│   ├── trpc/router.ts           appRouter
│   ├── trpc/context.ts
│   ├── routes/                  REST/SSE
│   ├── services/*-service.ts
│   └── db/schema.ts | index.ts | seed.ts
└── client/src/
    ├── main.tsx
    ├── App.tsx
    ├── lib/trpc.ts
    ├── pages/
    ├── components/
    ├── hooks/
    └── styles/
```

---

## tRPC 注册模式

```typescript
// server/src/trpc/router.ts（示意）
export const appRouter = router({
  example: router({
    list: publicProcedure.query(() => exampleService.list()),
    create: publicProcedure
      .input(z.object({ name: z.string() }))
      .mutation(({ input }) => exampleService.create(input)),
  }),
});
export type AppRouter = typeof appRouter;
```

```typescript
// client 消费（示意）
const { data } = trpc.example.list.useQuery();
const create = trpc.example.create.useMutation();
const utils = trpc.useUtils();
await create.mutateAsync({ name: 'x' });
await utils.example.list.invalidate();
```

完整 procedure 清单：`server/src/trpc/router.ts`。

---

## REST / 健康检查

| Method | Path | 说明 |
|--------|------|------|
| GET | `/health` | 进程存活 |
| GET | `/health/*` | 可选子系统探测（如 LLM） |
| POST | `/api/*` | 非 tRPC 能力（常见为 SSE） |

SSE 事件形状：见 `server/src/assistant/ARCHITECTURE.md` 与 `shared/src/types.ts`。

---

## Service 层模式

```typescript
// server/src/services/example-service.ts（示意）
import { getDb } from '../db/index.js';
import type { ExampleItem } from '@project-manager/shared';

function mapExample(row: Record<string, unknown>): ExampleItem {
  return {
    id: row.id as number,
    displayName: row.display_name as string, // snake → camel
    enabled: Boolean(row.enabled),
    payload: JSON.parse((row.payload as string) ?? '{}'),
  };
}

export function listExamples(): ExampleItem[] {
  const rows = getDb().prepare('SELECT * FROM examples ORDER BY id').all();
  return rows.map(mapExample);
}
```

命名：一域一文件 `*-service.ts`；SQL 仅出现在 service / db 层。

---

## Shared 变更同步链

```
shared/types.ts (interface / enum / labels)
    → server/db/schema.ts
    → server/services/* map + SQL
    → server/trpc/router.ts Zod
    → client 页面/组件展示
```

enum 扩展时同步 server 侧所有相关 `z.enum([...])`。

---

## Client Provider 与代理

**main.tsx**：`createTRPCReact<AppRouter>()` + `httpBatchLink({ url: '/trpc' })`

**vite.config.ts**（开发）：

| 配置 | 典型值 |
|------|--------|
| `server.port` | 5175 |
| `resolve.alias['@']` | `src/` |
| proxy `/trpc`, `/api`, `/health` | `http://localhost:3100` |

**构建**：`tsc -b && vite build` → `client/dist/`

---

## Server 配置位

| 项 | 位置 | 默认 |
|----|------|------|
| 后端端口 | `process.env.PORT` | 3100 |
| 环境变量 | `server/.env`、根 `.env` | 见 `.env.example` |
| SQLite 文件 | `server/data/` | gitignore |
| 前端端口 | `client/vite.config.ts` | 5175 |

---

## 构建命令

```bash
pnpm install
pnpm dev
pnpm build
pnpm start                    # 仅 API
pnpm --filter @project-manager/shared build
pnpm --filter @project-manager/server test
```

生产：静态资源托管 `client/dist/`，API 反向代理至 server。

---

## 类型桥接（AppRouter）

```typescript
// client/src/lib/trpc.ts
import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '../../../server/src/trpc/router';

export const trpc = createTRPCReact<AppRouter>();
```

build 时 server 源码须存在以解析类型；运行时 client 不打包 server 代码。
