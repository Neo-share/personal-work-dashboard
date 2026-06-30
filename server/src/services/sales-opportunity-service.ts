import type {
  SalesComplianceRecord,
  SalesOpportunity,
  SalesOpportunityDetail,
  SalesOpportunityListItem,
  SalesPipelineStage,
  SalesStageAdvanceCheck,
} from '@project-manager/shared';
import {
  SALES_COMPLIANCE_TEMPLATES,
  buildComplianceItemViews,
  checkStageComplianceComplete,
} from '@project-manager/shared';
import { getDb } from '../db/index.js';
import { getSalesCustomerById } from './sales-customer-service.js';
import { listSalesActivities } from './sales-activity-service.js';

function mapOpportunity(row: Record<string, unknown>): SalesOpportunity {
  return {
    id: row.id as number,
    customerId: row.customer_id as number,
    title: row.title as string,
    productType: (row.product_type as string | null) ?? null,
    stage: row.stage as SalesPipelineStage,
    expectedAmount: (row.expected_amount as number | null) ?? null,
    expectedCloseAt: (row.expected_close_at as string | null) ?? null,
    lostReason: (row.lost_reason as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapComplianceRecord(row: Record<string, unknown>): SalesComplianceRecord {
  return {
    id: row.id as number,
    opportunityId: row.opportunity_id as number,
    stage: row.stage as SalesPipelineStage,
    itemKey: row.item_key as string,
    completedAt: (row.completed_at as string | null) ?? null,
    note: (row.note as string | null) ?? null,
  };
}

function listComplianceRecords(opportunityId: number): SalesComplianceRecord[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM sales_compliance_records WHERE opportunity_id = ?')
    .all(opportunityId) as Record<string, unknown>[];
  return rows.map(mapComplianceRecord);
}

export function listSalesOpportunities(filters?: {
  stage?: SalesPipelineStage;
  customerId?: number;
  keyword?: string;
}): SalesOpportunityListItem[] {
  const db = getDb();
  const conditions: string[] = [];
  const params: Array<string | number> = [];

  if (filters?.stage) {
    conditions.push('o.stage = ?');
    params.push(filters.stage);
  }
  if (filters?.customerId) {
    conditions.push('o.customer_id = ?');
    params.push(filters.customerId);
  }
  if (filters?.keyword?.trim()) {
    conditions.push(
      '(o.title LIKE ? OR IFNULL(o.product_type, \'\') LIKE ? OR c.name LIKE ? OR c.phone LIKE ?)',
    );
    const like = `%${filters.keyword.trim()}%`;
    params.push(like, like, like, like);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = db
    .prepare(
      `SELECT o.*, c.name AS customer_name, c.phone AS customer_phone
       FROM sales_opportunities o
       JOIN sales_customers c ON c.id = o.customer_id
       ${where}
       ORDER BY o.updated_at DESC`,
    )
    .all(...params) as Record<string, unknown>[];

  return rows.map((row) => ({
    ...mapOpportunity(row),
    customerName: row.customer_name as string,
    customerPhone: row.customer_phone as string,
  }));
}

export function getSalesOpportunityById(id: number): SalesOpportunity | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM sales_opportunities WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? mapOpportunity(row) : null;
}

export function getSalesOpportunityDetail(id: number): SalesOpportunityDetail | null {
  const opportunity = getSalesOpportunityById(id);
  if (!opportunity) return null;
  const customer = getSalesCustomerById(opportunity.customerId);
  if (!customer) return null;

  const records = listComplianceRecords(id);
  const complianceItems = buildComplianceItemViews(opportunity.stage, records);

  return {
    ...opportunity,
    customer,
    activities: listSalesActivities(id),
    complianceItems,
  };
}

export function createSalesOpportunity(input: {
  customerId: number;
  title: string;
  productType?: string;
  stage?: SalesPipelineStage;
  expectedAmount?: number;
  expectedCloseAt?: string;
  notes?: string;
}): SalesOpportunity {
  const customer = getSalesCustomerById(input.customerId);
  if (!customer) {
    throw new Error('客户不存在');
  }
  const db = getDb();
  const now = new Date().toISOString();
  const result = db
    .prepare(
      `INSERT INTO sales_opportunities
        (customer_id, title, product_type, stage, expected_amount, expected_close_at, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.customerId,
      input.title,
      input.productType ?? null,
      input.stage ?? 'lead',
      input.expectedAmount ?? null,
      input.expectedCloseAt ?? null,
      input.notes ?? null,
      now,
      now,
    );
  db.prepare('UPDATE sales_customers SET updated_at = ? WHERE id = ?').run(now, input.customerId);
  return getSalesOpportunityById(Number(result.lastInsertRowid))!;
}

export function updateSalesOpportunity(
  id: number,
  fields: {
    title?: string;
    productType?: string | null;
    expectedAmount?: number | null;
    expectedCloseAt?: string | null;
    lostReason?: string | null;
    notes?: string | null;
  },
): SalesOpportunity {
  const existing = getSalesOpportunityById(id);
  if (!existing) {
    throw new Error('商机不存在');
  }
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE sales_opportunities SET
      title = ?,
      product_type = ?,
      expected_amount = ?,
      expected_close_at = ?,
      lost_reason = ?,
      notes = ?,
      updated_at = ?
     WHERE id = ?`,
  ).run(
    fields.title ?? existing.title,
    fields.productType !== undefined ? fields.productType : existing.productType,
    fields.expectedAmount !== undefined ? fields.expectedAmount : existing.expectedAmount,
    fields.expectedCloseAt !== undefined ? fields.expectedCloseAt : existing.expectedCloseAt,
    fields.lostReason !== undefined ? fields.lostReason : existing.lostReason,
    fields.notes !== undefined ? fields.notes : existing.notes,
    now,
    id,
  );
  db.prepare('UPDATE sales_customers SET updated_at = ? WHERE id = ?').run(
    now,
    existing.customerId,
  );
  return getSalesOpportunityById(id)!;
}

export function checkAdvanceStage(
  opportunityId: number,
  targetStage: SalesPipelineStage,
): SalesStageAdvanceCheck {
  const opportunity = getSalesOpportunityById(opportunityId);
  if (!opportunity) {
    throw new Error('商机不存在');
  }
  if (targetStage === opportunity.stage) {
    return { ok: true, missingRequired: [] };
  }
  // 离开当前阶段前，校验当前阶段必填合规项
  const records = listComplianceRecords(opportunityId);
  return checkStageComplianceComplete(opportunity.stage, records);
}

export function advanceSalesOpportunityStage(
  id: number,
  targetStage: SalesPipelineStage,
  options?: { force?: boolean; forceNote?: string },
): SalesOpportunity {
  const opportunity = getSalesOpportunityById(id);
  if (!opportunity) {
    throw new Error('商机不存在');
  }
  if (targetStage !== opportunity.stage) {
    const check = checkAdvanceStage(id, targetStage);
    if (!check.ok && !options?.force) {
      const labels = check.missingRequired.map((item) => item.label).join('、');
      throw new Error(`当前阶段必填合规项未完成：${labels}`);
    }
    if (!check.ok && options?.force && options.forceNote?.trim()) {
      upsertComplianceItem(id, opportunity.stage, 'force_advance_override', {
        completed: true,
        note: options.forceNote.trim(),
      });
    }
  }
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare('UPDATE sales_opportunities SET stage = ?, updated_at = ? WHERE id = ?').run(
    targetStage,
    now,
    id,
  );
  db.prepare('UPDATE sales_customers SET updated_at = ? WHERE id = ?').run(
    now,
    opportunity.customerId,
  );
  return getSalesOpportunityById(id)!;
}

export function upsertComplianceItem(
  opportunityId: number,
  stage: SalesPipelineStage,
  itemKey: string,
  input: { completed: boolean; note?: string | null },
): SalesComplianceRecord {
  const opportunity = getSalesOpportunityById(opportunityId);
  if (!opportunity) {
    throw new Error('商机不存在');
  }
  const template = SALES_COMPLIANCE_TEMPLATES[stage] ?? [];
  const isKnownItem = template.some((item) => item.key === itemKey);
  const isOverrideKey = itemKey === 'force_advance_override';
  if (!isKnownItem && !isOverrideKey) {
    throw new Error('无效的合规项');
  }

  const db = getDb();
  const now = new Date().toISOString();
  const completedAt = input.completed ? now : null;
  const existing = db
    .prepare(
      `SELECT id FROM sales_compliance_records
       WHERE opportunity_id = ? AND stage = ? AND item_key = ?`,
    )
    .get(opportunityId, stage, itemKey) as { id: number } | undefined;

  if (existing) {
    db.prepare(
      `UPDATE sales_compliance_records SET completed_at = ?, note = ? WHERE id = ?`,
    ).run(completedAt, input.note ?? null, existing.id);
  } else {
    db.prepare(
      `INSERT INTO sales_compliance_records (opportunity_id, stage, item_key, completed_at, note)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(opportunityId, stage, itemKey, completedAt, input.note ?? null);
  }

  db.prepare('UPDATE sales_opportunities SET updated_at = ? WHERE id = ?').run(now, opportunityId);

  const row = db
    .prepare(
      `SELECT * FROM sales_compliance_records
       WHERE opportunity_id = ? AND stage = ? AND item_key = ?`,
    )
    .get(opportunityId, stage, itemKey) as Record<string, unknown>;
  return mapComplianceRecord(row);
}

export function deleteSalesOpportunity(id: number): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM sales_opportunities WHERE id = ?').run(id);
  return result.changes > 0;
}
