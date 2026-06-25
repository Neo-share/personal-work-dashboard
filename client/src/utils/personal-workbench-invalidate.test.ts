import { describe, expect, it, vi } from 'vitest';
import { applyPersonalWorkbenchInvalidations } from './personal-workbench-invalidate';

function createMockUtils() {
  return {
    personalWorkbench: { summary: { invalidate: vi.fn() } },
    todos: {
      list: { invalidate: vi.fn() },
      aiResults: { invalidate: vi.fn() },
    },
    schedule: { listDay: { invalidate: vi.fn() } },
    recurringTasks: { list: { invalidate: vi.fn() } },
  };
}

describe('applyPersonalWorkbenchInvalidations', () => {
  it('targets 含 todos 时连带失效 aiResults', () => {
    const utils = createMockUtils();
    applyPersonalWorkbenchInvalidations(utils, ['todos']);

    expect(utils.todos.list.invalidate).toHaveBeenCalledOnce();
    expect(utils.todos.aiResults.invalidate).toHaveBeenCalledOnce();
    expect(utils.schedule.listDay.invalidate).not.toHaveBeenCalled();
  });

  it('targets 为 summary 时仅失效 summary', () => {
    const utils = createMockUtils();
    applyPersonalWorkbenchInvalidations(utils, ['summary']);

    expect(utils.personalWorkbench.summary.invalidate).toHaveBeenCalledOnce();
    expect(utils.todos.list.invalidate).not.toHaveBeenCalled();
    expect(utils.todos.aiResults.invalidate).not.toHaveBeenCalled();
  });

  it('未传 targets 时失效全部个人工作台 query', () => {
    const utils = createMockUtils();
    applyPersonalWorkbenchInvalidations(utils);

    expect(utils.personalWorkbench.summary.invalidate).toHaveBeenCalledOnce();
    expect(utils.todos.list.invalidate).toHaveBeenCalledOnce();
    expect(utils.todos.aiResults.invalidate).toHaveBeenCalledOnce();
    expect(utils.schedule.listDay.invalidate).toHaveBeenCalledOnce();
    expect(utils.recurringTasks.list.invalidate).toHaveBeenCalledOnce();
  });
});
