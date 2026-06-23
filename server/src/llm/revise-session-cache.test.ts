import { describe, expect, it, beforeEach } from 'vitest';
import {
  buildReviseSessionCacheKey,
  lookupReviseSessionCache,
  normalizeRevisionHint,
  resetReviseSessionCacheForTest,
  shouldUseReviseSessionCache,
  storeReviseSessionCache,
} from './revise-session-cache.js';

describe('revise-session-cache', () => {
  beforeEach(() => {
    resetReviseSessionCacheForTest();
  });

  it('normalizeRevisionHint 折叠空白与大小写', () => {
    expect(normalizeRevisionHint('  补充  结论  ')).toBe('补充 结论');
  });

  it('同一会话相同修订请求可命中缓存', () => {
    const input = {
      sessionId: 1,
      todoId: 10,
      baseVersion: 2,
      revisionHint: '补充结论',
      currentHtml: '<h3>v2</h3>',
      snippetIds: ['todo_ai_results:1'],
    };
    storeReviseSessionCache(input, {
      htmlContent: '<h3>revised</h3>',
      provider: 'llm',
      snippetIds: input.snippetIds,
    });
    expect(lookupReviseSessionCache(input)?.htmlContent).toBe('<h3>revised</h3>');
  });

  it('不同 session 不共享缓存', () => {
    const base = {
      todoId: 10,
      baseVersion: 1,
      revisionHint: '精简',
      currentHtml: '<p>a</p>',
      snippetIds: [] as string[],
    };
    storeReviseSessionCache(
      { sessionId: 1, ...base },
      { htmlContent: 'cached', provider: 'llm', snippetIds: [] },
    );
    expect(lookupReviseSessionCache({ sessionId: 2, ...base })).toBeNull();
  });

  it('用户 skipReviseCache 时不使用缓存', () => {
    expect(shouldUseReviseSessionCache()).toBe(true);
    expect(shouldUseReviseSessionCache(true)).toBe(false);
  });

  it('skipReviseCache 时仍可构建 cache key', () => {
    const input = {
      sessionId: 1,
      todoId: 10,
      baseVersion: 1,
      revisionHint: 'x',
      currentHtml: '<p>y</p>',
      snippetIds: [] as string[],
    };
    storeReviseSessionCache(input, {
      htmlContent: 'cached',
      provider: 'llm',
      snippetIds: [],
    });
    expect(buildReviseSessionCacheKey(input)).toContain('1:10:1');
  });
});
