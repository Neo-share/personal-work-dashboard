import type { MetricEvent } from '@project-manager/shared';
import { getDb } from '../db/index.js';

const DEFAULT_QUERY_LIMIT = 5000;

function mapMetricRow(row: {
  name: string;
  ts: string;
  tags: string;
  value: number | null;
}): MetricEvent {
  let tags: Record<string, string> | undefined;
  try {
    const parsed = JSON.parse(row.tags) as Record<string, string>;
    tags = Object.keys(parsed).length > 0 ? parsed : undefined;
  } catch {
    tags = undefined;
  }
  return {
    name: row.name,
    ts: row.ts,
    tags,
    value: row.value ?? undefined,
  };
}

/** 指标事件落 SQLite，供重启后复盘 */
export function insertMetricEvent(event: MetricEvent): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO metric_events (name, ts, tags, value, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(
    event.name,
    event.ts,
    JSON.stringify(event.tags ?? {}),
    event.value ?? null,
    new Date().toISOString(),
  );
}

/** 从 SQLite 查询最近指标（默认最多 5000 条） */
export function queryRecentMetricEvents(filter?: {
  name?: string;
  limit?: number;
}): MetricEvent[] {
  const db = getDb();
  const limit = filter?.limit ?? DEFAULT_QUERY_LIMIT;
  const params: unknown[] = [];
  let sql = 'SELECT name, ts, tags, value FROM metric_events';

  if (filter?.name) {
    sql += ' WHERE name = ?';
    params.push(filter.name);
  }

  sql += ' ORDER BY id DESC LIMIT ?';
  params.push(limit);

  const rows = db.prepare(sql).all(...params) as Array<{
    name: string;
    ts: string;
    tags: string;
    value: number | null;
  }>;

  return rows.reverse().map(mapMetricRow);
}
