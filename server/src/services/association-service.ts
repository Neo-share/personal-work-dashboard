import type {
  CollaborationDirection,
  Link,
  ManagementRole,
  Milestone,
  MilestoneStatus,
  PersonCollaborationStatus,
  RequirementPerson,
  RequirementRepository,
} from '@project-manager/shared';
import { getDb } from '../db/index.js';
import { getRequirementDetail } from './requirement-service.js';

export function addRequirementRepository(input: {
  requirementId: number;
  repositoryId: number;
  responsibility?: string;
  branch?: string;
  env?: string;
  status?: string;
  risk?: string;
}): RequirementRepository | null {
  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO requirement_repositories (
        requirement_id, repository_id, responsibility, branch, env, status, risk
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.requirementId,
      input.repositoryId,
      input.responsibility ?? null,
      input.branch ?? null,
      input.env ?? null,
      input.status ?? null,
      input.risk ?? null,
    );

  const row = db
    .prepare('SELECT * FROM requirement_repositories WHERE id = ?')
    .get(result.lastInsertRowid) as Record<string, unknown>;

  return {
    id: row.id as number,
    requirementId: row.requirement_id as number,
    repositoryId: row.repository_id as number,
    responsibility: (row.responsibility as string | null) ?? null,
    branch: (row.branch as string | null) ?? null,
    env: (row.env as string | null) ?? null,
    status: (row.status as string | null) ?? null,
    risk: (row.risk as string | null) ?? null,
  };
}

export function removeRequirementRepository(id: number): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM requirement_repositories WHERE id = ?').run(id);
  return result.changes > 0;
}

export function addRequirementPerson(input: {
  requirementId: number;
  personId: number;
  managementRole: ManagementRole;
  direction: CollaborationDirection;
  roleType: string;
  responsibility?: string;
  status?: PersonCollaborationStatus;
  notes?: string;
}): RequirementPerson | null {
  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO requirement_people (
        requirement_id, person_id, management_role, direction, role_type,
        responsibility, status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.requirementId,
      input.personId,
      input.managementRole,
      input.direction,
      input.roleType,
      input.responsibility ?? null,
      input.status ?? 'pending',
      input.notes ?? null,
    );

  const row = db
    .prepare('SELECT * FROM requirement_people WHERE id = ?')
    .get(result.lastInsertRowid) as Record<string, unknown>;

  return {
    id: row.id as number,
    requirementId: row.requirement_id as number,
    personId: row.person_id as number,
    managementRole: row.management_role as ManagementRole,
    direction: row.direction as CollaborationDirection,
    roleType: row.role_type as string,
    responsibility: (row.responsibility as string | null) ?? null,
    status: row.status as PersonCollaborationStatus,
    notes: (row.notes as string | null) ?? null,
  };
}

export function removeRequirementPerson(id: number): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM requirement_people WHERE id = ?').run(id);
  return result.changes > 0;
}

export function addMilestone(input: {
  requirementId: number;
  name: string;
  targetDate?: string;
  status?: MilestoneStatus;
  blockers?: string;
}): Milestone {
  const db = getDb();
  const result = db
    .prepare(
      'INSERT INTO milestones (requirement_id, name, target_date, status, blockers) VALUES (?, ?, ?, ?, ?)',
    )
    .run(
      input.requirementId,
      input.name,
      input.targetDate ?? null,
      input.status ?? 'pending',
      input.blockers ?? null,
    );

  const row = db
    .prepare('SELECT * FROM milestones WHERE id = ?')
    .get(result.lastInsertRowid) as Record<string, unknown>;

  return {
    id: row.id as number,
    requirementId: row.requirement_id as number,
    name: row.name as string,
    targetDate: (row.target_date as string | null) ?? null,
    status: row.status as MilestoneStatus,
    blockers: (row.blockers as string | null) ?? null,
  };
}

export function removeMilestone(id: number): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM milestones WHERE id = ?').run(id);
  return result.changes > 0;
}

export function updateMilestone(
  id: number,
  input: Partial<{
    name: string;
    targetDate: string | null;
    status: MilestoneStatus;
    blockers: string | null;
  }>,
): Milestone | null {
  const db = getDb();
  const current = db.prepare('SELECT * FROM milestones WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;
  if (!current) return null;

  db.prepare(
    'UPDATE milestones SET name = ?, target_date = ?, status = ?, blockers = ? WHERE id = ?',
  ).run(
    input.name ?? (current.name as string),
    input.targetDate !== undefined ? input.targetDate : (current.target_date as string | null),
    input.status ?? (current.status as MilestoneStatus),
    input.blockers !== undefined ? input.blockers : (current.blockers as string | null),
    id,
  );

  const row = db.prepare('SELECT * FROM milestones WHERE id = ?').get(id) as Record<string, unknown>;
  return {
    id: row.id as number,
    requirementId: row.requirement_id as number,
    name: row.name as string,
    targetDate: (row.target_date as string | null) ?? null,
    status: row.status as MilestoneStatus,
    blockers: (row.blockers as string | null) ?? null,
  };
}

export function addLink(input: {
  requirementId: number;
  type: string;
  title: string;
  url: string;
}): Link {
  const db = getDb();
  const result = db
    .prepare('INSERT INTO links (requirement_id, type, title, url) VALUES (?, ?, ?, ?)')
    .run(input.requirementId, input.type, input.title, input.url);

  const row = db
    .prepare('SELECT * FROM links WHERE id = ?')
    .get(result.lastInsertRowid) as Record<string, unknown>;

  return {
    id: row.id as number,
    requirementId: row.requirement_id as number,
    type: row.type as string,
    title: row.title as string,
    url: row.url as string,
  };
}

export function removeLink(id: number): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM links WHERE id = ?').run(id);
  return result.changes > 0;
}

export function getRepositoryRequirements(repositoryId: number) {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT req.*, rr.responsibility, rr.branch, rr.status as repo_status
       FROM requirement_repositories rr
       JOIN requirements req ON req.id = rr.requirement_id
       WHERE rr.repository_id = ?
       ORDER BY req.updated_at DESC`,
    )
    .all(repositoryId) as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    id: row.id as number,
    name: row.name as string,
    status: row.status as string,
    priority: row.priority as string,
    responsibility: (row.responsibility as string | null) ?? null,
    branch: (row.branch as string | null) ?? null,
    repoStatus: (row.repo_status as string | null) ?? null,
  }));
}

export function touchRequirement(requirementId: number): void {
  const db = getDb();
  db.prepare('UPDATE requirements SET updated_at = ? WHERE id = ?').run(
    new Date().toISOString(),
    requirementId,
  );
}

export function getRequirementDetailOrThrow(id: number) {
  const detail = getRequirementDetail(id);
  if (!detail) {
    throw new Error('需求不存在');
  }
  return detail;
}
