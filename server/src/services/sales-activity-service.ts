import type { SalesActivity, SalesActivityType } from '@project-manager/shared';
import { getDb } from '../db/index.js';

function mapActivity(row: Record<string, unknown>): SalesActivity {
  return {
    id: row.id as number,
    opportunityId: row.opportunity_id as number,
    type: row.type as SalesActivityType,
    content: row.content as string,
    activityAt: row.activity_at as string,
    createdAt: row.created_at as string,
  };
}

export function listSalesActivities(opportunityId: number): SalesActivity[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM sales_activities
       WHERE opportunity_id = ?
       ORDER BY activity_at DESC, id DESC`,
    )
    .all(opportunityId) as Record<string, unknown>[];
  return rows.map(mapActivity);
}

export function createSalesActivity(input: {
  opportunityId: number;
  type: SalesActivityType;
  content: string;
  activityAt?: string;
}): SalesActivity {
  const db = getDb();
  const now = new Date().toISOString();
  const activityAt = input.activityAt ?? now;
  const result = db
    .prepare(
      `INSERT INTO sales_activities (opportunity_id, type, content, activity_at, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(input.opportunityId, input.type, input.content, activityAt, now);
  const row = db
    .prepare('SELECT * FROM sales_activities WHERE id = ?')
    .get(Number(result.lastInsertRowid)) as Record<string, unknown>;
  return mapActivity(row);
}

export function deleteSalesActivity(id: number): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM sales_activities WHERE id = ?').run(id);
  return result.changes > 0;
}
