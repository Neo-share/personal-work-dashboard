import { describe, expect, it } from 'vitest';
import { getDb } from '../db/index.js';
import { retrieveForTodo } from './internal-knowledge-retriever.js';

function insertTodo(input: {
  title: string;
  description?: string;
  dueAt: string;
  aiResultType?: string;
}): number {
  const db = getDb();
  const now = new Date().toISOString();
  const result = db
    .prepare(
      `INSERT INTO todos (title, description, due_at, source, status, is_urgent, ai_status, ai_result_type, created_at, updated_at)
       VALUES (?, ?, ?, 'natural_language', 'active', 0, 'pending', ?, ?, ?)`,
    )
    .run(
      input.title,
      input.description ?? '来源：自然语言',
      input.dueAt,
      input.aiResultType ?? null,
      now,
      now,
    );
  return Number(result.lastInsertRowid);
}

function insertSchedule(title: string, startAt: string, endAt: string): number {
  const db = getDb();
  const now = new Date().toISOString();
  const result = db
    .prepare(
      `INSERT INTO schedule_events (title, start_at, end_at, is_merged, created_at)
       VALUES (?, ?, ?, 0, ?)`,
    )
    .run(title, startAt, endAt, now);
  const eventId = Number(result.lastInsertRowid);
  db.prepare(
    `INSERT INTO schedule_event_sources (event_id, source, title, start_at, end_at)
     VALUES (?, 'local', ?, ?, ?)`,
  ).run(eventId, title, startAt, endAt);
  return eventId;
}

describe('internal-knowledge-retriever', () => {
  it('纪要待办 generate：召回截止日前后日程 + 同类型历史结果', () => {
    const dueAt = new Date();
    dueAt.setHours(18, 0, 0, 0);
    const start = new Date(dueAt);
    start.setHours(10, 30, 0, 0);
    const end = new Date(dueAt);
    end.setHours(11, 30, 0, 0);

    insertSchedule('产品需求评审', start.toISOString(), end.toISOString());

    const historyTodoId = insertTodo({
      title: '做会议纪要',
      dueAt: dueAt.toISOString(),
      aiResultType: 'minutes',
    });
    const db = getDb();
    db.prepare(
      `INSERT INTO todo_ai_results (todo_id, version, result_type, html_content, status, provider, created_at)
       VALUES (?, 2, 'minutes', '<h3>会议纪要 v2</h3><p>已补充行动项。</p>', 'confirmed', 'rule-template', ?)`,
    ).run(historyTodoId, new Date().toISOString());

    const targetTodoId = insertTodo({
      title: '整理会议纪要',
      dueAt: dueAt.toISOString(),
      aiResultType: 'minutes',
    });

    const result = retrieveForTodo(targetTodoId, { intent: 'generate' });

    expect(result.resultType).toBe('minutes');
    expect(result.snippets.some((item) => item.label.includes('产品需求评审'))).toBe(true);
    expect(result.snippets.some((item) => item.sourceTable === 'todo_ai_results')).toBe(true);
  });

  it('revise：召回当前待办全部版本与绑定会话消息', () => {
    const dueAt = new Date().toISOString();
    const todoId = insertTodo({
      title: '做会议纪要',
      dueAt,
      aiResultType: 'minutes',
    });

    const db = getDb();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO todo_ai_results (todo_id, version, result_type, html_content, status, provider, created_at)
       VALUES (?, 1, 'minutes', '<h3>v1</h3>', 'ready', 'rule-template', ?)`,
    ).run(todoId, now);

    const session = db
      .prepare(
        `INSERT INTO assistant_sessions (title, todo_id, created_at, updated_at)
         VALUES ('修改会议纪要', ?, ?, ?)`,
      )
      .run(todoId, now, now);
    const sessionId = Number(session.lastInsertRowid);
    db.prepare(
      `INSERT INTO assistant_messages (session_id, role, content, created_at)
       VALUES (?, 'user', '补充结论：排期推迟一周', ?)`,
    ).run(sessionId, now);

    const result = retrieveForTodo(todoId, {
      intent: 'revise',
      userDelta: '补充结论：排期推迟一周',
    });

    expect(result.snippets.some((item) => item.label.includes('当前结果 v1'))).toBe(true);
    expect(result.snippets.some((item) => item.label.includes('对话'))).toBe(true);
    expect(result.snippets.some((item) => item.label.includes('用户修订意见'))).toBe(true);
  });
});
