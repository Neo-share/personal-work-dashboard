import type { Person } from '@project-manager/shared';
import { getFeishuChatDeepLink, resolveFeishuOpenId } from '@project-manager/shared';

export { resolveFeishuOpenId };

/** 通过 lark:// 协议唤起飞书客户端；若无法解析 open_id 则返回 false */
export function openFeishuChat(person: Pick<Person, 'feishuOpenId' | 'contact'>): boolean {
  const openId = resolveFeishuOpenId(person);
  if (!openId) return false;

  const link = document.createElement('a');
  link.href = getFeishuChatDeepLink(openId);
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  return true;
}
