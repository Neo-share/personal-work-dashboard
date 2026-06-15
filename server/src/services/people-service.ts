import type { Person } from '@project-manager/shared';
import { getDb } from '../db/index.js';

function mapPerson(row: Record<string, unknown>): Person {
  return {
    id: row.id as number,
    name: row.name as string,
    role: row.role as string,
    team: (row.team as string | null) ?? null,
    contact: (row.contact as string | null) ?? null,
    feishuOpenId: (row.feishu_open_id as string | null) ?? null,
  };
}

export function getPersonById(id: number): Person | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM people WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? mapPerson(row) : null;
}

export function listPeople(): Person[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM people ORDER BY name ASC')
    .all() as Array<Record<string, unknown>>;
  return rows.map(mapPerson);
}

export function createPerson(input: {
  name: string;
  role: string;
  team?: string;
  contact?: string;
  feishuOpenId?: string;
}): Person {
  const db = getDb();
  const result = db
    .prepare('INSERT INTO people (name, role, team, contact, feishu_open_id) VALUES (?, ?, ?, ?, ?)')
    .run(
      input.name,
      input.role,
      input.team ?? null,
      input.contact ?? null,
      input.feishuOpenId ?? null,
    );
  const row = db
    .prepare('SELECT * FROM people WHERE id = ?')
    .get(result.lastInsertRowid) as Record<string, unknown>;
  return mapPerson(row);
}

export function updatePerson(
  id: number,
  input: Partial<{
    name: string;
    role: string;
    team: string | null;
    contact: string | null;
    feishuOpenId: string | null;
  }>,
): Person | null {
  const db = getDb();
  const current = db.prepare('SELECT * FROM people WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;
  if (!current) return null;

  db.prepare(
    'UPDATE people SET name = ?, role = ?, team = ?, contact = ?, feishu_open_id = ? WHERE id = ?',
  ).run(
    input.name ?? (current.name as string),
    input.role ?? (current.role as string),
    input.team !== undefined ? input.team : (current.team as string | null),
    input.contact !== undefined ? input.contact : (current.contact as string | null),
    input.feishuOpenId !== undefined
      ? input.feishuOpenId
      : (current.feishu_open_id as string | null),
    id,
  );

  const row = db.prepare('SELECT * FROM people WHERE id = ?').get(id) as Record<string, unknown>;
  return mapPerson(row);
}

export function deletePerson(id: number): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM people WHERE id = ?').run(id);
  return result.changes > 0;
}
