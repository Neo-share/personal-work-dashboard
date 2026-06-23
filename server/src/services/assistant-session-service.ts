import type { AssistantMessage, AssistantSession, TodoAiThread } from '@project-manager/shared';
import { getDb } from '../db/index.js';

export function listAssistantSessions(): AssistantSession[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT s.*, (SELECT COUNT(*) FROM assistant_messages WHERE session_id = s.id) as message_count
       FROM assistant_sessions s ORDER BY s.updated_at DESC`,
    )
    .all() as Array<{
    id: number;
    title: string;
    todo_id: number | null;
    created_at: string;
    updated_at: string;
    message_count: number;
  }>;

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    todoId: row.todo_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    messageCount: row.message_count,
  }));
}

export function getAssistantMessages(sessionId: number): AssistantMessage[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM assistant_messages WHERE session_id = ? ORDER BY created_at ASC')
    .all(sessionId) as Array<{
    id: number;
    session_id: number;
    role: string;
    content: string;
    ai_result_id: number | null;
    created_at: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    sessionId: row.session_id,
    role: row.role as 'user' | 'assistant',
    content: row.content,
    aiResultId: row.ai_result_id,
    createdAt: row.created_at,
  }));
}

export function createAssistantSession(title: string, todoId?: number): AssistantSession {
  const db = getDb();
  const now = new Date().toISOString();
  const result = db
    .prepare(
      `INSERT INTO assistant_sessions (title, todo_id, created_at, updated_at) VALUES (?, ?, ?, ?)`,
    )
    .run(title, todoId ?? null, now, now);

  return {
    id: Number(result.lastInsertRowid),
    title,
    todoId: todoId ?? null,
    createdAt: now,
    updatedAt: now,
    messageCount: 0,
  };
}

export function appendAssistantMessage(
  sessionId: number,
  role: 'user' | 'assistant',
  content: string,
  aiResultId?: number,
): AssistantMessage {
  const db = getDb();
  const now = new Date().toISOString();
  const result = db
    .prepare(
      `INSERT INTO assistant_messages (session_id, role, content, ai_result_id, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(sessionId, role, content, aiResultId ?? null, now);

  db.prepare('UPDATE assistant_sessions SET updated_at = ? WHERE id = ?').run(now, sessionId);

  return {
    id: Number(result.lastInsertRowid),
    sessionId,
    role,
    content,
    aiResultId: aiResultId ?? null,
    createdAt: now,
  };
}

export function getOrCreateDefaultSession(): AssistantSession {
  const sessions = listAssistantSessions();
  if (sessions.length > 0) return sessions[0];
  return createAssistantSession('默认对话');
}

/** 历史对话左栏：有 AI 结果的待办线程 */
export function listTodoAiThreads(): TodoAiThread[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT t.id as todo_id, t.title,
              MAX(r.version) as latest_version,
              (SELECT html_content FROM todo_ai_results
               WHERE todo_id = t.id ORDER BY version DESC LIMIT 1) as latest_html,
              (SELECT COUNT(*) FROM assistant_messages m
               JOIN assistant_sessions s ON s.id = m.session_id
               WHERE s.todo_id = t.id OR m.ai_result_id IN (
                 SELECT id FROM todo_ai_results WHERE todo_id = t.id
               )) as message_count
       FROM todos t
       JOIN todo_ai_results r ON r.todo_id = t.id
       GROUP BY t.id
       ORDER BY MAX(r.created_at) DESC`,
    )
    .all() as Array<{
    todo_id: number;
    title: string;
    latest_version: number;
    latest_html: string | null;
    message_count: number;
  }>;

  return rows.map((row) => ({
    todoId: row.todo_id,
    title: row.title,
    latestVersion: row.latest_version,
    messageCount: row.message_count,
    latestHtmlPreview: row.latest_html,
  }));
}
