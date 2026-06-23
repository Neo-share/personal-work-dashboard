import { createHash } from 'node:crypto';

interface ReviseCacheEntry {
  htmlContent: string;
  provider: string;
  snippetIds: string[];
}

const reviseCache = new Map<string, ReviseCacheEntry>();

function hashString(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** 修订意见归一化，同一会话重复表述可命中缓存 */
export function normalizeRevisionHint(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** 长对话中排除 assistant_messages 片段，避免每轮 key 变化 */
function buildStableSnippetIds(snippetIds: string[]): string {
  return snippetIds
    .filter((id) => !id.startsWith('assistant_messages:'))
    .sort()
    .join(',');
}

export function buildReviseSessionCacheKey(input: {
  sessionId: number;
  todoId: number;
  baseVersion: number;
  revisionHint: string;
  currentHtml: string;
  snippetIds: string[];
}): string {
  return [
    String(input.sessionId),
    String(input.todoId),
    String(input.baseVersion),
    normalizeRevisionHint(input.revisionHint),
    hashString(input.currentHtml),
    buildStableSnippetIds(input.snippetIds),
  ].join(':');
}

/** 用户关闭缓存时返回 false */
export function shouldUseReviseSessionCache(skipReviseCache?: boolean): boolean {
  return skipReviseCache !== true;
}

export function lookupReviseSessionCache(input: {
  sessionId: number;
  todoId: number;
  baseVersion: number;
  revisionHint: string;
  currentHtml: string;
  snippetIds: string[];
}): ReviseCacheEntry | null {
  const key = buildReviseSessionCacheKey(input);
  return reviseCache.get(key) ?? null;
}

export function storeReviseSessionCache(
  input: {
    sessionId: number;
    todoId: number;
    baseVersion: number;
    revisionHint: string;
    currentHtml: string;
    snippetIds: string[];
  },
  entry: ReviseCacheEntry,
): void {
  const key = buildReviseSessionCacheKey(input);
  reviseCache.set(key, entry);
}

/** 测试用：清空内存状态 */
export function resetReviseSessionCacheForTest(): void {
  reviseCache.clear();
}
