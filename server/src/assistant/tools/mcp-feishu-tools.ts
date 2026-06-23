import type { ExternalSnippet, ToolDefinition } from '@project-manager/shared';
import { z } from 'zod';
import { fetchFeishuExternalSnippet, fetchFeishuExternalSnippets } from '../mcp/feishu-doc-client.js';
import { extractFeishuDocRefs } from '../mcp/feishu-url.js';

export interface FeishuGetDocResult {
  snippets: ExternalSnippet[];
}

/** F4：飞书 Document MCP 工具，经 ToolRegistry 白名单注册 */
export const feishuGetDocTool: ToolDefinition<
  { doc?: string; message?: string },
  FeishuGetDocResult
> = {
  name: 'mcp.feishu.get_doc',
  description: '从飞书文档拉取 Markdown 摘要，填充 externalSnippets',
  paramsSchema: z
    .object({
      doc: z.string().min(1).optional(),
      message: z.string().optional(),
    })
    .refine((value) => Boolean(value.doc?.trim() || value.message?.trim()), {
      message: '需提供 doc 或 message',
    }),
  execute: async (params, ctx) => {
    const docs = params.doc?.trim()
      ? [params.doc.trim()]
      : extractFeishuDocRefs(params.message ?? '');
    const snippets = params.doc?.trim()
      ? [await fetchFeishuExternalSnippet(params.doc.trim(), { metrics: ctx.metrics })].filter(
          (item): item is ExternalSnippet => item !== null,
        )
      : await fetchFeishuExternalSnippets(docs, { metrics: ctx.metrics });
    return { snippets };
  },
};
