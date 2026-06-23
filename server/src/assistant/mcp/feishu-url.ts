/** 飞书文档 URL / token 提取（对齐 Feishu Document MCP get_doc_content） */

const FEISHU_DOC_URL_PATTERN =
  /https?:\/\/[a-z0-9-]+\.(?:feishu\.cn|feishu\.net|larksuite\.com)\/(?:wiki|docx|docs)\/[a-zA-Z0-9]+/gi;

/**
 * 从用户消息中提取飞书文档引用（完整 URL 或裸 token）
 */
export function extractFeishuDocRefs(message: string): string[] {
  const refs = new Set<string>();
  const urlMatches = message.match(FEISHU_DOC_URL_PATTERN) ?? [];
  for (const url of urlMatches) {
    refs.add(url);
  }
  return [...refs];
}
