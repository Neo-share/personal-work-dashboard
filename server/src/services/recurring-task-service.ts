import type { RecurringFrequency, RecurringTask } from '@project-manager/shared';
import { getDb } from '../db/index.js';
import { createTodo } from './todo-service.js';

interface RecurringTaskRow {
  id: number;
  title: string;
  frequency: RecurringFrequency;
  day_of_week: number | null;
  day_of_month: number | null;
  time_of_day: string;
  todo_description: string;
  enabled: number;
  next_trigger_at: string | null;
  created_at: string;
  updated_at: string;
}

function mapRecurringTask(row: RecurringTaskRow): RecurringTask {
  return {
    id: row.id,
    title: row.title,
    frequency: row.frequency,
    dayOfWeek: row.day_of_week,
    dayOfMonth: row.day_of_month,
    timeOfDay: row.time_of_day,
    todoDescription: row.todo_description,
    enabled: row.enabled === 1,
    nextTriggerAt: row.next_trigger_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function formatCycleLabel(task: RecurringTask): string {
  const [hour, minute] = task.timeOfDay.split(':');
  const timeStr = `${hour}:${minute}:00`;
  switch (task.frequency) {
    case 'daily':
      return `每天 ${timeStr}`;
    case 'weekly': {
      const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
      return `每周${days[task.dayOfWeek ?? 0]} ${timeStr}`;
    }
    case 'monthly':
      return `每月${task.dayOfMonth ?? 1}日 ${timeStr}`;
    default:
      return timeStr;
  }
}

export function listRecurringTasks(): RecurringTask[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM recurring_tasks ORDER BY enabled DESC, created_at DESC')
    .all() as RecurringTaskRow[];
  return rows.map(mapRecurringTask);
}

export function getRecurringTaskById(id: number): RecurringTask | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM recurring_tasks WHERE id = ?').get(id) as
    | RecurringTaskRow
    | undefined;
  return row ? mapRecurringTask(row) : null;
}

export function buildTodoDescription(task: RecurringTask): string {
  return `到期将生成待办「${task.title}」（${formatCycleLabel(task)}）`;
}

export function createRecurringTask(input: {
  title: string;
  frequency: RecurringFrequency;
  dayOfWeek?: number;
  dayOfMonth?: number;
  timeOfDay: string;
}): RecurringTask {
  const db = getDb();
  const now = new Date().toISOString();
  const todoDescription = `到期将生成待办「${input.title}」`;

  const result = db
    .prepare(
      `INSERT INTO recurring_tasks (title, frequency, day_of_week, day_of_month, time_of_day, todo_description, enabled, next_trigger_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
    )
    .run(
      input.title,
      input.frequency,
      input.dayOfWeek ?? null,
      input.dayOfMonth ?? null,
      input.timeOfDay,
      todoDescription,
      computeNextTrigger(input.frequency, input.dayOfWeek, input.dayOfMonth, input.timeOfDay),
      now,
      now,
    );

  const taskId = Number(result.lastInsertRowid);
  materializeRecurringTask(taskId);
  return getRecurringTaskById(taskId)!;
}

export function updateRecurringTask(
  id: number,
  fields: {
    title?: string;
    frequency?: RecurringFrequency;
    dayOfWeek?: number | null;
    dayOfMonth?: number | null;
    timeOfDay?: string;
  },
): RecurringTask | null {
  const db = getDb();
  const existing = getRecurringTaskById(id);
  if (!existing) return null;

  const now = new Date().toISOString();
  const title = fields.title ?? existing.title;
  const frequency = fields.frequency ?? existing.frequency;
  const dayOfWeek = fields.dayOfWeek !== undefined ? fields.dayOfWeek : existing.dayOfWeek;
  const dayOfMonth = fields.dayOfMonth !== undefined ? fields.dayOfMonth : existing.dayOfMonth;
  const timeOfDay = fields.timeOfDay ?? existing.timeOfDay;
  const todoDescription = `到期将生成待办「${title}」`;

  db.prepare(
    `UPDATE recurring_tasks SET title = ?, frequency = ?, day_of_week = ?, day_of_month = ?, time_of_day = ?, todo_description = ?, next_trigger_at = ?, updated_at = ? WHERE id = ?`,
  ).run(
    title,
    frequency,
    dayOfWeek,
    dayOfMonth,
    timeOfDay,
    todoDescription,
    computeNextTrigger(frequency, dayOfWeek, dayOfMonth, timeOfDay),
    now,
    id,
  );

  return getRecurringTaskById(id);
}

export function toggleRecurringTask(id: number, enabled: boolean): RecurringTask | null {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare('UPDATE recurring_tasks SET enabled = ?, updated_at = ? WHERE id = ?').run(
    enabled ? 1 : 0,
    now,
    id,
  );
  return getRecurringTaskById(id);
}

export function deleteRecurringTask(id: number): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM recurring_tasks WHERE id = ?').run(id);
  return result.changes > 0;
}

function computeNextTrigger(
  frequency: RecurringFrequency,
  dayOfWeek: number | null | undefined,
  dayOfMonth: number | null | undefined,
  timeOfDay: string,
): string {
  const now = new Date();
  const [hour, minute] = timeOfDay.split(':').map(Number);
  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);

  if (frequency === 'daily') {
    if (next <= now) next.setDate(next.getDate() + 1);
  } else if (frequency === 'weekly') {
    const target = dayOfWeek ?? 4;
    const current = now.getDay();
    let diff = target - current;
    if (diff <= 0 || (diff === 0 && next <= now)) diff += 7;
    next.setDate(now.getDate() + diff);
  } else if (frequency === 'monthly') {
    const target = dayOfMonth ?? 15;
    next.setDate(target);
    if (next <= now) next.setMonth(next.getMonth() + 1);
  }

  return next.toISOString();
}

/** 物化待办：每天维持未来 5 天；每周/月只生成下一次 */
export function materializeRecurringTask(id: number): { todoIds: number[] } {
  const db = getDb();
  const task = getRecurringTaskById(id);
  if (!task || !task.enabled) return { todoIds: [] };

  const now = new Date().toISOString();
  const todoIds: number[] = [];

  if (task.frequency === 'daily') {
    // 滚动维持未来 5 个自然日各 1 条
    for (let i = 0; i < 5; i++) {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + i);
      const [hour, minute] = task.timeOfDay.split(':').map(Number);
      dueDate.setHours(hour, minute, 0, 0);

      const existing = db
        .prepare(
          `SELECT id FROM recurring_task_runs WHERE recurring_task_id = ? AND trigger_at = ?`,
        )
        .get(id, dueDate.toISOString()) as { id: number } | undefined;

      if (existing) continue;

      const todo = createTodo({
        title: task.title,
        description: `来源：定时任务`,
        dueAt: dueDate.toISOString(),
        source: 'recurring_task',
        recurringTaskId: id,
      });
      todoIds.push(todo.id);

      db.prepare(
        `INSERT INTO recurring_task_runs (recurring_task_id, todo_id, trigger_at, created_at)
         VALUES (?, ?, ?, ?)`,
      ).run(id, todo.id, dueDate.toISOString(), now);
    }
  } else {
    const triggerAt = task.nextTriggerAt ?? computeNextTrigger(
      task.frequency,
      task.dayOfWeek,
      task.dayOfMonth,
      task.timeOfDay,
    );

    const existing = db
      .prepare(
        `SELECT id FROM recurring_task_runs WHERE recurring_task_id = ? AND trigger_at = ?`,
      )
      .get(id, triggerAt) as { id: number } | undefined;

    if (!existing) {
      const todo = createTodo({
        title: task.title,
        description: `来源：定时任务`,
        dueAt: triggerAt,
        source: 'recurring_task',
        recurringTaskId: id,
      });
      todoIds.push(todo.id);

      db.prepare(
        `INSERT INTO recurring_task_runs (recurring_task_id, todo_id, trigger_at, created_at)
         VALUES (?, ?, ?, ?)`,
      ).run(id, todo.id, triggerAt, now);
    }

    db.prepare('UPDATE recurring_tasks SET next_trigger_at = ?, updated_at = ? WHERE id = ?').run(
      computeNextTrigger(task.frequency, task.dayOfWeek, task.dayOfMonth, task.timeOfDay),
      now,
      id,
    );
  }

  return { todoIds };
}

/** 扫描需要物化的定时任务：daily 维持滚动窗口；weekly/monthly 按 next_trigger_at 到期触发 */
export function runDueRecurringTasks(): { taskIds: number[] } {
  const db = getDb();
  const now = new Date().toISOString();
  const taskIds: number[] = [];

  const dailyRows = db
    .prepare(`SELECT id FROM recurring_tasks WHERE enabled = 1 AND frequency = 'daily'`)
    .all() as Array<{ id: number }>;
  for (const row of dailyRows) {
    taskIds.push(row.id);
  }

  const dueRows = db
    .prepare(
      `SELECT id FROM recurring_tasks
       WHERE enabled = 1 AND frequency != 'daily'
         AND next_trigger_at IS NOT NULL AND next_trigger_at <= ?`,
    )
    .all(now) as Array<{ id: number }>;
  for (const row of dueRows) {
    if (!taskIds.includes(row.id)) taskIds.push(row.id);
  }

  return { taskIds };
}

export { formatCycleLabel };
