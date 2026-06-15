import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { getFeishuChatDeepLink, resolveFeishuOpenId } from '@project-manager/shared';
import type { Person } from '@project-manager/shared';
import { getPersonById } from './people-service.js';

const execFileAsync = promisify(execFile);

export class FeishuOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FeishuOpenError';
  }
}

async function openDeepLink(url: string): Promise<void> {
  if (process.platform === 'darwin') {
    await execFileAsync('open', [url]);
    return;
  }

  if (process.platform === 'win32') {
    await execFileAsync('cmd', ['/c', 'start', '', url]);
    return;
  }

  await execFileAsync('xdg-open', [url]);
}

export async function openPersonFeishuChat(personId: number): Promise<{ ok: true; openId: string }> {
  const person = getPersonById(personId);
  if (!person) {
    throw new FeishuOpenError('人员不存在');
  }

  const openId = resolveFeishuOpenId(person);
  if (!openId) {
    throw new FeishuOpenError('未配置飞书 Open ID，请在关联人员中填写 ou_ 开头的 ID');
  }

  try {
    await openDeepLink(getFeishuChatDeepLink(openId));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new FeishuOpenError(`无法唤起飞书客户端：${detail}`);
  }

  return { ok: true, openId };
}

export function resolvePersonFeishuOpenId(person: Pick<Person, 'feishuOpenId' | 'contact'>): string | null {
  return resolveFeishuOpenId(person);
}
