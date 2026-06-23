import type {
  Milestone,
  Person,
  Priority,
  Requirement,
  RequirementDetail,
  RequirementPerson,
  RequirementStatus,
  WorkbenchSummary,
  WorkDomain,
} from '@project-manager/shared';
import { getDb } from '../db/index.js';
import { listRepositories, refreshRepositoriesGitMetadata } from './repository-service.js';

export function recordRequirementStatusChange(
  requirementId: number,
  oldStatus: RequirementStatus,
  newStatus: RequirementStatus,
): void {
  if (oldStatus === newStatus) return;
  const db = getDb();
  db.prepare(
    `INSERT INTO requirement_status_history (requirement_id, old_status, new_status, changed_at)
     VALUES (?, ?, ?, ?)`,
  ).run(requirementId, oldStatus, newStatus, new Date().toISOString());
}

function mapRequirement(row: Record<string, unknown>): Requirement {
  return {
    id: row.id as number,
    name: row.name as string,
    domain: (row.domain as WorkDomain | undefined) ?? 'dev',
    status: row.status as RequirementStatus,
    priority: row.priority as Priority,
    targetVersion: (row.target_version as string | null) ?? null,
    plannedReleaseAt: (row.planned_release_at as string | null) ?? null,
    actualReleaseAt: (row.actual_release_at as string | null) ?? null,
    risk: (row.risk as string | null) ?? null,
    blockers: (row.blockers as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

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

export function listRequirements(filters?: {
  status?: RequirementStatus;
  domain?: WorkDomain;
  beforeTesting?: boolean;
  personId?: number;
  repositoryId?: number;
  riskOnly?: boolean;
  keyword?: string;
  releaseFrom?: string;
  releaseTo?: string;
}): Requirement[] {
  const db = getDb();
  const conditions: string[] = [];
  const params: Array<string | number> = [];

  if (filters?.status) {
    conditions.push('req.status = ?');
    params.push(filters.status);
  }
  if (filters?.domain) {
    conditions.push('req.domain = ?');
    params.push(filters.domain);
  }
  if (filters?.beforeTesting) {
    conditions.push("req.status IN ('pending_review', 'developing', 'integrating')");
  }
  if (filters?.personId) {
    conditions.push(
      'EXISTS (SELECT 1 FROM requirement_people rp WHERE rp.requirement_id = req.id AND rp.person_id = ?)',
    );
    params.push(filters.personId);
  }
  if (filters?.repositoryId) {
    conditions.push(
      'EXISTS (SELECT 1 FROM requirement_repositories rr WHERE rr.requirement_id = req.id AND rr.repository_id = ?)',
    );
    params.push(filters.repositoryId);
  }
  if (filters?.riskOnly) {
    conditions.push(
      "(req.risk IS NOT NULL AND req.risk != '') OR (req.blockers IS NOT NULL AND req.blockers != '')",
    );
  }
  if (filters?.keyword) {
    const keyword = `%${filters.keyword.toLowerCase()}%`;
    conditions.push(
      `(LOWER(req.name) LIKE ? OR LOWER(COALESCE(req.target_version, '')) LIKE ?
        OR EXISTS (
          SELECT 1 FROM requirement_repositories rr2
          JOIN repositories r ON r.id = rr2.repository_id
          WHERE rr2.requirement_id = req.id AND LOWER(r.name) LIKE ?
        ))`,
    );
    params.push(keyword, keyword, keyword);
  }
  if (filters?.releaseFrom) {
    conditions.push('req.planned_release_at IS NOT NULL AND req.planned_release_at >= ?');
    params.push(filters.releaseFrom);
  }
  if (filters?.releaseTo) {
    conditions.push('req.planned_release_at IS NOT NULL AND req.planned_release_at <= ?');
    params.push(filters.releaseTo);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = db
    .prepare(`SELECT DISTINCT req.* FROM requirements req ${whereClause} ORDER BY req.updated_at DESC`)
    .all(...params) as Array<Record<string, unknown>>;
  return rows.map(mapRequirement);
}

export async function getRequirementDetailLive(id: number): Promise<RequirementDetail | null> {
  const db = getDb();
  const repoIds = (
    db
      .prepare(
        'SELECT repository_id FROM requirement_repositories WHERE requirement_id = ?',
      )
      .all(id) as Array<{ repository_id: number }>
  ).map((row) => row.repository_id);

  if (repoIds.length > 0) {
    await refreshRepositoriesGitMetadata(repoIds);
  }
  return getRequirementDetail(id);
}

export function getRequirementDetail(id: number): RequirementDetail | null {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM requirements WHERE id = ?')
    .get(id) as Record<string, unknown> | undefined;
  if (!row) return null;

  const repositories = (
    db
      .prepare(
        `SELECT
           rr.id,
           rr.requirement_id,
           rr.repository_id,
           rr.responsibility,
           rr.branch,
           rr.env,
           rr.status,
           rr.risk,
           r.name,
           r.path,
           r.remote,
           r.default_branch,
           r.current_branch,
           r.last_commit,
           r.last_commit_author,
           r.last_commit_at,
           r.is_dirty,
           r.tech_tags,
           r.env_scripts,
           r.scanned_at
         FROM requirement_repositories rr
         JOIN repositories r ON r.id = rr.repository_id
         WHERE rr.requirement_id = ?`,
      )
      .all(id) as Array<Record<string, unknown>>
  ).map((item) => ({
    id: item.id as number,
    requirementId: item.requirement_id as number,
    repositoryId: item.repository_id as number,
    responsibility: (item.responsibility as string | null) ?? null,
    branch: (item.branch as string | null) ?? null,
    env: (item.env as string | null) ?? null,
    status: (item.status as string | null) ?? null,
    risk: (item.risk as string | null) ?? null,
    repository: {
      id: item.repository_id as number,
      name: item.name as string,
      path: item.path as string,
      remote: (item.remote as string | null) ?? null,
      defaultBranch: (item.default_branch as string | null) ?? null,
      currentBranch: (item.current_branch as string | null) ?? null,
      lastCommit: (item.last_commit as string | null) ?? null,
      lastCommitAuthor: (item.last_commit_author as string | null) ?? null,
      lastCommitAt: (item.last_commit_at as string | null) ?? null,
      isDirty: Boolean(item.is_dirty),
      techTags: JSON.parse((item.tech_tags as string) || '[]') as string[],
      envScripts: JSON.parse((item.env_scripts as string) || '[]') as string[],
      scannedAt: (item.scanned_at as string | null) ?? null,
    },
  })) as RequirementDetail['repositories'];

  const people = (
    db
      .prepare(
        `SELECT
           rp.id,
           rp.requirement_id,
           rp.person_id,
           rp.management_role,
           rp.direction,
           rp.role_type,
           rp.responsibility,
           rp.status,
           rp.notes,
           p.name,
           p.role,
           p.team,
           p.contact,
           p.feishu_open_id
         FROM requirement_people rp
         JOIN people p ON p.id = rp.person_id
         WHERE rp.requirement_id = ?`,
      )
      .all(id) as Array<Record<string, unknown>>
  ).map((item) => ({
    id: item.id as number,
    requirementId: item.requirement_id as number,
    personId: item.person_id as number,
    managementRole: item.management_role as RequirementPerson['managementRole'],
    direction: item.direction as RequirementPerson['direction'],
    roleType: item.role_type as string,
    responsibility: (item.responsibility as string | null) ?? null,
    status: item.status as RequirementPerson['status'],
    notes: (item.notes as string | null) ?? null,
    person: mapPerson({
      id: item.person_id,
      name: item.name,
      role: item.role,
      team: item.team,
      contact: item.contact,
      feishu_open_id: item.feishu_open_id,
    }),
  })) as RequirementDetail['people'];

  const milestones = (
    db
      .prepare('SELECT * FROM milestones WHERE requirement_id = ? ORDER BY target_date ASC')
      .all(id) as Array<Record<string, unknown>>
  ).map((item) => ({
    id: item.id as number,
    requirementId: item.requirement_id as number,
    name: item.name as string,
    targetDate: (item.target_date as string | null) ?? null,
    status: item.status as Milestone['status'],
    blockers: (item.blockers as string | null) ?? null,
  }));

  const links = (
    db
      .prepare('SELECT * FROM links WHERE requirement_id = ?')
      .all(id) as Array<Record<string, unknown>>
  ).map((item) => ({
    id: item.id as number,
    requirementId: item.requirement_id as number,
    type: item.type as string,
    title: item.title as string,
    url: item.url as string,
  }));

  return {
    ...mapRequirement(row),
    repositories,
    people,
    milestones,
    links,
  };
}

function sortRequirementsByUpdatedAtDesc(items: Requirement[]): Requirement[] {
  return [...items].sort(
    (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
  );
}

export function getWorkbenchSummary(): WorkbenchSummary {
  const requirements = listRequirements();
  const repositories = listRepositories();

  const pendingPush = sortRequirementsByUpdatedAtDesc(
    requirements.filter((item) =>
      ['developing', 'integrating', 'testing', 'pending_release'].includes(item.status),
    ),
  );
  // 与 pendingPush 互斥：待确认仅含「待评审」，联调/提测归入待推进
  const pendingConfirm = sortRequirementsByUpdatedAtDesc(
    requirements.filter((item) => item.status === 'pending_review'),
  );
  const riskRequirements = sortRequirementsByUpdatedAtDesc(
    requirements.filter((item) => Boolean(item.risk || item.blockers)),
  );
  const upcomingRelease = sortRequirementsByUpdatedAtDesc(
    requirements.filter((item) => item.plannedReleaseAt),
  );

  return {
    pendingPush,
    pendingConfirm,
    riskRequirements,
    upcomingRelease,
    totalRequirements: requirements.length,
    totalRepositories: repositories.length,
    dirtyRepositories: repositories.filter((item) => item.isDirty).length,
  };
}

export function createRequirement(input: {
  name: string;
  domain?: WorkDomain;
  status: RequirementStatus;
  priority: Priority;
  targetVersion?: string;
  plannedReleaseAt?: string;
  risk?: string;
  notes?: string;
}): Requirement {
  const db = getDb();
  const now = new Date().toISOString();
  const result = db
    .prepare(
      `INSERT INTO requirements (
        name, domain, status, priority, target_version, planned_release_at,
        risk, blockers, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
    )
    .run(
      input.name,
      input.domain ?? 'dev',
      input.status,
      input.priority,
      input.targetVersion ?? null,
      input.plannedReleaseAt ?? null,
      input.risk ?? null,
      input.notes ?? null,
      now,
      now,
    );

  return getRequirementDetail(Number(result.lastInsertRowid))!;
}

export function updateRequirement(
  id: number,
  input: Partial<{
    name: string;
    domain: WorkDomain;
    status: RequirementStatus;
    priority: Priority;
    targetVersion: string | null;
    plannedReleaseAt: string | null;
    risk: string | null;
    blockers: string | null;
    notes: string | null;
  }>,
): Requirement | null {
  const current = getRequirementDetail(id);
  if (!current) return null;

  const db = getDb();
  const now = new Date().toISOString();
  const nextStatus = input.status ?? current.status;
  db.prepare(
    `UPDATE requirements SET
      name = ?, domain = ?, status = ?, priority = ?, target_version = ?,
      planned_release_at = ?, risk = ?, blockers = ?, notes = ?, updated_at = ?
     WHERE id = ?`,
  ).run(
    input.name ?? current.name,
    input.domain ?? current.domain,
    nextStatus,
    input.priority ?? current.priority,
    input.targetVersion ?? current.targetVersion,
    input.plannedReleaseAt ?? current.plannedReleaseAt,
    input.risk ?? current.risk,
    input.blockers ?? current.blockers,
    input.notes ?? current.notes,
    now,
    id,
  );

  if (nextStatus !== current.status) {
    recordRequirementStatusChange(id, current.status, nextStatus);
  }

  return getRequirementDetail(id);
}

export function deleteRequirement(id: number): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM requirements WHERE id = ?').run(id);
  return result.changes > 0;
}
