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
