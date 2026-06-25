# 常用命令与交付检查清单

> 开发命令、Agent 命令与 **交付 DoD**。

## 开发命令

```bash
pnpm install
pnpm dev
pnpm build
pnpm test              # server + client 单元测试（不 build）
pnpm test:coverage     # server 覆盖率（agent:gate 使用）
pnpm verify:dev        # 开发阶段验证：test:coverage + client 单测，不 build
pnpm test:e2e          # client Playwright E2E（需 dev 栈，单独执行）
pnpm start
```

**测试分层**：

| 命令 | 何时用 | 含 build |
|------|--------|----------|
| `pnpm agent:gate:dev` | **日常改动 / Agent S4 完成判定** | 否 |
| `pnpm agent:gate` | PR / CI（`pnpm gate:pr`） | 是 |

二者均跑 server `test:coverage` + client 单元测试，**不含 E2E**（Playwright 需 dev 栈，单独跑 `pnpm test:e2e`）。

**开发阶段**：改代码用 `pnpm dev`；`shared/dist` 由其中的 `tsc --watch` 保持即可。快速验改可用 `pnpm test`（无覆盖率）。

## Agent 命令

```bash
pnpm agent:scope:auto
pnpm agent:scope:web
pnpm agent:scope:api
pnpm agent:scope:shared
pnpm agent:scope:all
pnpm agent:s4:mechanical-loop
pnpm agent:gate:dev    # 开发阶段门禁（不 build，同 verify:dev）
pnpm agent:gate
pnpm gate:pr
```

## 交付前 DoD

- S2 已列预计改动文件，并完成 G.2 范围确认。
- 实际改动没有越出确认范围；若新增路径，已补充说明。
- `pnpm agent:scope:auto` 已输出 scope。
- `pnpm agent:scope:<scope>` 已通过。
- 日常改动：`pnpm agent:gate:dev` 至少一次 exit 0。
- 提 PR / CI：`pnpm agent:gate` 至少一次 exit 0（`pnpm gate:pr` 已包含）。
- S5 已说明验证结果、未执行项和残余风险。

## 本项目额外检查

- 改 schema 后说明需要删除或迁移 `server/data/project-manager.db`。
- 改 tRPC router 后确认 client `src/lib/trpc.ts` 类型引用仍一致。
- 改 shared 类型后同步 server service/router 与 client 展示。
