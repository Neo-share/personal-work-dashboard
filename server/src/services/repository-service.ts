import fs from 'node:fs';
import simpleGit from 'simple-git';
import type {
  Repository,
  RepositoryBranchItem,
  RepositoryBranches,
  RepositoryBranchSyncResult,
  ScanFailure,
  ScanResult,
} from '@project-manager/shared';
import { getDb, getIgnoreDirs } from '../db/index.js';
import { scanWorkspace } from '../scanner/workspace-scanner.js';

function mapRepository(row: Record<string, unknown>): Repository {
  return {
    id: row.id as number,
    name: row.name as string,
    path: row.path as string,
    remote: (row.remote as string | null) ?? null,
    defaultBranch: (row.default_branch as string | null) ?? null,
    currentBranch: (row.current_branch as string | null) ?? null,
    lastCommit: (row.last_commit as string | null) ?? null,
    lastCommitAuthor: (row.last_commit_author as string | null) ?? null,
    lastCommitAt: (row.last_commit_at as string | null) ?? null,
    isDirty: Boolean(row.is_dirty),
    techTags: JSON.parse((row.tech_tags as string) || '[]') as string[],
    envScripts: JSON.parse((row.env_scripts as string) || '[]') as string[],
    scannedAt: (row.scanned_at as string | null) ?? null,
  };
}

export function listRepositories(): Repository[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM repositories
       ORDER BY COALESCE(last_commit_at, scanned_at) DESC, name ASC`,
    )
    .all() as Array<Record<string, unknown>>;
  return rows.map(mapRepository);
}

export function getRepositoryById(id: number): Repository | null {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM repositories WHERE id = ?')
    .get(id) as Record<string, unknown> | undefined;
  return row ? mapRepository(row) : null;
}

export class RepositoryGitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RepositoryGitError';
  }
}

function getBranchNotesMap(repositoryId: number): Map<string, string> {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT branch, notes FROM repository_branch_notes WHERE repository_id = ? AND notes != ''",
    )
    .all(repositoryId) as Array<{ branch: string; notes: string }>;
  return new Map(rows.map((row) => [row.branch, row.notes]));
}

export async function setRepositoryBranchNote(
  repositoryId: number,
  branch: string,
  notes: string,
): Promise<RepositoryBranchItem> {
  const repo = getRepositoryOrThrow(repositoryId);
  const branchName = branch.trim();
  if (!branchName) {
    throw new RepositoryGitError('分支名称不能为空');
  }

  const git = simpleGit(repo.path);
  const summary = await git.branchLocal();
  if (!summary.all.includes(branchName)) {
    throw new RepositoryGitError(`本地不存在分支「${branchName}」`);
  }

  const db = getDb();
  const trimmedNotes = notes.trim();
  if (!trimmedNotes) {
    db.prepare('DELETE FROM repository_branch_notes WHERE repository_id = ? AND branch = ?').run(
      repositoryId,
      branchName,
    );
    return { name: branchName, notes: null };
  }

  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO repository_branch_notes (repository_id, branch, notes, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(repository_id, branch) DO UPDATE SET
       notes = excluded.notes,
       updated_at = excluded.updated_at`,
  ).run(repositoryId, branchName, trimmedNotes, now);

  return { name: branchName, notes: trimmedNotes };
}

export async function listRepositoryBranches(id: number): Promise<RepositoryBranches> {
  const repo = getRepositoryById(id);
  if (!repo) {
    throw new RepositoryGitError('仓库不存在');
  }
  if (!fs.existsSync(repo.path)) {
    throw new RepositoryGitError(`仓库路径不存在：${repo.path}`);
  }

  try {
    const git = simpleGit(repo.path);
    const summary = await git.branchLocal();
    const currentBranch = summary.current || repo.currentBranch;
    const branches = [...summary.all].sort((a, b) => {
      if (a === currentBranch) return -1;
      if (b === currentBranch) return 1;
      return a.localeCompare(b, 'zh-CN');
    });

    const notesMap = getBranchNotesMap(id);
    await refreshRepositoryGitMetadataSafe(id, repo.path);

    return {
      currentBranch,
      branches: branches.map((name) => ({
        name,
        notes: notesMap.get(name) ?? null,
      })),
    };
  } catch (error) {
    if (error instanceof RepositoryGitError) {
      throw error;
    }
    throw new RepositoryGitError('读取本地分支失败，请确认该目录是有效的 Git 仓库');
  }
}

function syncRepositoryGitState(repositoryId: number, repoPath: string): Promise<void> {
  return refreshRepositoryGitMetadata(repositoryId, repoPath);
}

async function refreshRepositoryGitMetadata(
  repositoryId: number,
  repoPath: string,
): Promise<void> {
  const git = simpleGit(repoPath);
  const status = await git.status();
  const log = await git.log({ maxCount: 1 });
  const db = getDb();
  db.prepare(
    `UPDATE repositories SET
      current_branch = ?, is_dirty = ?, last_commit = ?, last_commit_author = ?, last_commit_at = ?
     WHERE id = ?`,
  ).run(
    status.current,
    status.isClean() ? 0 : 1,
    log.latest?.hash ?? null,
    log.latest?.author_name ?? null,
    log.latest?.date ?? null,
    repositoryId,
  );
}

/** 从磁盘 Git 状态刷新 DB；路径无效或读取失败时静默跳过 */
async function refreshRepositoryGitMetadataSafe(
  repositoryId: number,
  repoPath: string,
): Promise<void> {
  if (!fs.existsSync(repoPath)) {
    return;
  }
  try {
    await refreshRepositoryGitMetadata(repositoryId, repoPath);
  } catch {
    // 外部切换分支后仓库可能处于中间状态，跳过单次刷新
  }
}

/** 批量刷新仓库 Git 元数据；未传 id 时刷新全部 */
export async function refreshRepositoriesGitMetadata(
  repositoryIds?: number[],
): Promise<void> {
  const repos = repositoryIds?.length
    ? repositoryIds
        .map((id) => getRepositoryById(id))
        .filter((repo): repo is Repository => repo !== null)
    : listRepositories();

  await Promise.all(
    repos.map((repo) => refreshRepositoryGitMetadataSafe(repo.id, repo.path)),
  );
}

/** 读取列表前先同步各仓库当前分支与 dirty 状态 */
export async function listRepositoriesLive(): Promise<Repository[]> {
  await refreshRepositoriesGitMetadata();
  return listRepositories();
}

function getRepositoryOrThrow(repositoryId: number): Repository {
  const repo = getRepositoryById(repositoryId);
  if (!repo) {
    throw new RepositoryGitError('仓库不存在');
  }
  if (!fs.existsSync(repo.path)) {
    throw new RepositoryGitError(`仓库路径不存在：${repo.path}`);
  }
  return repo;
}

export async function syncRepositoryBranches(
  repositoryId: number,
  branch?: string,
): Promise<RepositoryBranchSyncResult> {
  const repo = getRepositoryOrThrow(repositoryId);
  const git = simpleGit(repo.path);

  try {
    if (!branch?.trim()) {
      await git.fetch(['--prune']);
      await refreshRepositoryGitMetadata(repositoryId, repo.path);
      const branchSummary = await git.branchLocal();
      return {
        ok: true,
        mode: 'fetch',
        branch: null,
        summary: `已从远程同步分支信息，本地共 ${branchSummary.all.length} 个分支`,
        currentBranch: branchSummary.current || repo.currentBranch,
      };
    }

    const branchName = branch.trim();
    const local = await git.branchLocal();
    if (!local.all.includes(branchName)) {
      throw new RepositoryGitError(`本地不存在分支「${branchName}」`);
    }

    await git.fetch(['--prune']);

    if (local.current === branchName) {
      const status = await git.status();
      if (!status.isClean()) {
        throw new RepositoryGitError(
          `工作区有未提交改动，无法同步当前分支「${branchName}」`,
        );
      }

      const pullResult = await git.pull();
      await refreshRepositoryGitMetadata(repositoryId, repo.path);
      const changes = pullResult.summary?.changes ?? 0;
      return {
        ok: true,
        mode: 'pull',
        branch: branchName,
        summary: changes > 0 ? `已拉取 ${changes} 个变更` : `分支「${branchName}」已是最新`,
        currentBranch: branchName,
      };
    }

    await git.raw(['fetch', 'origin', `${branchName}:${branchName}`]);
    await refreshRepositoryGitMetadata(repositoryId, repo.path);
    return {
      ok: true,
      mode: 'pull',
      branch: branchName,
      summary: `已从 origin 同步分支「${branchName}」`,
      currentBranch: local.current || repo.currentBranch,
    };
  } catch (error) {
    if (error instanceof RepositoryGitError) {
      throw error;
    }
    throw new RepositoryGitError(
      branch?.trim()
        ? `同步分支「${branch.trim()}」失败，请确认 origin 远程可用且分支可快进更新`
        : '同步远程分支失败，请确认 origin 远程可用',
    );
  }
}

export async function deleteRepositoryBranch(
  repositoryId: number,
  branch: string,
): Promise<{ ok: true; branch: string }> {
  const repo = getRepositoryOrThrow(repositoryId);

  const branchName = branch.trim();
  if (!branchName) {
    throw new RepositoryGitError('分支名称不能为空');
  }

  try {
    const git = simpleGit(repo.path);
    const summary = await git.branchLocal();
    if (!summary.all.includes(branchName)) {
      throw new RepositoryGitError(`本地不存在分支「${branchName}」`);
    }
    if (summary.current === branchName) {
      throw new RepositoryGitError(
        `无法删除当前检出的分支「${branchName}」，请先切换到其他分支`,
      );
    }

    await git.deleteLocalBranch(branchName);
    const db = getDb();
    db.prepare('DELETE FROM repository_branch_notes WHERE repository_id = ? AND branch = ?').run(
      repositoryId,
      branchName,
    );
    await syncRepositoryGitState(repositoryId, repo.path);
    return { ok: true, branch: branchName };
  } catch (error) {
    if (error instanceof RepositoryGitError) {
      throw error;
    }
    throw new RepositoryGitError(`删除分支「${branchName}」失败，请确认该分支未被占用`);
  }
}

export async function runWorkspaceScan(workspacePath: string): Promise<ScanResult> {
  const db = getDb();
  const { repositories: scanned, failures } = await scanWorkspace(
    workspacePath,
    getIgnoreDirs(),
  );
  const scannedAt = new Date().toISOString();

  const upsert = db.prepare(
    `INSERT INTO repositories (
      name, path, remote, default_branch, current_branch, last_commit,
      last_commit_author, last_commit_at, is_dirty, tech_tags, env_scripts, scanned_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(name) DO UPDATE SET
      path = excluded.path,
      remote = excluded.remote,
      default_branch = excluded.default_branch,
      current_branch = excluded.current_branch,
      last_commit = excluded.last_commit,
      last_commit_author = excluded.last_commit_author,
      last_commit_at = excluded.last_commit_at,
      is_dirty = excluded.is_dirty,
      tech_tags = excluded.tech_tags,
      env_scripts = excluded.env_scripts,
      scanned_at = excluded.scanned_at`,
  );

  const transaction = db.transaction((repos: Repository[]) => {
    for (const repo of repos) {
      upsert.run(
        repo.name,
        repo.path,
        repo.remote,
        repo.defaultBranch,
        repo.currentBranch,
        repo.lastCommit,
        repo.lastCommitAuthor,
        repo.lastCommitAt,
        repo.isDirty ? 1 : 0,
        JSON.stringify(repo.techTags),
        JSON.stringify(repo.envScripts),
        scannedAt,
      );
    }
  });

  transaction(scanned);

  db.prepare(
    'INSERT INTO scan_snapshots (scanned_at, repository_count, payload) VALUES (?, ?, ?)',
  ).run(
    scannedAt,
    scanned.length,
    JSON.stringify({ repositories: scanned, failures }),
  );

  const repositories = listRepositories();
  return {
    scannedAt,
    repositoryCount: repositories.length,
    repositories,
    failures,
  };
}

function parseScanPayload(payload: string): { failures: ScanFailure[] } {
  try {
    const parsed = JSON.parse(payload) as
      | Repository[]
      | { repositories?: Repository[]; failures?: ScanFailure[] };
    if (Array.isArray(parsed)) {
      return { failures: [] };
    }
    return { failures: parsed.failures ?? [] };
  } catch {
    return { failures: [] };
  }
}

export function getLatestScanSnapshot(): ScanResult | null {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM scan_snapshots ORDER BY id DESC LIMIT 1')
    .get() as
    | { scanned_at: string; repository_count: number; payload: string }
    | undefined;
  if (!row) return null;
  const { failures } = parseScanPayload(row.payload);
  return {
    scannedAt: row.scanned_at,
    repositoryCount: row.repository_count,
    repositories: listRepositories(),
    failures,
  };
}
