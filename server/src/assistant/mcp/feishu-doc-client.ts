import type { ExternalSnippet, MetricsLedger } from '@project-manager/shared';
import { getFeishuMcpConfig, isFeishuMcpConfigured } from './mcp-config.js';

export interface FetchFeishuDocOptions {
  metrics?: MetricsLedger;
}

/** 清洗 MCP 返回的 Markdown，截断为摘要片段 */
export function summarizeFeishuMarkdown(raw: string, maxChars: number): string {
  const normalized = raw
    .replace(/!\[[^\]]*]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (normalized.length <= maxChars) {
    return normalized;
  }
  return `${normalized.slice(0, maxChars)}…`;
}

function recordMcpMetric(
  metrics: MetricsLedger | undefined,
  name: 'pw.mcp.latency_ms' | 'pw.mcp.fail',
  tags: Record<string, string>,
  value?: number,
): void {
  metrics?.record({
    name,
    ts: new Date().toISOString(),
    tags,
    value,
  });
}

/**
 * 经 HTTP 桥接调用 Feishu Document MCP 的 get_doc_content
 * 桥接约定：POST { doc } → { content: string }
 */
export async function fetchFeishuDocumentMarkdown(
  doc: string,
  options?: FetchFeishuDocOptions,
): Promise<string | null> {
  if (!isFeishuMcpConfigured()) {
    return null;
  }

  const config = getFeishuMcpConfig();
  if (!config.httpUrl) {
    return null;
  }

  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(config.httpUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ doc, use_user_token: true }),
      signal: controller.signal,
    });

    if (!response.ok) {
      recordMcpMetric(options?.metrics, 'pw.mcp.fail', {
        source: 'feishu',
        code: String(response.status),
      });
      return null;
    }

    const payload = (await response.json()) as { content?: string; markdown?: string };
    const markdown = payload.content ?? payload.markdown ?? '';
    recordMcpMetric(
      options?.metrics,
      'pw.mcp.latency_ms',
      { source: 'feishu', tool: 'get_doc_content' },
      Date.now() - started,
    );
    return markdown.trim() || null;
  } catch (error) {
    const code = error instanceof Error && error.name === 'AbortError' ? 'timeout' : 'network';
    recordMcpMetric(options?.metrics, 'pw.mcp.fail', { source: 'feishu', code });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** 拉取单个飞书文档并转为 ExternalSnippet */
export async function fetchFeishuExternalSnippet(
  doc: string,
  options?: FetchFeishuDocOptions,
): Promise<ExternalSnippet | null> {
  const markdown = await fetchFeishuDocumentMarkdown(doc, options);
  if (!markdown) {
    return null;
  }
  const config = getFeishuMcpConfig();
  return {
    source: `飞书文档 · ${doc}`,
    excerpt: summarizeFeishuMarkdown(markdown, config.maxExcerptChars),
  };
}

/** 批量拉取消息中的飞书文档片段 */
export async function fetchFeishuExternalSnippets(
  docs: string[],
  options?: FetchFeishuDocOptions,
): Promise<ExternalSnippet[]> {
  if (!isFeishuMcpConfigured() || docs.length === 0) {
    return [];
  }

  const config = getFeishuMcpConfig();
  const snippets: ExternalSnippet[] = [];
  for (const doc of docs.slice(0, config.maxDocsPerMessage)) {
    const snippet = await fetchFeishuExternalSnippet(doc, options);
    if (snippet) {
      snippets.push(snippet);
    }
  }
  return snippets;
}
