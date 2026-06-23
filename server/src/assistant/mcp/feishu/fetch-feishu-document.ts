import lark from '@larksuiteoapi/node-sdk';
import { getFeishuUserAccessTokenIfAvailable } from './feishu-oauth.js';
import { getFeishuClient } from './feishu-client.js';
import { blocksToMarkdown, type FeishuBlock } from './blocks-to-markdown.js';

function extractDocToken(input: string): string {
  const match = input.match(/\/(?:wiki|docx|docs)\/([A-Za-z0-9]+)/);
  return match ? match[1] : input.trim();
}

function isWikiUrl(input: string): boolean {
  return /\/wiki\//.test(input);
}

async function withUserToken<T>(useUserToken: boolean, fn: (token: string) => Promise<T>): Promise<T> {
  const userToken = useUserToken ? await getFeishuUserAccessTokenIfAvailable() : null;
  if (!userToken) {
    throw new Error('无可用用户 token');
  }
  return fn(userToken);
}

async function resolveWikiToken(wikiToken: string, useUserToken: boolean): Promise<string> {
  const client = getFeishuClient();
  const payload = { params: { token: wikiToken } };

  const res = useUserToken
    ? await withUserToken(true, (token) =>
        client.wiki.v2.space.getNode(payload, lark.withUserAccessToken(token)),
      )
    : await client.wiki.v2.space.getNode(payload);

  if (res.code !== 0) {
    throw new Error(`获取知识库节点失败: ${res.msg} (code: ${res.code})`);
  }

  return res.data?.node?.obj_token ?? wikiToken;
}

async function fetchAllBlocks(documentId: string, useUserToken: boolean): Promise<FeishuBlock[]> {
  const client = getFeishuClient();
  const blocks: FeishuBlock[] = [];
  let pageToken: string | undefined;

  do {
    const payload = {
      path: { document_id: documentId },
      params: {
        page_size: 500,
        ...(pageToken ? { page_token: pageToken } : {}),
      },
    };

    const res = useUserToken
      ? await withUserToken(true, (token) =>
          client.docx.v1.documentBlock.list(payload, lark.withUserAccessToken(token)),
        )
      : await client.docx.v1.documentBlock.list(payload);

    if (res.code !== 0) {
      throw new Error(`获取文档块失败: ${res.msg} (code: ${res.code})`);
    }

    blocks.push(...((res.data?.items ?? []) as FeishuBlock[]));
    pageToken = res.data?.has_more ? res.data.page_token : undefined;
  } while (pageToken);

  return blocks;
}

async function fetchDocumentWithIdentity(doc: string, useUserToken: boolean): Promise<string> {
  let docToken = extractDocToken(doc);
  if (isWikiUrl(doc)) {
    docToken = await resolveWikiToken(docToken, useUserToken);
  }

  const blocks = await fetchAllBlocks(docToken, useUserToken);
  return blocksToMarkdown(blocks).trim();
}

/**
 * 拉取飞书文档 Markdown
 * 优先用户 token（复用 ~/.feishu-mcp 缓存），失败时降级应用身份
 */
export async function fetchFeishuDocumentContent(doc: string): Promise<string> {
  const userToken = await getFeishuUserAccessTokenIfAvailable();
  if (userToken) {
    try {
      const content = await fetchDocumentWithIdentity(doc, true);
      if (content) {
        return content;
      }
    } catch {
      // 用户身份失败，尝试应用身份
    }
  }

  const content = await fetchDocumentWithIdentity(doc, false);
  if (!content) {
    throw new Error('飞书文档内容为空');
  }
  return content;
}
