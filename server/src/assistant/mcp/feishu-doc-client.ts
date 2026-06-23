import type { ExternalSnippet, MetricsLedger } from '@project-manager/shared';
import { fetchFeishuDocumentContent } from './feishu/fetch-feishu-document.js';
import { getFeishuMcpConfig, isFeishuMcpConfigured } from './mcp-config.js';

export interface FetchFeishuDocOptions {
  metrics?: MetricsLedger;
}

/** 清洗飞书 Markdown，截断为摘要片段 */
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

function classifyFeishuError(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.includes('超时')) {
      return 'timeout';
    }
    const codeMatch = error.message.match(/code:\s*(\d+)/);
    if (codeMatch) {
      return codeMatch[1];
    }
    return 'feishu_api';
  }
  return 'unknown';
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error('飞书文档拉取超时')), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

/** 直接调用飞书 Open API 拉取文档 Markdown */
export async function fetchFeishuDocumentMarkdown(
  doc: string,
  options?: FetchFeishuDocOptions,
): Promise<string | null> {
  if (!isFeishuMcpConfigured()) {
    return null;
  }

  const config = getFeishuMcpConfig();
  const started = Date.now();

  try {
    const markdown = await withTimeout(fetchFeishuDocumentContent(doc), config.timeoutMs);
    recordMcpMetric(
      options?.metrics,
      'pw.mcp.latency_ms',
      { source: 'feishu', tool: 'get_doc_content' },
      Date.now() - started,
    );
    return markdown.trim() || null;
  } catch (error) {
    recordMcpMetric(options?.metrics, 'pw.mcp.fail', {
      source: 'feishu',
      code: classifyFeishuError(error),
    });
    return null;
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
