/** 飞书 open_id 前缀（ou_） */
const FEISHU_OPEN_ID_PATTERN = /^ou_[a-zA-Z0-9]+$/;

/** 从 applink URL 中提取 openId 参数 */
function extractOpenIdFromUrl(value: string): string | null {
  try {
    const url = new URL(value);
    const openId = url.searchParams.get('openId') ?? url.searchParams.get('open_id');
    if (openId && FEISHU_OPEN_ID_PATTERN.test(openId)) {
      return openId;
    }
  } catch {
    // 非 URL 格式，忽略
  }
  return null;
}

/** 解析人员对应的飞书 open_id（优先 feishuOpenId，其次从 contact 解析） */
export function resolveFeishuOpenId(person: {
  feishuOpenId: string | null;
  contact: string | null;
}): string | null {
  if (person.feishuOpenId?.trim()) {
    return person.feishuOpenId.trim();
  }

  const contact = person.contact?.trim();
  if (!contact) return null;

  if (FEISHU_OPEN_ID_PATTERN.test(contact)) {
    return contact;
  }

  if (contact.includes('feishu.cn') || contact.startsWith('lark://')) {
    return extractOpenIdFromUrl(contact);
  }

  return null;
}

/** 本地唤起飞书客户端的 deep link（lark:// 而非 https://，避免先打开浏览器中间页） */
export function getFeishuChatDeepLink(openId: string): string {
  return `lark://applink.feishu.cn/client/chat/open?openId=${encodeURIComponent(openId)}`;
}
