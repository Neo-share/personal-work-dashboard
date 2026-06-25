import type { CalendarSource, CalendarSourceType, ScheduleEvent } from '@project-manager/shared';
import { getDb } from '../db/index.js';

const DEDUP_THRESHOLD_MS = 15 * 60 * 1000;

interface RawScheduleItem {
  title: string;
  startAt: string;
  endAt: string;
  source: CalendarSourceType;
}

function getDayRange(dateStr: string): { start: string; end: string } {
  const date = new Date(dateStr);
  date.setHours(0, 0, 0, 0);
  const start = date.toISOString();
  const endDate = new Date(date);
  endDate.setHours(23, 59, 59, 999);
  return { start, end: endDate.toISOString() };
}

function mapEventWithSources(eventId: number): ScheduleEvent | null {
  const db = getDb();
  const event = db
    .prepare('SELECT * FROM schedule_events WHERE id = ?')
    .get(eventId) as
    | {
        id: number;
        title: string;
        start_at: string;
        end_at: string;
        is_merged: number;
      }
    | undefined;
  if (!event) return null;

  const sources = db
    .prepare('SELECT * FROM schedule_event_sources WHERE event_id = ?')
    .all(eventId) as Array<{
    id: number;
    event_id: number;
    source: string;
    title: string;
    start_at: string;
    end_at: string;
  }>;

  return {
    id: event.id,
    title: event.title,
    startAt: event.start_at,
    endAt: event.end_at,
    isMerged: event.is_merged === 1,
    sources: sources.map((s) => ({
      id: s.id,
      eventId: s.event_id,
      source: s.source as CalendarSourceType,
      title: s.title,
      startAt: s.start_at,
      endAt: s.end_at,
    })),
  };
}

/** 去重并写入日程：标题相同 + 结束相同 + 开始差 ≤15min */
function upsertScheduleItem(item: RawScheduleItem): number {
  const db = getDb();
  const now = new Date().toISOString();

  const existingEvents = db
    .prepare(
      `SELECT se.* FROM schedule_events se
       WHERE se.title = ? AND se.end_at = ?`,
    )
    .all(item.title, item.endAt) as Array<{
    id: number;
    start_at: string;
  }>;

  for (const existing of existingEvents) {
    const diff = Math.abs(new Date(existing.start_at).getTime() - new Date(item.startAt).getTime());
    if (diff <= DEDUP_THRESHOLD_MS) {
      db.prepare(
        `INSERT INTO schedule_event_sources (event_id, source, title, start_at, end_at)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(existing.id, item.source, item.title, item.startAt, item.endAt);
      db.prepare(`UPDATE schedule_events SET is_merged = 1 WHERE id = ?`).run(existing.id);
      return existing.id;
    }
  }

  const result = db
    .prepare(
      `INSERT INTO schedule_events (title, start_at, end_at, is_merged, created_at)
       VALUES (?, ?, ?, 0, ?)`,
    )
    .run(item.title, item.startAt, item.endAt, now);

  const eventId = Number(result.lastInsertRowid);
  db.prepare(
    `INSERT INTO schedule_event_sources (event_id, source, title, start_at, end_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(eventId, item.source, item.title, item.startAt, item.endAt);

  return eventId;
}

export function listCalendarSources(): CalendarSource[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM calendar_sources ORDER BY id').all() as Array<{
    id: number;
    source: string;
    label: string;
    enabled: number;
    last_synced_at: string | null;
  }>;

  return rows.map((row) => ({
    id: row.id,
    source: row.source as CalendarSourceType,
    label: row.label,
    enabled: row.enabled === 1,
    lastSyncedAt: row.last_synced_at,
  }));
}

export function setCalendarSourceEnabled(source: CalendarSourceType, enabled: boolean): CalendarSource[] {
  const db = getDb();
  db.prepare('UPDATE calendar_sources SET enabled = ? WHERE source = ?').run(enabled ? 1 : 0, source);
  return listCalendarSources();
}

export function listDaySchedule(dateStr: string): {
  events: ScheduleEvent[];
  rawCount: number;
  dedupedCount: number;
} {
  const db = getDb();
  const { start, end } = getDayRange(dateStr);
  const enabledSources = listCalendarSources()
    .filter((s) => s.enabled)
    .map((s) => s.source);

  const rawCount = (
    db
      .prepare(
        `SELECT COUNT(*) as c FROM schedule_event_sources ses
         JOIN schedule_events se ON se.id = ses.event_id
         WHERE se.start_at >= ? AND se.start_at <= ?`,
      )
      .get(start, end) as { c: number }
  ).c;

  const dedupedCountAll = (
    db
      .prepare(
        `SELECT COUNT(*) as c FROM schedule_events WHERE start_at >= ? AND start_at <= ?`,
      )
      .get(start, end) as { c: number }
  ).c;

  // L1-03 03.13：渠道全关时时间轴为空，统计仍展示原始/去重条数
  if (enabledSources.length === 0) {
    return { events: [], rawCount, dedupedCount: dedupedCountAll };
  }

  const eventIds = db
    .prepare(
      `SELECT DISTINCT se.id FROM schedule_events se
       JOIN schedule_event_sources ses ON ses.event_id = se.id
       WHERE se.start_at >= ? AND se.start_at <= ?
       ORDER BY se.start_at ASC`,
    )
    .all(start, end) as Array<{ id: number }>;

  const events: ScheduleEvent[] = [];
  for (const { id } of eventIds) {
    const event = mapEventWithSources(id);
    if (!event) continue;
    const visibleSources = event.sources.filter((s) => enabledSources.includes(s.source));
    if (visibleSources.length === 0) continue;
    events.push({ ...event, sources: visibleSources });
  }

  return { events, rawCount, dedupedCount: events.length };
}

export function createLocalSchedule(input: {
  title: string;
  startAt: string;
  endAt: string;
}): ScheduleEvent {
  const eventId = upsertScheduleItem({
    title: input.title,
    startAt: input.startAt,
    endAt: input.endAt,
    source: 'local',
  });
  return mapEventWithSources(eventId)!;
}

export function deleteScheduleEvent(id: number): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM schedule_events WHERE id = ?').run(id);
  return result.changes > 0;
}

/** seed 用：批量导入原始日程（含多渠道重复项） */
export function seedScheduleItems(items: RawScheduleItem[]): void {
  for (const item of items) {
    upsertScheduleItem(item);
  }
}

/** 初始化日历渠道 */
export function ensureCalendarSources(): void {
  const db = getDb();
  const sources: Array<[CalendarSourceType, string]> = [
    ['feishu', '飞书'],
    ['dingtalk', '钉钉'],
    ['outlook', 'Outlook'],
    ['local', '本地'],
  ];
  const insert = db.prepare(
    `INSERT INTO calendar_sources (source, label, enabled, last_synced_at)
     VALUES (?, ?, 1, NULL) ON CONFLICT(source) DO NOTHING`,
  );
  for (const [source, label] of sources) {
    insert.run(source, label);
  }
}

export function getScheduleEventById(id: number): ScheduleEvent | null {
  return mapEventWithSources(id);
}
