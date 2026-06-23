/** 飞书文档集成配置（见 server/.env.example） */

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_DOCS = 3;
const DEFAULT_EXCERPT_CHARS = 1500;

export interface FeishuMcpConfig {
  appId: string | null;
  appSecret: string | null;
  timeoutMs: number;
  maxDocsPerMessage: number;
  maxExcerptChars: number;
}

/** 是否已配置飞书应用凭证 */
export function isFeishuMcpConfigured(): boolean {
  return Boolean(process.env.FEISHU_APP_ID?.trim() && process.env.FEISHU_APP_SECRET?.trim());
}

export function getFeishuMcpConfig(): FeishuMcpConfig {
  const appId = process.env.FEISHU_APP_ID?.trim() || null;
  const appSecret = process.env.FEISHU_APP_SECRET?.trim() || null;
  const timeoutMs = Number(process.env.FEISHU_MCP_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
  const maxDocs = Number(process.env.FEISHU_MCP_MAX_DOCS ?? DEFAULT_MAX_DOCS);
  const maxExcerptChars = Number(process.env.FEISHU_MCP_EXCERPT_CHARS ?? DEFAULT_EXCERPT_CHARS);

  return {
    appId,
    appSecret,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS,
    maxDocsPerMessage: Number.isFinite(maxDocs) && maxDocs > 0 ? maxDocs : DEFAULT_MAX_DOCS,
    maxExcerptChars:
      Number.isFinite(maxExcerptChars) && maxExcerptChars > 0
        ? maxExcerptChars
        : DEFAULT_EXCERPT_CHARS,
  };
}
