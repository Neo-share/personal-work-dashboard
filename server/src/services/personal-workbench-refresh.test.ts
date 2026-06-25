import { describe, expect, it } from 'vitest';
import { resolvePersonalWorkbenchInvalidateKeys } from '@project-manager/shared';

/**
 * 回归：修订后须 invalidate todos.aiResults，否则待办 AI 面板仍显示旧 HTML
 */
describe('resolvePersonalWorkbenchInvalidateKeys', () => {
  it('targets 含 todos 时连带失效 aiResults', () => {
    const keys = resolvePersonalWorkbenchInvalidateKeys(['todos']);
    expect(keys).toContain('todos.list');
    expect(keys).toContain('todos.aiResults');
  });

  it('targets 为 all 时包含 aiResults', () => {
    const keys = resolvePersonalWorkbenchInvalidateKeys(['all']);
    expect(keys).toContain('todos.aiResults');
  });

  it('仅 schedule 时不失效 aiResults', () => {
    const keys = resolvePersonalWorkbenchInvalidateKeys(['schedule']);
    expect(keys).not.toContain('todos.aiResults');
    expect(keys).toContain('schedule.listDay');
  });
});
