import { describe, expect, it } from 'vitest';
import { getDb } from '../db/index.js';
import {
  confirmAiResult,
  createTodo,
  getPersonalWorkbenchSummary,
  getTodoAiResults,
  getTodoById,
  listTodos,
} from './todo-service.js';

/** 测试夹具：插入带 AI 结果的进行中待办 */
function seedTodoWithAiResults(input?: {
  title?: string;
  versions?: Array<{ version: number; status?: string; html?: string }>;
}): { todoId: number; resultIds: number[] } {
  const db = getDb();
  const now = new Date().toISOString();
  const title = input?.title ?? '做会议纪要';
  const versions = input?.versions ?? [{ version: 1, status: 'ready', html: '<p>v1</p>' }];

  const todoResult = db
    .prepare(
      `INSERT INTO todos (title, description, due_at, source, status, is_urgent, ai_status, ai_result_type, created_at, updated_at)
       VALUES (?, '来源：定时任务', ?, 'recurring', 'active', 0, 'ready', 'minutes', ?, ?)`,
    )
    .run(title, now, now, now);
  const todoId = Number(todoResult.lastInsertRowid);

  const resultIds: number[] = [];
  for (const v of versions) {
    const row = db
      .prepare(
        `INSERT INTO todo_ai_results (todo_id, version, result_type, html_content, status, provider, created_at)
         VALUES (?, ?, 'minutes', ?, ?, 'rule-template', ?)`,
      )
      .run(todoId, v.version, v.html ?? `<p>v${v.version}</p>`, v.status ?? 'ready', now);
    resultIds.push(Number(row.lastInsertRowid));
  }

  return { todoId, resultIds };
}

/** 直接插入待办行，便于筛选规则单测 */
function insertTodoRow(input: {
  title: string;
  status?: 'active' | 'completed' | 'cancelled';
  dueAt?: string | null;
}): number {
  const db = getDb();
  const now = new Date().toISOString();
  const result = db
    .prepare(
      `INSERT INTO todos (title, description, due_at, source, status, is_urgent, ai_status, ai_result_type, created_at, updated_at, completed_at)
       VALUES (?, NULL, ?, 'manual', ?, 0, 'none', NULL, ?, ?, ?)`,
    )
    .run(
      input.title,
      input.dueAt ?? null,
      input.status ?? 'active',
      now,
      now,
      input.status === 'completed' ? now : null,
    );
  return Number(result.lastInsertRowid);
}

describe('todo-service.listTodos 筛选（L1-02）', () => {
  // L1-02 02.02：进行中仅未完成
  it('02.02 active 仅返回 status=active', () => {
    const activeId = insertTodoRow({ title: '进行中' });
    insertTodoRow({ title: '已完成', status: 'completed' });

    const list = listTodos('active');

    expect(list.map((t) => t.id)).toContain(activeId);
    expect(list.every((t) => t.status === 'active')).toBe(true);
  });

  // L1-02 02.04：已完成筛选
  it('02.04 completed 仅返回已完成项', () => {
    insertTodoRow({ title: '进行中' });
    const doneId = insertTodoRow({ title: '已完成', status: 'completed' });

    const list = listTodos('completed');

    expect(list.map((t) => t.id)).toEqual([doneId]);
  });

  // L1-02 02.05：已逾期筛选
  it('02.05 overdue 仅返回进行中且 due_at 已过期的项', () => {
    const past = new Date(Date.now() - 86_400_000).toISOString();
    const future = new Date(Date.now() + 86_400_000).toISOString();
    const overdueId = insertTodoRow({ title: '已逾期', dueAt: past });
    insertTodoRow({ title: '未逾期', dueAt: future });
    insertTodoRow({ title: '已完成逾期', status: 'completed', dueAt: past });

    const list = listTodos('overdue');

    expect(list.map((t) => t.id)).toEqual([overdueId]);
    expect(list[0]?.isOverdue).toBe(true);
  });

  // L1-02 02.03：全部待办含进行中与已完成（不含 cancelled）
  it('02.03 all 含 active 与 completed，排除 cancelled', () => {
    const activeId = insertTodoRow({ title: '进行中' });
    const doneId = insertTodoRow({ title: '已完成', status: 'completed' });
    insertTodoRow({ title: '已取消', status: 'cancelled' });

    const list = listTodos('all');
    const ids = list.map((t) => t.id);

    expect(ids).toContain(activeId);
    expect(ids).toContain(doneId);
    expect(list.some((t) => t.title === '已取消')).toBe(false);
  });

  // L1-02 02.12：mapTodo 逾期标记
  it('02.12 进行中且 due_at 早于当前时间标记 isOverdue', () => {
    const past = new Date(Date.now() - 3_600_000).toISOString();
    const id = insertTodoRow({ title: '逾期项', dueAt: past });

    const todo = getTodoById(id);

    expect(todo?.isOverdue).toBe(true);
  });

  it('02.12 已完成项不标记 isOverdue', () => {
    const past = new Date(Date.now() - 3_600_000).toISOString();
    const id = insertTodoRow({ title: '已完成逾期', status: 'completed', dueAt: past });

    expect(getTodoById(id)?.isOverdue).toBe(false);
  });
});

describe('todo-service.confirmAiResult', () => {
  // L1-06 06.05：确认完成
  it('06.05 确认指定 AI 结果后待办自动完成', () => {
    const { todoId, resultIds } = seedTodoWithAiResults();
    const resultId = resultIds[0]!;

    const updated = confirmAiResult(todoId, resultId);

    expect(updated).not.toBeNull();
    expect(updated!.status).toBe('completed');
    expect(updated!.aiStatus).toBe('confirmed');
    expect(updated!.completedAt).not.toBeNull();
    expect(getTodoAiResults(todoId)[0]?.status).toBe('confirmed');
  });

  // L1-08 08.09：确认后描述固定文案
  it('08.09 确认后描述更新为「个人助手结果已确认」', () => {
    const { todoId, resultIds } = seedTodoWithAiResults();
    confirmAiResult(todoId, resultIds[0]!);

    const todo = getTodoById(todoId);
    expect(todo?.description).toBe('个人助手结果已确认');
  });

  // L1-07 07.05：统计联动
  it('07.05 确认后进行中列表与汇总统计同步变化', () => {
    const { todoId, resultIds } = seedTodoWithAiResults();
    const before = getPersonalWorkbenchSummary();

    confirmAiResult(todoId, resultIds[0]!);

    const activeList = listTodos('active');
    const completedList = listTodos('completed');
    const after = getPersonalWorkbenchSummary();

    expect(activeList.some((t) => t.id === todoId)).toBe(false);
    expect(completedList.some((t) => t.id === todoId)).toBe(true);
    expect(after.todoCount).toBe(before.todoCount - 1);
    expect(after.completedCount).toBe(before.completedCount + 1);
  });

  it('多版本时仅确认指定 resultId，其它版本保持原状态', () => {
    const { todoId, resultIds } = seedTodoWithAiResults({
      versions: [
        { version: 1, status: 'ready' },
        { version: 2, status: 'ready' },
      ],
    });
    const [, v2Id] = resultIds;

    confirmAiResult(todoId, v2Id!);

    const results = getTodoAiResults(todoId);
    expect(results.find((r) => r.version === 1)?.status).toBe('ready');
    expect(results.find((r) => r.version === 2)?.status).toBe('confirmed');
  });

  it('createTodo 命中能力词后可通过 confirmAiResult 完成（物化链路末端）', () => {
    const todo = createTodo({
      title: '会后整理会议纪要',
      description: '来源：自然语言',
      triggerAi: false,
    });
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare(`UPDATE todos SET ai_status = 'ready' WHERE id = ?`).run(todo.id);
    const insert = db
      .prepare(
        `INSERT INTO todo_ai_results (todo_id, version, result_type, html_content, status, provider, created_at)
         VALUES (?, 1, 'minutes', '<p>纪要</p>', 'ready', 'rule-template', ?)`,
      )
      .run(todo.id, now);
    const resultId = Number(insert.lastInsertRowid);

    const updated = confirmAiResult(todo.id, resultId);

    expect(updated?.status).toBe('completed');
    expect(updated?.aiStatus).toBe('confirmed');
  });
});
