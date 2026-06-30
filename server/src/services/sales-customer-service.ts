import type {
  SalesCustomer,
  SalesCustomerDetail,
  SalesKycStatus,
  SalesOpportunity,
  SalesRiskLevel,
} from '@project-manager/shared';
import { getDb } from '../db/index.js';

function mapCustomer(row: Record<string, unknown>): SalesCustomer {
  return {
    id: row.id as number,
    name: row.name as string,
    phone: row.phone as string,
    source: (row.source as string | null) ?? null,
    riskLevel: row.risk_level as SalesRiskLevel,
    kycStatus: row.kyc_status as SalesKycStatus,
    notes: (row.notes as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapOpportunity(row: Record<string, unknown>): SalesOpportunity {
  return {
    id: row.id as number,
    customerId: row.customer_id as number,
    title: row.title as string,
    productType: (row.product_type as string | null) ?? null,
    stage: row.stage as SalesOpportunity['stage'],
    expectedAmount: (row.expected_amount as number | null) ?? null,
    expectedCloseAt: (row.expected_close_at as string | null) ?? null,
    lostReason: (row.lost_reason as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function listSalesCustomers(keyword?: string): SalesCustomer[] {
  const db = getDb();
  if (keyword?.trim()) {
    const like = `%${keyword.trim()}%`;
    const rows = db
      .prepare(
        `SELECT * FROM sales_customers
         WHERE name LIKE ? OR phone LIKE ? OR IFNULL(source, '') LIKE ?
         ORDER BY updated_at DESC`,
      )
      .all(like, like, like) as Record<string, unknown>[];
    return rows.map(mapCustomer);
  }
  const rows = db
    .prepare('SELECT * FROM sales_customers ORDER BY updated_at DESC')
    .all() as Record<string, unknown>[];
  return rows.map(mapCustomer);
}

export function getSalesCustomerById(id: number): SalesCustomer | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM sales_customers WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? mapCustomer(row) : null;
}

export function getSalesCustomerDetail(id: number): SalesCustomerDetail | null {
  const customer = getSalesCustomerById(id);
  if (!customer) return null;
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM sales_opportunities WHERE customer_id = ? ORDER BY updated_at DESC')
    .all(id) as Record<string, unknown>[];
  return {
    ...customer,
    opportunities: rows.map(mapOpportunity),
  };
}

export function createSalesCustomer(input: {
  name: string;
  phone: string;
  source?: string;
  riskLevel?: SalesRiskLevel;
  kycStatus?: SalesKycStatus;
  notes?: string;
}): SalesCustomer {
  const db = getDb();
  const now = new Date().toISOString();
  const result = db
    .prepare(
      `INSERT INTO sales_customers (name, phone, source, risk_level, kyc_status, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.name,
      input.phone,
      input.source ?? null,
      input.riskLevel ?? 'unknown',
      input.kycStatus ?? 'pending',
      input.notes ?? null,
      now,
      now,
    );
  return getSalesCustomerById(Number(result.lastInsertRowid))!;
}

export function updateSalesCustomer(
  id: number,
  fields: {
    name?: string;
    phone?: string;
    source?: string | null;
    riskLevel?: SalesRiskLevel;
    kycStatus?: SalesKycStatus;
    notes?: string | null;
  },
): SalesCustomer {
  const existing = getSalesCustomerById(id);
  if (!existing) {
    throw new Error('客户不存在');
  }
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE sales_customers SET
      name = ?,
      phone = ?,
      source = ?,
      risk_level = ?,
      kyc_status = ?,
      notes = ?,
      updated_at = ?
     WHERE id = ?`,
  ).run(
    fields.name ?? existing.name,
    fields.phone ?? existing.phone,
    fields.source !== undefined ? fields.source : existing.source,
    fields.riskLevel ?? existing.riskLevel,
    fields.kycStatus ?? existing.kycStatus,
    fields.notes !== undefined ? fields.notes : existing.notes,
    now,
    id,
  );
  return getSalesCustomerById(id)!;
}

export function deleteSalesCustomer(id: number): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM sales_customers WHERE id = ?').run(id);
  return result.changes > 0;
}
