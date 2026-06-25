import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getDb } from '../db/index.js';
import { ensureCalendarSources } from '../services/schedule-service.js';
import { createTrpcTestServer } from '../test/trpc-test-server.js';
import { trpcMutation, trpcMutationExpectError, trpcQuery } from '../test/trpc-http.js';

function countScheduleEvents(): number {
  const row = getDb().prepare('SELECT COUNT(*) as c FROM schedule_events').get() as { c: number };
  return row.c;
}

/**
 * tRPC schedule 窄集成：本地日程创建与列表
 */
describe('tRPC schedule 集成', () => {
  let server: FastifyInstance;

  beforeEach(async () => {
    ensureCalendarSources();
    server = await createTrpcTestServer();
  });

  afterEach(async () => {
    await server.close();
  });

  it('createLocal → listDay 落库且当日可见', async () => {
    const day = '2026-06-25';
    const startAt = `${day}T10:00:00.000Z`;
    const endAt = `${day}T11:00:00.000Z`;
    const before = countScheduleEvents();

    const { data: created } = await trpcMutation(server, 'schedule.createLocal', {
      title: '集成测会议',
      startAt,
      endAt,
    });
    expect(created.title).toBe('集成测会议');
    expect(countScheduleEvents()).toBe(before + 1);

    const { data: daySchedule } = await trpcQuery(server, 'schedule.listDay', { date: day });
    expect(daySchedule.events.some((e) => e.title === '集成测会议')).toBe(true);
    expect(daySchedule.dedupedCount).toBeGreaterThanOrEqual(1);
  });

  it('title 为空 → BAD_REQUEST，无新日程', async () => {
    const before = countScheduleEvents();
    const { statusCode, body } = await trpcMutationExpectError(server, 'schedule.createLocal', {
      title: '',
      startAt: '2026-06-25T10:00:00.000Z',
      endAt: '2026-06-25T11:00:00.000Z',
    });

    expect(statusCode).toBe(400);
    expect(body.error?.data?.code).toBe('BAD_REQUEST');
    expect(countScheduleEvents()).toBe(before);
  });

  it('delete → listDay 不可见，detail 返回 null', async () => {
    const day = '2026-06-25';
    const before = countScheduleEvents();

    const { data: created } = await trpcMutation(server, 'schedule.createLocal', {
      title: '待删日程',
      startAt: `${day}T16:00:00.000Z`,
      endAt: `${day}T17:00:00.000Z`,
    });
    expect(countScheduleEvents()).toBe(before + 1);

    const { data: deleted } = await trpcMutation(server, 'schedule.delete', { id: created.id });
    expect(deleted.ok).toBe(true);
    expect(countScheduleEvents()).toBe(before);

    const { data: daySchedule } = await trpcQuery(server, 'schedule.listDay', { date: day });
    expect(daySchedule.events.some((e) => e.id === created.id)).toBe(false);

    const { data: detail } = await trpcQuery(server, 'schedule.detail', { id: created.id });
    expect(detail).toBeNull();
  });

  it('delete 不存在的 id → ok false，无异常', async () => {
    const { data } = await trpcMutation(server, 'schedule.delete', { id: 99999 });
    expect(data.ok).toBe(false);
  });
});
