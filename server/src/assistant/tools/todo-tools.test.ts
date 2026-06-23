import { describe, expect, it } from 'vitest';
import { getDb } from '../../db/index.js';
import { seedDatabase } from '../../db/seed.js';
import { InMemoryMetricsLedger } from '../metrics-ledger.js';
import { getPersonalToolRegistry } from './register-tools.js';

describe('todo-tools', () => {
  const metrics = new InMemoryMetricsLedger();
  const registry = getPersonalToolRegistry();

  it('todo.create 写入待办并传递 externalSnippets', async () => {
    seedDatabase(getDb());

    const result = await registry.invoke(
      'todo.create',
      { title: '整理 PRD 摘要', description: '来源：自然语言' },
      {
        sessionId: 1,
        metrics,
        assistantContext: {
          sessionId: 1,
          recentMessages: [],
          externalSnippets: [{ source: '飞书 PRD', excerpt: '版本 2.0 需求范围' }],
        },
      },
    );

    expect(result.refresh).toContain('todos');
    const payload = result.payload as { title: string; aiStatus: string };
    expect(payload.title).toBe('整理 PRD 摘要');

    const db = getDb();
    const row = db
      .prepare('SELECT COUNT(*) as c FROM todos WHERE title = ?')
      .get('整理 PRD 摘要') as { c: number };
    expect(row.c).toBe(1);
  });

  it('todo.revise_ai 成功修订并返回 contextSummary', async () => {
    seedDatabase(getDb());

    const result = await registry.invoke(
      'todo.revise_ai',
      { modifyTodoId: 1, revisionHint: '补充行动项与负责人' },
      { sessionId: 1, metrics },
    );

    const payload = result.payload as {
      modifyTodoId: number;
      modifyVersion: number;
      contextSummary?: string;
    };
    expect(payload.modifyTodoId).toBe(1);
    expect(payload.modifyVersion).toBe(3);
    expect(payload.contextSummary).toContain('已参考 v2');
    expect(result.refresh).toContain('todos');
  });

  it('todo.revise_ai 对待办不存在或不支持 AI 修改时抛错', async () => {
    seedDatabase(getDb());

    await expect(
      registry.invoke(
        'todo.revise_ai',
        { modifyTodoId: 2, revisionHint: '改一下' },
        { sessionId: 1, metrics },
      ),
    ).rejects.toThrow(/不支持 AI 修改/);

    await expect(
      registry.invoke(
        'todo.revise_ai',
        { modifyTodoId: 99999, revisionHint: '改一下' },
        { sessionId: 1, metrics },
      ),
    ).rejects.toThrow(/不存在或不支持/);
  });
});
