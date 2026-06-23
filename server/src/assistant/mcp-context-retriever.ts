import type {
  AssistantContext,
  ContextRetrieveOptions,
  ContextRetriever,
  ExternalSnippet,
  MetricsLedger,
} from '@project-manager/shared';
import { dbContextRetriever } from './context-retriever.js';
import { fetchFeishuExternalSnippets } from './mcp/feishu-doc-client.js';
import { extractFeishuDocRefs } from './mcp/feishu-url.js';
import { isFeishuMcpConfigured } from './mcp/mcp-config.js';

/**
 * F4：DB 上下文 + MCP 外部片段（飞书文档）
 * MCP 不可用时退化为纯 DB 上下文，不影响主链路。
 */
export class McpContextRetriever implements ContextRetriever {
  constructor(
    private readonly dbRetriever: ContextRetriever = dbContextRetriever,
    private readonly metrics?: MetricsLedger,
  ) {}

  async retrieve(sessionId: number, options?: ContextRetrieveOptions): Promise<AssistantContext> {
    const base = await this.dbRetriever.retrieve(sessionId, options);
    const externalSnippets = await this.resolveExternalSnippets(options?.message);
    if (!externalSnippets.length) {
      return base;
    }
    return {
      ...base,
      externalSnippets,
    };
  }

  private async resolveExternalSnippets(message?: string): Promise<ExternalSnippet[]> {
    if (!message?.trim() || !isFeishuMcpConfigured()) {
      return [];
    }
    const docs = extractFeishuDocRefs(message);
    if (!docs.length) {
      return [];
    }
    return fetchFeishuExternalSnippets(docs, { metrics: this.metrics });
  }
}

/** 供单测注入 metrics 的工厂 */
export function createMcpContextRetriever(metrics?: MetricsLedger): McpContextRetriever {
  return new McpContextRetriever(dbContextRetriever, metrics);
}

export const mcpContextRetriever = new McpContextRetriever();
