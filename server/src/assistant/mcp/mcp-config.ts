/** 飞书 Document MCP HTTP 桥接配置（凭证由人工配置，见 TODO/mcp-integration.md） */

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_DOCS = 3;
const DEFAULT_EXCERPT_CHARS = 1500;

export interface FeishuMcpConfig {
  httpUrl: string | null;
  timeoutMs: number;
  maxDocsPerMessage: number;
  maxExcerptChars: number;
}

/** 是否已配置飞书 MCP HTTP 桥接 */
export function isFeishuMcpConfigured(): boolean {
  return Boolean(process.env.FEISHU_MCP_HTTP_URL?.trim());
}

/** 读取飞书 MCP 配置；未配置 httpUrl 时仍可读取上限类默认值 */
export function getFeishuMcpConfig(): FeishuMcpConfig {
  const httpUrl = process.env.FEISHU_MCP_HTTP_URL?.trim() || null;
  const timeoutMs = Number(process.env.FEISHU_MCP_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
  const maxDocs = Number(process.env.FEISHU_MCP_MAX_DOCS ?? DEFAULT_MAX_DOCS);
  const maxExcerptChars = Number(process.env.FEISHU_MCP_EXCERPT_CHARS ?? DEFAULT_EXCERPT_CHARS);

  return {
    httpUrl,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS,
    maxDocsPerMessage: Number.isFinite(maxDocs) && maxDocs > 0 ? maxDocs : DEFAULT_MAX_DOCS,
    maxExcerptChars:
      Number.isFinite(maxExcerptChars) && maxExcerptChars > 0
        ? maxExcerptChars
        : DEFAULT_EXCERPT_CHARS,
  };
}
