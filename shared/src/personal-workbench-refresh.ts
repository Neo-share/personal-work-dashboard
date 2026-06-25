import type { PersonalAssistantRefresh } from './types.js';

/** 个人工作台 query 失效键（与 client handleRefresh 对齐） */
export type PersonalWorkbenchInvalidateKey =
  | 'personalWorkbench.summary'
  | 'todos.list'
  | 'todos.aiResults'
  | 'schedule.listDay'
  | 'recurringTasks.list';

/**
 * 将 PersonalAssistantRefresh 展开为须 invalidate 的 query 键。
 * 刷新 todos 时须连带 aiResults（AiResultPanel 独立查询，否则修订后 HTML 不更新）。
 */
export function resolvePersonalWorkbenchInvalidateKeys(
  targets?: PersonalAssistantRefresh[],
): PersonalWorkbenchInvalidateKey[] {
  if (!targets || targets.includes('all')) {
    return [
      'personalWorkbench.summary',
      'todos.list',
      'todos.aiResults',
      'schedule.listDay',
      'recurringTasks.list',
    ];
  }

  const keys: PersonalWorkbenchInvalidateKey[] = [];
  if (targets.includes('summary')) keys.push('personalWorkbench.summary');
  if (targets.includes('todos')) {
    keys.push('todos.list');
    keys.push('todos.aiResults');
  }
  if (targets.includes('schedule')) keys.push('schedule.listDay');
  if (targets.includes('recurringTasks')) keys.push('recurringTasks.list');
  return keys;
}
