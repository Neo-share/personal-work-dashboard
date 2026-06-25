import {
  type PersonalAssistantRefresh,
  resolvePersonalWorkbenchInvalidateKeys,
} from '@project-manager/shared';

/** 个人工作台 invalidate 所需 tRPC utils 子集（便于单测 mock） */
export type PersonalWorkbenchTrpcUtils = {
  personalWorkbench: { summary: { invalidate: () => unknown } };
  todos: {
    list: { invalidate: () => unknown };
    aiResults: { invalidate: () => unknown };
  };
  schedule: { listDay: { invalidate: () => unknown } };
  recurringTasks: { list: { invalidate: () => unknown } };
};

/** 按 refresh 目标失效个人工作台相关 query（与 PersonalWorkbenchPage.handleRefresh 对齐） */
export function applyPersonalWorkbenchInvalidations(
  utils: PersonalWorkbenchTrpcUtils,
  targets?: PersonalAssistantRefresh[],
): void {
  for (const key of resolvePersonalWorkbenchInvalidateKeys(targets)) {
    switch (key) {
      case 'personalWorkbench.summary':
        void utils.personalWorkbench.summary.invalidate();
        break;
      case 'todos.list':
        void utils.todos.list.invalidate();
        break;
      case 'todos.aiResults':
        void utils.todos.aiResults.invalidate();
        break;
      case 'schedule.listDay':
        void utils.schedule.listDay.invalidate();
        break;
      case 'recurringTasks.list':
        void utils.recurringTasks.list.invalidate();
        break;
    }
  }
}
