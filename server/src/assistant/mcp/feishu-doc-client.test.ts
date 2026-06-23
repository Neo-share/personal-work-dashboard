import { afterEach, describe, expect, it, vi } from 'vitest';
import { InMemoryMetricsLedger } from '../metrics-ledger.js';
import {
  fetchFeishuDocumentMarkdown,
  fetchFeishuExternalSnippets,
  summarizeFeishuMarkdown,
} from './feishu-doc-client.js';

describe('feishu-doc-client', () => {
  const originalUrl = process.env.FEISHU_MCP_HTTP_URL;

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalUrl === undefined) {
      delete process.env.FEISHU_MCP_HTTP_URL;
    } else {
      process.env.FEISHU_MCP_HTTP_URL = originalUrl;
    }
  });

  it('summarizeFeishuMarkdown 截断过长文本', () => {
    const long = 'a'.repeat(20);
    expect(summarizeFeishuMarkdown(long, 10)).toBe(`${'a'.repeat(10)}…`);
  });

  it('未配置 MCP 时返回 null', async () => {
    delete process.env.FEISHU_MCP_HTTP_URL;
    await expect(fetchFeishuDocumentMarkdown('https://x.feishu.cn/wiki/abc')).resolves.toBeNull();
  });

  it('HTTP 桥接成功时记录 latency 并返回 content', async () => {
    process.env.FEISHU_MCP_HTTP_URL = 'http://127.0.0.1:3999/mcp';
    const metrics = new InMemoryMetricsLedger();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ content: '# 标题\n正文内容' }),
      }),
    );

    const markdown = await fetchFeishuDocumentMarkdown('https://x.feishu.cn/wiki/abc', { metrics });
    expect(markdown).toContain('标题');
    const events = metrics.queryRecent({ name: 'pw.mcp.latency_ms', limit: 1 });
    expect(events[0]?.tags?.source).toBe('feishu');
  });

  it('HTTP 失败时记录 pw.mcp.fail 并降级为空片段', async () => {
    process.env.FEISHU_MCP_HTTP_URL = 'http://127.0.0.1:3999/mcp';
    const metrics = new InMemoryMetricsLedger();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
      }),
    );

    const snippets = await fetchFeishuExternalSnippets(['https://x.feishu.cn/wiki/abc'], {
      metrics,
    });
    expect(snippets).toEqual([]);
    const events = metrics.queryRecent({ name: 'pw.mcp.fail', limit: 1 });
    expect(events[0]?.tags?.code).toBe('503');
  });
});
