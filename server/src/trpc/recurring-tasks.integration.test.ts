import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getDb } from '../db/index.js';
import { createTrpcTestServer } from '../test/trpc-test-server.js';
import {
  trpcMutation,
  trpcMutationExpectError,
  trpcQuery,
} from '../test/trpc-http.js';

function countRecurringTasks(): number {
  const row = getDb().prepare('SELECT COUNT(*) as c FROM recurring_tasks').get() as { c: number };
  return row.c;
}

function countTodosForRecurring(recurringTaskId: number): number {
  const row = getDb()
    .prepare('SELECT COUNT(*) as c FROM todos WHERE recurring_task_id = ?')
    .get(recurringTaskId) as { c: number };
  return row.c;
}

function getRecurringRow(id: number) {
  return getDb()
    .prepare('SELECT id, title, enabled FROM recurring_tasks WHERE id = ?')
    .get(id) as { id: number; title: string; enabled: number } | undefined;
}

/**
 * tRPC recurringTasks 窄集成：HTTP → router(Zod) → recurring-task-service → SQLite
 */
describe('tRPC recurringTasks 集成', () => {
  let server: FastifyInstance;

  beforeEach(async () => {
    server = await createTrpcTestServer();
  });

  afterEach(async () => {
    await server.close();
  });

  it('create → list 落库且可读', async () => {
    const before = countRecurringTasks();

    const { data: created } = await trpcMutation(server, 'recurringTasks.create', {
      title: '每日站会',
      frequency: 'daily',
      timeOfDay: '09:30',
    });
    expect(created.title).toBe('每日站会');
    expect(created.enabled).toBe(true);
    expect(countRecurringTasks()).toBe(before + 1);

    const row = getRecurringRow(created.id);
    expect(row).toMatchObject({ title: '每日站会', enabled: 1 });

    const { data: list } = await trpcQuery(server, 'recurringTasks.list');
    expect(list.some((t) => t.id === created.id)).toBe(true);
  });

  it('title 为空 → BAD_REQUEST，无新行', async () => {
    const before = countRecurringTasks();
    const { statusCode, body } = await trpcMutationExpectError(server, 'recurringTasks.create', {
      title: '',
      frequency: 'daily',
      timeOfDay: '09:00',
    });

    expect(statusCode).toBe(400);
    expect(body.error?.data?.code).toBe('BAD_REQUEST');
    expect(countRecurringTasks()).toBe(before);
  });

  it('toggle → enabled 状态落库', async () => {
    const { data: created } = await trpcMutation(server, 'recurringTasks.create', {
      title: '周报提醒',
      frequency: 'weekly',
      dayOfWeek: 5,
      timeOfDay: '17:00',
    });

    const { data: disabled } = await trpcMutation(server, 'recurringTasks.toggle', {
      id: created.id,
      enabled: false,
    });
    expect(disabled.enabled).toBe(false);
    expect(getRecurringRow(created.id)?.enabled).toBe(0);

    const { data: enabled } = await trpcMutation(server, 'recurringTasks.toggle', {
      id: created.id,
      enabled: true,
    });
    expect(enabled.enabled).toBe(true);
    expect(getRecurringRow(created.id)?.enabled).toBe(1);
  });

  it('create daily 自动物化 5 条 todos，materializeNow 幂等不重复落库', async () => {
    const { data: created } = await trpcMutation(server, 'recurringTasks.create', {
      title: '每日复盘',
      frequency: 'daily',
      timeOfDay: '20:00',
    });

    // create 内部已调用 materializeRecurringTask，daily 维持未来 5 天窗口
    expect(countTodosForRecurring(created.id)).toBe(5);

    const { data: materialized } = await trpcMutation(server, 'recurringTasks.materializeNow', {
      id: created.id,
    });
    expect(materialized.todoIds).toHaveLength(0);
    expect(countTodosForRecurring(created.id)).toBe(5);
  });

  it('create weekly 物化 1 条关联 todo', async () => {
    const { data: created } = await trpcMutation(server, 'recurringTasks.create', {
      title: '周会准备',
      frequency: 'weekly',
      dayOfWeek: 1,
      timeOfDay: '10:00',
    });

    expect(countTodosForRecurring(created.id)).toBe(1);
    const todoRow = getDb()
      .prepare('SELECT source FROM todos WHERE recurring_task_id = ? LIMIT 1')
      .get(created.id) as { source: string };
    expect(todoRow.source).toBe('recurring_task');
  });

  it('delete → list 不可见，DB 无行', async () => {
    const { data: created } = await trpcMutation(server, 'recurringTasks.create', {
      title: '待删定时',
      frequency: 'monthly',
      dayOfMonth: 1,
      timeOfDay: '10:00',
    });

    const { data: deleted } = await trpcMutation(server, 'recurringTasks.delete', {
      id: created.id,
    });
    expect(deleted.ok).toBe(true);
    expect(getRecurringRow(created.id)).toBeUndefined();

    const { data: list } = await trpcQuery(server, 'recurringTasks.list');
    expect(list.some((t) => t.id === created.id)).toBe(false);
  });
});
