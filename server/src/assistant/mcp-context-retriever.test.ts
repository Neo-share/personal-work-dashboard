import { describe, expect, it, vi } from 'vitest';
import type { AssistantContext, ContextRetriever } from '@project-manager/shared';
import { InMemoryMetricsLedger } from './metrics-ledger.js';
import { McpContextRetriever } from './mcp-context-retriever.js';

describe('McpContextRetriever（F4）', () => {
  it('无 MCP 配置时退化为 DB 上下文', async () => {
    delete process.env.FEISHU_MCP_HTTP_URL;
    const dbContext: AssistantContext = {
      sessionId: 1,
      recentMessages: [],
      todayScheduleCount: 0,
    };
    const dbRetriever: ContextRetriever = {
      retrieve: vi.fn().mockResolvedValue(dbContext),
    };
    const retriever = new McpContextRetriever(dbRetriever);
    const result = await retriever.retrieve(1, {
      message: '参考 https://x.feishu.cn/wiki/abc 写方案',
    });
    expect(result).toEqual(dbContext);
    expect(result.externalSnippets).toBeUndefined();
  });

  it('MCP 成功时合并 externalSnippets', async () => {
    process.env.FEISHU_MCP_HTTP_URL = 'http://127.0.0.1:3999/mcp';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ content: '飞书 PRD 摘要' }),
      }),
    );

    const dbContext: AssistantContext = {
      sessionId: 2,
      recentMessages: [],
    };
    const dbRetriever: ContextRetriever = {
      retrieve: vi.fn().mockResolvedValue(dbContext),
    };
    const metrics = new InMemoryMetricsLedger();
    const retriever = new McpContextRetriever(dbRetriever, metrics);
    const result = await retriever.retrieve(2, {
      message: '根据 https://x.feishu.cn/docx/abc123 整理 UI 改版方案',
    });

    expect(result.externalSnippets).toHaveLength(1);
    expect(result.externalSnippets?.[0]?.excerpt).toContain('飞书 PRD 摘要');
    expect(metrics.queryRecent({ name: 'pw.mcp.latency_ms', limit: 1 })).toHaveLength(1);

    vi.unstubAllGlobals();
    delete process.env.FEISHU_MCP_HTTP_URL;
  });
});
