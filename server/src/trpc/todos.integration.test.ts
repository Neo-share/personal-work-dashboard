import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getDb } from '../db/index.js';
import { seedDatabase } from '../db/seed.js';
import { createTrpcTestServer } from '../test/trpc-test-server.js';
import {
  trpcMutation,
  trpcMutationExpectError,
  trpcQuery,
} from '../test/trpc-http.js';

function countTodos(): number {
  const row = getDb().prepare('SELECT COUNT(*) as c FROM todos').get() as { c: number };
  return row.c;
}

function getTodoRow(id: number) {
  return getDb().prepare('SELECT id, title, status FROM todos WHERE id = ?').get(id) as
    | { id: number; title: string; status: string }
    | undefined;
}

/**
 * tRPC todos 窄集成：HTTP → router(Zod) → todo-service → SQLite
 */
describe('tRPC todos 集成', () => {
  let server: FastifyInstance;

  beforeEach(async () => {
    server = await createTrpcTestServer();
  });

  afterEach(async () => {
    await server.close();
  });

  it('create → detail → list 落库且可读', async () => {
    const before = countTodos();

    const { statusCode: createStatus, data: created } = await trpcMutation(server, 'todos.create', {
      title: '集成测待办',
      description: '描述',
    });
    expect(createStatus).toBe(200);
    expect(created.title).toBe('集成测待办');
    expect(countTodos()).toBe(before + 1);

    const row = getTodoRow(created.id);
    expect(row).toMatchObject({ title: '集成测待办', status: 'active' });

    const { data: detail } = await trpcQuery(server, 'todos.detail', { id: created.id });
    expect(detail.title).toBe('集成测待办');

    const { data: list } = await trpcQuery(server, 'todos.list', { filter: 'active' });
    expect(list.some((t) => t.id === created.id)).toBe(true);
  });

  it('title 为空 → BAD_REQUEST，无新行', async () => {
    const before = countTodos();
    const { statusCode, body } = await trpcMutationExpectError(server, 'todos.create', {
      title: '',
    });

    expect(statusCode).toBe(400);
    expect(body.error?.data?.code).toBe('BAD_REQUEST');
    expect(countTodos()).toBe(before);
  });

  it('update → complete → restore 状态流转', async () => {
    const { data: created } = await trpcMutation(server, 'todos.create', {
      title: '状态流转',
    });

    const { data: updated } = await trpcMutation(server, 'todos.update', {
      id: created.id,
      title: '已改名',
    });
    expect(updated.title).toBe('已改名');
    expect(getTodoRow(created.id)?.title).toBe('已改名');

    const { data: completed } = await trpcMutation(server, 'todos.complete', { id: created.id });
    expect(completed.status).toBe('completed');
    expect(getTodoRow(created.id)?.status).toBe('completed');

    const { data: restored } = await trpcMutation(server, 'todos.restore', { id: created.id });
    expect(restored.status).toBe('active');
    expect(getTodoRow(created.id)?.status).toBe('active');
  });

  it('delete → detail 返回 null，DB 无行', async () => {
    const { data: created } = await trpcMutation(server, 'todos.create', {
      title: '待删除',
    });

    const { data: deleted } = await trpcMutation(server, 'todos.delete', { id: created.id });
    expect(deleted.ok).toBe(true);
    expect(getTodoRow(created.id)).toBeUndefined();

    const { data: detail } = await trpcQuery(server, 'todos.detail', { id: created.id });
    expect(detail).toBeNull();
  });

  it('cancel → 状态 cancelled，active 列表不可见，detail 仍可读', async () => {
    const { data: created } = await trpcMutation(server, 'todos.create', {
      title: '待取消',
    });

    const { data: cancelled } = await trpcMutation(server, 'todos.cancel', { id: created.id });
    expect(cancelled?.status).toBe('cancelled');
    expect(getTodoRow(created.id)?.status).toBe('cancelled');

    const { data: activeList } = await trpcQuery(server, 'todos.list', { filter: 'active' });
    expect(activeList.some((t) => t.id === created.id)).toBe(false);

    const { data: detail } = await trpcQuery(server, 'todos.detail', { id: created.id });
    expect(detail?.status).toBe('cancelled');
  });

  it('cancel 不存在的 id → 返回 null', async () => {
    const { data } = await trpcMutation(server, 'todos.cancel', { id: 99999 });
    expect(data).toBeNull();
  });
});

/**
 * confirmAiResult 工作流：需 seed 中带 AI 结果的待办
 */
describe('tRPC todos.confirmAiResult 集成', () => {
  let server: FastifyInstance;

  beforeEach(async () => {
    server = await createTrpcTestServer();
    seedDatabase(getDb());
  });

  afterEach(async () => {
    await server.close();
  });

  it('确认 AI 结果 → todos 表 ai_status 更新', async () => {
    const db = getDb();
    const resultRow = db
      .prepare('SELECT id FROM todo_ai_results WHERE todo_id = 1 ORDER BY version DESC LIMIT 1')
      .get() as { id: number };

    const { data } = await trpcMutation(server, 'todos.confirmAiResult', {
      todoId: 1,
      resultId: resultRow.id,
    });
    expect(data.aiStatus).toBe('confirmed');

    const row = db.prepare('SELECT ai_status FROM todos WHERE id = 1').get() as { ai_status: string };
    expect(row.ai_status).toBe('confirmed');
  });
});
