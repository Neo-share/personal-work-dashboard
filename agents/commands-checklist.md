# 常用命令与交付检查清单

> SSOT：开发命令、Agent 命令与 **交付 DoD** 的唯一来源。

## 开发命令

```bash
pnpm install
pnpm dev
pnpm build
pnpm test
pnpm test:coverage
pnpm start
```

## Agent 命令

```bash
pnpm agent:scope:auto
pnpm agent:scope:web
pnpm agent:scope:api
pnpm agent:scope:shared
pnpm agent:scope:all
pnpm agent:s4:mechanical-loop
pnpm agent:gate
pnpm gate:pr
```

## 交付前 DoD

- S2 已列预计改动文件，并完成 G.2 范围确认。
- 实际改动没有越出确认范围；若新增路径，已补充说明。
- `pnpm agent:scope:auto` 已输出 scope。
- `pnpm agent:scope:<scope>` 已通过。
- `pnpm agent:gate` 至少一次 exit 0。
- S5 已说明验证结果、未执行项和残余风险。

## 本项目额外检查

- 改 schema 后说明需要删除或迁移 `server/data/project-manager.db`。
- 改 tRPC router 后确认 client `src/lib/trpc.ts` 类型引用仍一致。
- 改 shared 类型后同步 server service/router 与 client 展示。
