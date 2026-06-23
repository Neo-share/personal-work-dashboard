import { afterEach, describe, expect, it, vi } from 'vitest';
import { InMemoryMetricsLedger } from '../metrics-ledger.js';
import * as fetchModule from './feishu/fetch-feishu-document.js';
import {
  fetchFeishuDocumentMarkdown,
  fetchFeishuExternalSnippets,
  summarizeFeishuMarkdown,
} from './feishu-doc-client.js';

describe('feishu-doc-client', () => {
  const originalAppId = process.env.FEISHU_APP_ID;
  const originalAppSecret = process.env.FEISHU_APP_SECRET;

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalAppId === undefined) {
      delete process.env.FEISHU_APP_ID;
    } else {
      process.env.FEISHU_APP_ID = originalAppId;
    }
    if (originalAppSecret === undefined) {
      delete process.env.FEISHU_APP_SECRET;
    } else {
      process.env.FEISHU_APP_SECRET = originalAppSecret;
    }
  });

  it('summarizeFeishuMarkdown 截断过长文本', () => {
    const long = 'a'.repeat(20);
    expect(summarizeFeishuMarkdown(long, 10)).toBe(`${'a'.repeat(10)}…`);
  });

  it('未配置飞书凭证时返回 null', async () => {
    delete process.env.FEISHU_APP_ID;
    delete process.env.FEISHU_APP_SECRET;
    await expect(fetchFeishuDocumentMarkdown('https://x.feishu.cn/wiki/abc')).resolves.toBeNull();
  });

  it('拉取成功时记录 latency 并返回 Markdown', async () => {
    process.env.FEISHU_APP_ID = 'cli_test';
    process.env.FEISHU_APP_SECRET = 'secret';
    const metrics = new InMemoryMetricsLedger();
    vi.spyOn(fetchModule, 'fetchFeishuDocumentContent').mockResolvedValue('# 标题\n正文内容');

    const markdown = await fetchFeishuDocumentMarkdown('https://x.feishu.cn/wiki/abc', { metrics });
    expect(markdown).toContain('标题');
    const events = metrics.queryRecent({ name: 'pw.mcp.latency_ms', limit: 1 });
    expect(events[0]?.tags?.source).toBe('feishu');
  });

  it('拉取失败时记录 pw.mcp.fail 并降级为空片段', async () => {
    process.env.FEISHU_APP_ID = 'cli_test';
    process.env.FEISHU_APP_SECRET = 'secret';
    const metrics = new InMemoryMetricsLedger();
    vi.spyOn(fetchModule, 'fetchFeishuDocumentContent').mockRejectedValue(
      new Error('获取文档块失败: Access denied (code: 99991672)'),
    );

    const snippets = await fetchFeishuExternalSnippets(['https://x.feishu.cn/wiki/abc'], {
      metrics,
    });
    expect(snippets).toEqual([]);
    const events = metrics.queryRecent({ name: 'pw.mcp.fail', limit: 1 });
    expect(events[0]?.tags?.code).toBe('99991672');
  });
});
