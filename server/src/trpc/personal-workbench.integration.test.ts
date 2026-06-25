import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ensureCalendarSources } from '../services/schedule-service.js';
import { createTrpcTestServer } from '../test/trpc-test-server.js';
import { trpcMutation, trpcQuery } from '../test/trpc-http.js';

const TEST_DAY = '2026-06-25';

/**
 * tRPC personalWorkbench 窄集成：汇总统计与 Soul 偏好
 */
describe('tRPC personalWorkbench 集成', () => {
  let server: FastifyInstance;

  beforeEach(async () => {
    ensureCalendarSources();
    server = await createTrpcTestServer();
  });

  afterEach(async () => {
    await server.close();
  });

  it('summary 空库返回零值统计结构', async () => {
    const { data } = await trpcQuery(server, 'personalWorkbench.summary', { date: TEST_DAY });

    expect(data).toMatchObject({
      scheduleCount: 0,
      todoCount: 0,
      overdueCount: 0,
      completedCount: 0,
      rawScheduleCount: 0,
    });
  });

  it('创建待办与当日日程后 summary 计数联动', async () => {
    const { data: before } = await trpcQuery(server, 'personalWorkbench.summary', {
      date: TEST_DAY,
    });

    await trpcMutation(server, 'todos.create', { title: '汇总测待办' });
    await trpcMutation(server, 'schedule.createLocal', {
      title: '汇总测会议',
      startAt: `${TEST_DAY}T14:00:00.000Z`,
      endAt: `${TEST_DAY}T15:00:00.000Z`,
    });

    const { data: after } = await trpcQuery(server, 'personalWorkbench.summary', {
      date: TEST_DAY,
    });

    expect(after.todoCount).toBe(before.todoCount + 1);
    expect(after.scheduleCount).toBeGreaterThanOrEqual(before.scheduleCount + 1);
    expect(after.rawScheduleCount).toBeGreaterThanOrEqual(before.rawScheduleCount + 1);
  });

  it('setSoulSettings → getSoulSettings 落库可读', async () => {
    await trpcMutation(server, 'personalWorkbench.setSoulSettings', {
      tone: 'concise',
      customInstructions: '集成测偏好说明',
    });

    const { data } = await trpcQuery(server, 'personalWorkbench.getSoulSettings');
    expect(data).toMatchObject({
      tone: 'concise',
      customInstructions: '集成测偏好说明',
    });
  });
});
