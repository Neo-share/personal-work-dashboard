import { describe, expect, it } from 'vitest';
import { getDb } from '../db/index.js';
import {
  createLocalSchedule,
  ensureCalendarSources,
  listDaySchedule,
  seedScheduleItems,
  setCalendarSourceEnabled,
} from './schedule-service.js';

/** 固定测试日，避免跨日边界干扰 listDaySchedule */
const TEST_DAY = '2026-06-25';

function atTime(hour: number, minute: number): string {
  return `2026-06-25T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000Z`;
}

describe('schedule-service 去重与统计（L1-03）', () => {
  it('03.06 标题相同 + 结束相同 + 开始差 ≤15min 合并为一条并标记 isMerged', () => {
    ensureCalendarSources();
    const endAt = atTime(11, 0);
    seedScheduleItems([
      { title: '产品评审', startAt: atTime(10, 0), endAt, source: 'feishu' },
      { title: '产品评审', startAt: atTime(10, 14), endAt, source: 'dingtalk' },
    ]);

    const { events, rawCount, dedupedCount } = listDaySchedule(TEST_DAY);

    expect(rawCount).toBe(2);
    expect(dedupedCount).toBe(1);
    expect(events).toHaveLength(1);
    expect(events[0]?.isMerged).toBe(true);
    expect(events[0]?.sources).toHaveLength(2);
  });

  it('03.06 开始差 >15min 不合并', () => {
    ensureCalendarSources();
    const endAt = atTime(11, 0);
    seedScheduleItems([
      { title: '产品评审', startAt: atTime(10, 0), endAt, source: 'feishu' },
      { title: '产品评审', startAt: atTime(10, 16), endAt, source: 'outlook' },
    ]);

    const { events, rawCount, dedupedCount } = listDaySchedule(TEST_DAY);

    expect(rawCount).toBe(2);
    expect(dedupedCount).toBe(2);
    expect(events.filter((e) => e.isMerged)).toHaveLength(0);
  });

  it('03.07 同步条展示原始 N 条、去重后 M 条', () => {
    ensureCalendarSources();
    const endAt = atTime(7, 0);
    seedScheduleItems([
      { title: '周会', startAt: atTime(6, 0), endAt, source: 'feishu' },
      { title: '周会', startAt: atTime(6, 5), endAt, source: 'local' },
      { title: '面试', startAt: atTime(8, 0), endAt: atTime(9, 0), source: 'local' },
    ]);

    const { rawCount, dedupedCount } = listDaySchedule(TEST_DAY);

    expect(rawCount).toBe(3);
    expect(dedupedCount).toBe(2);
  });

  it('03.05 停用渠道后该来源日程块不展示', () => {
    ensureCalendarSources();
    createLocalSchedule({
      title: '仅飞书',
      startAt: atTime(9, 0),
      endAt: atTime(10, 0),
    });
    seedScheduleItems([
      {
        title: '仅钉钉',
        startAt: atTime(11, 0),
        endAt: atTime(12, 0),
        source: 'dingtalk',
      },
    ]);

    setCalendarSourceEnabled('dingtalk', false);

    const { events } = listDaySchedule(TEST_DAY);
    const titles = events.flatMap((e) => e.sources.map((s) => s.source));

    expect(events.some((e) => e.title === '仅飞书')).toBe(true);
    expect(titles).not.toContain('dingtalk');
  });

  it('03.13 渠道全关时时间轴为空，统计仍保留原始/去重条数', () => {
    ensureCalendarSources();
    seedScheduleItems([
      {
        title: '渠道全关测试',
        startAt: atTime(13, 0),
        endAt: atTime(14, 0),
        source: 'feishu',
      },
    ]);

    for (const source of ['feishu', 'dingtalk', 'outlook', 'local'] as const) {
      setCalendarSourceEnabled(source, false);
    }

    const { events, rawCount, dedupedCount } = listDaySchedule(TEST_DAY);

    expect(events).toHaveLength(0);
    expect(rawCount).toBeGreaterThan(0);
    expect(dedupedCount).toBeGreaterThan(0);
  });

  it('createLocalSchedule 写入来源为 local', () => {
    ensureCalendarSources();
    const event = createLocalSchedule({
      title: '助手写入',
      startAt: atTime(17, 0),
      endAt: atTime(18, 0),
    });

    expect(event.sources.every((s) => s.source === 'local')).toBe(true);

    const db = getDb();
    const row = db.prepare('SELECT COUNT(*) as c FROM schedule_events WHERE title = ?').get('助手写入') as {
      c: number;
    };
    expect(row.c).toBe(1);
  });
});
