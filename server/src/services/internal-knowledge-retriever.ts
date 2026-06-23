import type { AiResultType, TodoItem } from '@project-manager/shared';
import { getDb } from '../db/index.js';
import { detectCapability } from './ai-result-service.js';
import { getTodoById } from './todo-service.js';

/** 检索意图：初次生成 vs 多轮修订 */
export type KnowledgeRetrieveIntent = 'generate' | 'revise';

export type KnowledgeSnippetSourceTable =
  | 'schedule_events'
  | 'todo_ai_results'
  | 'todos'
  | 'assistant_messages';

/** 内部知识片段（R0 规则检索输出） */
export interface KnowledgeSnippet {
  id: string;
  sourceTable: KnowledgeSnippetSourceTable;
  sourceId: number;
  label: string;
  excerpt: string;
}

export interface RetrieveForTodoOptions {
  intent: KnowledgeRetrieveIntent;
  /** 修订场景的用户修改意见 */
  userDelta?: string;
  /** 最大片段数，默认 10 */
  limit?: number;
}

export interface RetrieveForTodoResult {
  todoId: number;
  intent: KnowledgeRetrieveIntent;
  resultType: AiResultType | null;
  snippets: KnowledgeSnippet[];
}

const DEFAULT_SNIPPET_LIMIT = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

/** 标题关键词停用词（R0 规则过滤） */
const TITLE_STOP_WORDS = new Set([
  '完成',
  '提醒',
  '整理',
  '进行',
  '待办',
  '事项',
  '帮我',
  '请',
]);

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function formatScheduleTime(iso: string): string {
  const date = new Date(iso);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function extractTitleKeywords(title: string): string[] {
  const tokens = title.match(/[\u4e00-\u9fa5]{2,}|[A-Za-z][A-Za-z0-9_-]*/g) ?? [];
  return [...new Set(tokens.filter((token) => !TITLE_STOP_WORDS.has(token)))];
}

function resolveResultType(todo: TodoItem): AiResultType | null {
  if (todo.aiResultType) {
    return todo.aiResultType;
  }
  return detectCapability(todo.title, todo.description).resultType;
}

function getDueWindow(todo: TodoItem): { start: string; end: string } {
  const anchor = todo.dueAt ? new Date(todo.dueAt) : new Date();
  const start = new Date(anchor.getTime() - DAY_MS);
  const end = new Date(anchor.getTime() + DAY_MS);
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

function pushSnippet(
  snippets: KnowledgeSnippet[],
  snippet: KnowledgeSnippet,
  limit: number,
): void {
  if (snippets.length >= limit) {
    return;
  }
  snippets.push(snippet);
}

function retrieveScheduleSnippets(
  todo: TodoItem,
  limit: number,
  bucket: KnowledgeSnippet[],
): void {
  const { start, end } = getDueWindow(todo);
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT se.id, se.title, se.start_at, se.end_at,
              GROUP_CONCAT(ses.source) as sources
       FROM schedule_events se
       LEFT JOIN schedule_event_sources ses ON ses.event_id = se.id
       WHERE se.start_at >= ? AND se.start_at <= ?
       GROUP BY se.id
       ORDER BY se.start_at ASC
       LIMIT ?`,
    )
    .all(start, end, limit) as Array<{
    id: number;
    title: string;
    start_at: string;
    end_at: string;
    sources: string | null;
  }>;

  for (const row of rows) {
    if (bucket.length >= limit) break;
    const sourceLabel = row.sources?.split(',').join('/') ?? 'local';
    pushSnippet(bucket, {
      id: `schedule_events:${row.id}`,
      sourceTable: 'schedule_events',
      sourceId: row.id,
      label: `日程 · ${row.title}`,
      excerpt: `${row.title} ${formatScheduleTime(row.start_at)}-${formatScheduleTime(row.end_at)}（${sourceLabel}）`,
    }, limit);
  }
}

function retrieveHistoricalAiResults(
  todo: TodoItem,
  resultType: AiResultType,
  limit: number,
  bucket: KnowledgeSnippet[],
): void {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT tar.id, tar.version, tar.html_content, tar.status, t.title as todo_title
       FROM todo_ai_results tar
       INNER JOIN todos t ON t.id = tar.todo_id
       WHERE tar.result_type = ?
         AND tar.todo_id != ?
         AND tar.status IN ('ready', 'confirmed')
       ORDER BY tar.created_at DESC
       LIMIT ?`,
    )
    .all(resultType, todo.id, limit) as Array<{
    id: number;
    version: number;
    html_content: string;
    status: string;
    todo_title: string;
  }>;

  for (const row of rows) {
    if (bucket.length >= limit) break;
    const text = stripHtml(row.html_content).slice(0, 200);
    pushSnippet(bucket, {
      id: `todo_ai_results:${row.id}`,
      sourceTable: 'todo_ai_results',
      sourceId: row.id,
      label: `历史${resultType} v${row.version} · ${row.todo_title}`,
      excerpt: text,
    }, limit);
  }
}

function retrieveCompletedTodos(
  todo: TodoItem,
  limit: number,
  bucket: KnowledgeSnippet[],
): void {
  const db = getDb();
  const since = new Date(Date.now() - 7 * DAY_MS).toISOString();
  const rows = db
    .prepare(
      `SELECT id, title, description, completed_at
       FROM todos
       WHERE status = 'completed'
         AND id != ?
         AND completed_at IS NOT NULL
         AND completed_at >= ?
       ORDER BY completed_at DESC
       LIMIT ?`,
    )
    .all(todo.id, since, limit) as Array<{
    id: number;
    title: string;
    description: string | null;
    completed_at: string;
  }>;

  for (const row of rows) {
    if (bucket.length >= limit) break;
    pushSnippet(bucket, {
      id: `todos:${row.id}`,
      sourceTable: 'todos',
      sourceId: row.id,
      label: `已完成待办 · ${row.title}`,
      excerpt: `${row.title}${row.description ? `；${row.description}` : ''}`,
    }, limit);
  }
}

function retrieveKeywordTodos(
  todo: TodoItem,
  limit: number,
  bucket: KnowledgeSnippet[],
): void {
  const keywords = extractTitleKeywords(todo.title);
  if (keywords.length === 0) {
    return;
  }

  const db = getDb();
  for (const keyword of keywords) {
    if (bucket.length >= limit) break;
    const rows = db
      .prepare(
        `SELECT id, title, description
         FROM todos
         WHERE id != ? AND status != 'cancelled' AND title LIKE ?
         ORDER BY updated_at DESC
         LIMIT ?`,
      )
      .all(todo.id, `%${keyword}%`, Math.max(1, limit - bucket.length)) as Array<{
      id: number;
      title: string;
      description: string | null;
    }>;

    for (const row of rows) {
      if (bucket.length >= limit) break;
      const snippetId = `todos:${row.id}`;
      if (bucket.some((item) => item.id === snippetId)) {
        continue;
      }
      pushSnippet(bucket, {
        id: snippetId,
        sourceTable: 'todos',
        sourceId: row.id,
        label: `相关待办 · ${row.title}`,
        excerpt: `${row.title}${row.description ? `；${row.description}` : ''}`,
      }, limit);
    }
  }
}

function retrieveTodoAiVersions(
  todoId: number,
  limit: number,
  bucket: KnowledgeSnippet[],
): void {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, version, html_content, status
       FROM todo_ai_results
       WHERE todo_id = ?
       ORDER BY version ASC`,
    )
    .all(todoId) as Array<{
    id: number;
    version: number;
    html_content: string;
    status: string;
  }>;

  for (const row of rows) {
    if (bucket.length >= limit) break;
    pushSnippet(bucket, {
      id: `todo_ai_results:${row.id}`,
      sourceTable: 'todo_ai_results',
      sourceId: row.id,
      label: `当前结果 v${row.version}`,
      excerpt: stripHtml(row.html_content).slice(0, 400),
    }, limit);
  }
}

function retrieveAssistantThread(
  todoId: number,
  limit: number,
  bucket: KnowledgeSnippet[],
): void {
  const db = getDb();
  const sessions = db
    .prepare(`SELECT id FROM assistant_sessions WHERE todo_id = ? ORDER BY updated_at DESC LIMIT 1`)
    .all(todoId) as Array<{ id: number }>;
  if (sessions.length === 0) {
    return;
  }

  const rows = db
    .prepare(
      `SELECT id, role, content
       FROM assistant_messages
       WHERE session_id = ?
       ORDER BY id DESC
       LIMIT ?`,
    )
    .all(sessions[0].id, limit) as Array<{
    id: number;
    role: string;
    content: string;
  }>;

  for (const row of rows.reverse()) {
    if (bucket.length >= limit) break;
    pushSnippet(bucket, {
      id: `assistant_messages:${row.id}`,
      sourceTable: 'assistant_messages',
      sourceId: row.id,
      label: `对话 · ${row.role}`,
      excerpt: row.content.slice(0, 300),
    }, limit);
  }
}

function retrieveForGenerate(
  todo: TodoItem,
  resultType: AiResultType | null,
  limit: number,
): KnowledgeSnippet[] {
  const snippets: KnowledgeSnippet[] = [];
  if (!resultType) {
    retrieveKeywordTodos(todo, limit, snippets);
    return snippets;
  }

  switch (resultType) {
    case 'minutes':
      retrieveScheduleSnippets(todo, limit, snippets);
      retrieveHistoricalAiResults(todo, 'minutes', limit, snippets);
      break;
    case 'review':
      retrieveCompletedTodos(todo, limit, snippets);
      retrieveHistoricalAiResults(todo, 'review', limit, snippets);
      break;
    case 'audit':
    case 'plan':
    case 'report':
    case 'analysis':
    case 'pick':
      retrieveHistoricalAiResults(todo, resultType, limit, snippets);
      retrieveKeywordTodos(todo, limit, snippets);
      break;
    default:
      retrieveKeywordTodos(todo, limit, snippets);
  }

  return snippets.slice(0, limit);
}

function retrieveForRevise(
  todo: TodoItem,
  options: RetrieveForTodoOptions,
  limit: number,
): KnowledgeSnippet[] {
  const snippets: KnowledgeSnippet[] = [];
  retrieveTodoAiVersions(todo.id, limit, snippets);
  retrieveAssistantThread(todo.id, limit, snippets);
  retrieveScheduleSnippets(todo, limit, snippets);

  if (options.userDelta?.trim()) {
    pushSnippet(
      snippets,
      {
        id: `user_delta:${todo.id}`,
        sourceTable: 'assistant_messages',
        sourceId: todo.id,
        label: '用户修订意见',
        excerpt: options.userDelta.trim().slice(0, 300),
      },
      limit,
    );
  }

  return snippets.slice(0, limit);
}

/**
 * R0 规则检索：从 SQLite 召回与待办相关的内部知识片段
 */
export function retrieveForTodo(
  todoId: number,
  options: RetrieveForTodoOptions,
): RetrieveForTodoResult {
  const todo = getTodoById(todoId);
  if (!todo) {
    return {
      todoId,
      intent: options.intent,
      resultType: null,
      snippets: [],
    };
  }

  const limit = options.limit ?? DEFAULT_SNIPPET_LIMIT;
  const resultType = resolveResultType(todo);
  const snippets =
    options.intent === 'revise'
      ? retrieveForRevise(todo, options, limit)
      : retrieveForGenerate(todo, resultType, limit);

  return {
    todoId,
    intent: options.intent,
    resultType,
    snippets,
  };
}
