import { describe, expect, it } from 'vitest';
import { getDb } from '../db/index.js';
import {
  buildTodoDescription,
  createRecurringTask,
  formatCycleLabel,
  materializeRecurringTask,
  runDueRecurringTasks,
} from './recurring-task-service.js';
import { getTodoById } from './todo-service.js';

describe('recurring-task-service', () => {
  it('formatCycleLabel 与 buildTodoDescription 格式化周期文案', () => {
    const task = {
      id: 1,
      title: '复盘',
      frequency: 'weekly' as const,
      dayOfWeek: 4,
      dayOfMonth: null,
      timeOfDay: '17:00',
      todoDescription: '',
      enabled: true,
      nextTriggerAt: null,
      createdAt: '',
      updatedAt: '',
    };

    expect(formatCycleLabel(task)).toBe('每周周四 17:00:00');
    expect(buildTodoDescription(task)).toContain('复盘');
    expect(buildTodoDescription(task)).toContain('每周周四');
  });

  it('daily 物化维持未来 5 条待办', () => {
    const task = createRecurringTask({
      title: '每日复盘',
      frequency: 'daily',
      timeOfDay: '17:00',
    });

    const db = getDb();
    const runCount = db
      .prepare('SELECT COUNT(*) as c FROM recurring_task_runs WHERE recurring_task_id = ?')
      .get(task.id) as { c: number };
    const todoCount = db
      .prepare('SELECT COUNT(*) as c FROM todos WHERE recurring_task_id = ?')
      .get(task.id) as { c: number };

    expect(runCount.c).toBe(5);
    expect(todoCount.c).toBe(5);

    const second = materializeRecurringTask(task.id);
    expect(second.todoIds).toHaveLength(0);
  });

  it('weekly 物化只生成下一次待办', () => {
    const task = createRecurringTask({
      title: '周会纪要',
      frequency: 'weekly',
      dayOfWeek: 5,
      timeOfDay: '09:00',
    });

    const db = getDb();
    const todoCount = db
      .prepare('SELECT COUNT(*) as c FROM todos WHERE recurring_task_id = ?')
      .get(task.id) as { c: number };

    expect(todoCount.c).toBe(1);

    materializeRecurringTask(task.id);
    const after = db
      .prepare('SELECT COUNT(*) as c FROM todos WHERE recurring_task_id = ?')
      .get(task.id) as { c: number };
    expect(after.c).toBe(1);
  });

  it('runDueRecurringTasks 包含全部 daily 与到期的 weekly/monthly', () => {
    const daily = createRecurringTask({
      title: '日任务',
      frequency: 'daily',
      timeOfDay: '08:00',
    });
    const weekly = createRecurringTask({
      title: '周任务',
      frequency: 'weekly',
      dayOfWeek: 1,
      timeOfDay: '10:00',
    });

    const db = getDb();
    // 模拟 weekly 已到期
    db.prepare('UPDATE recurring_tasks SET next_trigger_at = ? WHERE id = ?').run(
      new Date(Date.now() - 60_000).toISOString(),
      weekly.id,
    );

    const due = runDueRecurringTasks();
    expect(due.taskIds).toContain(daily.id);
    expect(due.taskIds).toContain(weekly.id);
  });

  // L1-04 04.09：物化待办属性
  it('04.09 物化待办来源为 recurring_task、描述含定时任务、截止为触发时刻', () => {
    const task = createRecurringTask({
      title: '每日复盘',
      frequency: 'daily',
      timeOfDay: '17:00',
    });

    const db = getDb();
    const run = db
      .prepare(
        `SELECT todo_id, trigger_at FROM recurring_task_runs WHERE recurring_task_id = ? ORDER BY trigger_at ASC LIMIT 1`,
      )
      .get(task.id) as { todo_id: number; trigger_at: string };

    const todo = getTodoById(run.todo_id);

    expect(todo).not.toBeNull();
    expect(todo!.source).toBe('recurring_task');
    expect(todo!.description).toContain('来源：定时任务');
    expect(todo!.dueAt).toBe(run.trigger_at);
    expect(todo!.recurringTaskId).toBe(task.id);
  });

  it('disabled 任务物化不产出待办', () => {
    const task = createRecurringTask({
      title: '已停用',
      frequency: 'monthly',
      dayOfMonth: 1,
      timeOfDay: '12:00',
    });

    const db = getDb();
    db.prepare('UPDATE recurring_tasks SET enabled = 0 WHERE id = ?').run(task.id);

    const { todoIds } = materializeRecurringTask(task.id);
    expect(todoIds).toHaveLength(0);
  });
});
