import type {
  AiResultType,
  ExternalSnippet,
  PersonalWorkbenchSummary,
  TodoAiResult,
  TodoFilter,
  TodoItem,
  TodoSource,
  TodoStatus,
} from '@project-manager/shared';
import { getDb } from '../db/index.js';
import { detectCapability, scheduleAiResultGeneration } from './ai-result-service.js';

interface TodoRow {
  id: number;
  title: string;
  description: string | null;
  due_at: string | null;
  source: TodoSource;
  status: TodoStatus;
  is_urgent: number;
  ai_status: string;
  ai_result_type: string | null;
  recurring_task_id: number | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

function mapTodo(row: TodoRow): TodoItem {
  const now = new Date();
  const isOverdue =
    row.status === 'active' &&
    row.due_at !== null &&
    new Date(row.due_at) < now;

  const db = getDb();
  const latestVersion = db
    .prepare('SELECT MAX(version) as v FROM todo_ai_results WHERE todo_id = ?')
    .get(row.id) as { v: number | null };

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    dueAt: row.due_at,
    source: row.source,
    status: row.status,
    isUrgent: row.is_urgent === 1,
    aiStatus: row.ai_status as TodoItem['aiStatus'],
    aiResultType: row.ai_result_type as AiResultType | null,
    recurringTaskId: row.recurring_task_id,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isOverdue,
    latestAiVersion: latestVersion.v,
  };
}

export function listTodos(filter: TodoFilter = 'active'): TodoItem[] {
  const db = getDb();
  const now = new Date().toISOString();
  let rows: TodoRow[];

  switch (filter) {
    case 'completed':
      rows = db
        .prepare(
          `SELECT * FROM todos WHERE status = 'completed' ORDER BY completed_at DESC`,
        )
        .all() as TodoRow[];
      break;
    case 'overdue':
      rows = db
        .prepare(
          `SELECT * FROM todos WHERE status = 'active' AND due_at IS NOT NULL AND due_at < ? ORDER BY due_at ASC`,
        )
        .all(now) as TodoRow[];
      break;
    case 'all':
      rows = db
        .prepare(`SELECT * FROM todos WHERE status != 'cancelled' ORDER BY status ASC, due_at ASC`)
        .all() as TodoRow[];
      break;
    default:
      rows = db
        .prepare(
          `SELECT * FROM todos WHERE status = 'active' ORDER BY is_urgent DESC, due_at ASC`,
        )
        .all() as TodoRow[];
  }

  return rows.map(mapTodo);
}

export function getTodoById(id: number): TodoItem | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM todos WHERE id = ?').get(id) as TodoRow | undefined;
  return row ? mapTodo(row) : null;
}

export function createTodo(input: {
  title: string;
  description?: string;
  dueAt?: string;
  source?: TodoSource;
  isUrgent?: boolean;
  recurringTaskId?: number;
  triggerAi?: boolean;
  externalSnippets?: ExternalSnippet[];
}): TodoItem {
  const db = getDb();
  const now = new Date().toISOString();
  const source = input.source ?? 'manual';
  const capability = detectCapability(input.title, input.description);

  const result = db
    .prepare(
      `INSERT INTO todos (title, description, due_at, source, status, is_urgent, ai_status, ai_result_type, recurring_task_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.title,
      input.description ?? null,
      input.dueAt ?? null,
      source,
      input.isUrgent ? 1 : 0,
      capability.canAuto && (input.triggerAi !== false) ? 'pending' : 'none',
      capability.resultType,
      input.recurringTaskId ?? null,
      now,
      now,
    );

  const todoId = Number(result.lastInsertRowid);

  if (capability.canAuto && capability.resultType && input.triggerAi !== false) {
    scheduleAiResultGeneration(
      todoId,
      capability.resultType,
      input.title,
      input.externalSnippets,
    );
  } else if (!capability.canAuto) {
    db.prepare(`UPDATE todos SET description = ? WHERE id = ?`).run(
      input.description ?? capability.reason,
      todoId,
    );
  }

  return getTodoById(todoId)!;
}

export function updateTodo(
  id: number,
  fields: {
    title?: string;
    description?: string | null;
    dueAt?: string | null;
    isUrgent?: boolean;
  },
): TodoItem | null {
  const db = getDb();
  const existing = getTodoById(id);
  if (!existing) return null;

  const now = new Date().toISOString();
  db.prepare(
    `UPDATE todos SET title = ?, description = ?, due_at = ?, is_urgent = ?, updated_at = ? WHERE id = ?`,
  ).run(
    fields.title ?? existing.title,
    fields.description !== undefined ? fields.description : existing.description,
    fields.dueAt !== undefined ? fields.dueAt : existing.dueAt,
    fields.isUrgent !== undefined ? (fields.isUrgent ? 1 : 0) : existing.isUrgent ? 1 : 0,
    now,
    id,
  );

  return getTodoById(id);
}

export function completeTodo(id: number): TodoItem | null {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE todos SET status = 'completed', completed_at = ?, updated_at = ? WHERE id = ?`,
  ).run(now, now, id);
  return getTodoById(id);
}

export function restoreTodo(id: number): TodoItem | null {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE todos SET status = 'active', completed_at = NULL, updated_at = ? WHERE id = ?`,
  ).run(now, id);
  return getTodoById(id);
}

export function cancelTodo(id: number): TodoItem | null {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE todos SET status = 'cancelled', updated_at = ? WHERE id = ?`,
  ).run(now, id);
  return getTodoById(id);
}

export function deleteTodo(id: number): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM todos WHERE id = ?').run(id);
  return result.changes > 0;
}

export function getTodoAiResults(todoId: number): TodoAiResult[] {
  const db = getDb();
  const rows = db
    .prepare(
      'SELECT * FROM todo_ai_results WHERE todo_id = ? ORDER BY version ASC',
    )
    .all(todoId) as Array<{
    id: number;
    todo_id: number;
    version: number;
    result_type: string;
    html_content: string;
    status: string;
    provider: string | null;
    created_at: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    todoId: row.todo_id,
    version: row.version,
    resultType: row.result_type as AiResultType,
    htmlContent: row.html_content,
    status: row.status as TodoAiResult['status'],
    provider: row.provider,
    createdAt: row.created_at,
  }));
}

export function confirmAiResult(todoId: number, resultId: number): TodoItem | null {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`UPDATE todo_ai_results SET status = 'confirmed' WHERE id = ? AND todo_id = ?`).run(
    resultId,
    todoId,
  );
  db.prepare(
    `UPDATE todos SET ai_status = 'confirmed', status = 'completed', completed_at = ?, description = '个人助手结果已确认', updated_at = ? WHERE id = ?`,
  ).run(now, now, todoId);
  return getTodoById(todoId);
}

export function getPersonalWorkbenchSummary(dateStr?: string): PersonalWorkbenchSummary {
  const db = getDb();
  const now = new Date().toISOString();

  const rangeDate = dateStr ? new Date(dateStr) : new Date();
  rangeDate.setHours(0, 0, 0, 0);
  const dayStart = rangeDate.toISOString();
  const dayEndDate = new Date(rangeDate);
  dayEndDate.setHours(23, 59, 59, 999);
  const dayEnd = dayEndDate.toISOString();

  const todoCount = (
    db.prepare(`SELECT COUNT(*) as c FROM todos WHERE status = 'active'`).get() as { c: number }
  ).c;
  const overdueCount = (
    db
      .prepare(
        `SELECT COUNT(*) as c FROM todos WHERE status = 'active' AND due_at IS NOT NULL AND due_at < ?`,
      )
      .get(now) as { c: number }
  ).c;
  const completedCount = (
    db.prepare(`SELECT COUNT(*) as c FROM todos WHERE status = 'completed'`).get() as { c: number }
  ).c;

  const rawScheduleCount = (
    db
      .prepare(
        `SELECT COUNT(*) as c FROM schedule_event_sources ses
         JOIN schedule_events se ON se.id = ses.event_id
         WHERE se.start_at >= ? AND se.start_at <= ?`,
      )
      .get(dayStart, dayEnd) as { c: number }
  ).c;

  const scheduleCount = (
    db
      .prepare(
        `SELECT COUNT(*) as c FROM schedule_events WHERE start_at >= ? AND start_at <= ?`,
      )
      .get(dayStart, dayEnd) as { c: number }
  ).c;

  return {
    scheduleCount,
    todoCount,
    overdueCount,
    completedCount,
    rawScheduleCount,
  };
}
