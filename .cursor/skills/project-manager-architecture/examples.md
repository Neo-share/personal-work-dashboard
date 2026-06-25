# 技术改动模板（无业务）

占位符：`Entity`、`example`、`ExampleItem`。实际命名以代码库为准；业务映射见各包 AGENTS。

---

## 模板 1：新增 tRPC mutation

### Server

1. `services/example-service.ts` — `archiveExample(id: number)`
2. `trpc/router.ts` — 注册 `example.archive`，Zod 校验 input
3. 若项目约定有关联 mutation 后置钩子 — 在 router 内调用（见 server AGENTS）

### Client

```typescript
const archive = trpc.example.archive.useMutation();
const utils = trpc.useUtils();

await archive.mutateAsync({ id });
await utils.example.list.invalidate();
await utils.example.detail.invalidate({ id });
```

---

## 模板 2：实体新增字段

| 顺序 | 包 | 动作 |
|------|-----|------|
| 1 | shared | `types.ts` — `Entity` interface 增字段 |
| 2 | server | `db/schema.ts` — 加列 |
| 3 | server | `*-service.ts` — SELECT/INSERT/UPDATE + `mapEntity` |
| 4 | server | `router.ts` — create/update Zod |
| 5 | client | 相关 Page 表单与展示 |

删 `server/data/*.db` → 重启 → `pnpm build`。

---

## 模板 3：新增 query procedure

### Server

```typescript
// router.ts
summary: publicProcedure
  .input(z.object({ from: z.string().optional() }))
  .query(({ input }) => exampleService.getSummary(input)),
```

### Client

```typescript
const { data, isLoading } = trpc.example.summary.useQuery({ from });
```

---

## 模板 4：新增前端页面

1. `client/src/pages/ExamplePage.tsx` — default export
2. `client/src/App.tsx` — `<Route path="/example" element={<ExamplePage />} />`
3. `trpc.example.*.useQuery` / `useMutation` + invalidate

---

## 模板 5：扩展 SSE 事件消费

1. **shared** — 扩展事件联合类型（若为新 event type）
2. **server** — `routes/*.ts` 按协议推送 SSE 帧
3. **client** — 在 SSE parser 中分支处理；若事件携带「刷新某 query」语义，则 `utils.<ns>.<proc>.invalidate()`

协议定义以 `shared` 与 `server/ARCHITECTURE.md` 为准，本 Skill 不维护具体事件名。

---

## 模板 6：新增 service 模块

```
server/src/services/foo-service.ts    业务 + SQL + mapFoo
server/src/trpc/router.ts             暴露 procedures
shared/src/types.ts                   FooItem / FooSummary（若跨端）
client/src/pages/...                  消费端（若需 UI）
```

```typescript
import { getDb } from '../db/index.js';
import type { FooItem } from '@project-manager/shared';
```

---

## 反例

| 反例 | 原因 |
|------|------|
| router 内 SQL | 违反分层 |
| shared 导出 AppRouter | 类型归属 server |
| client import server service | 运行时耦合 |
| shared 依赖 client/server | 破坏 monorepo 依赖方向 |
| 改 schema 不删 DB | 无 migration |
| 在 shared 放 I/O、DB、HTTP | shared 仅契约与纯函数 |
