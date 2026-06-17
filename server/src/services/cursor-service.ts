import { execFile } from 'node:child_process';
import fs from 'node:fs';
import { promisify } from 'node:util';
import simpleGit, { type SimpleGit } from 'simple-git';
import { getDb } from '../db/index.js';
import { getRepositoryById } from './repository-service.js';

const execFileAsync = promisify(execFile);

const CURSOR_BIN_CANDIDATES = [
  'cursor',
  '/usr/local/bin/cursor',
  '/Applications/Cursor.app/Contents/Resources/app/bin/cursor',
];

export class CursorOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CursorOpenError';
  }
}

function buildClassicWindowArgs(repoPath: string): string[] {
  return ['--new-window', '--classic', repoPath];
}

async function launchCursor(args: string[]): Promise<void> {
  let lastError: unknown;

  for (const command of CURSOR_BIN_CANDIDATES) {
    try {
      await execFileAsync(command, args);
      return;
    } catch (error) {
      lastError = error;
    }
  }

  const detail = lastError instanceof Error ? lastError.message : String(lastError);
  throw new CursorOpenError(`无法调用 cursor 命令，请确认已安装 Cursor CLI。${detail}`);
}

/** 与手动执行 `cursor <repoPath>`（A4）一致：默认打开/聚焦，不强制 -n/--glass。 */
async function openAgentWithCursor(repoPath: string): Promise<void> {
  await launchCursor([repoPath]);
}

async function checkoutTargetBranch(git: SimpleGit, targetBranch: string): Promise<boolean> {
  const status = await git.status();
  if (status.current === targetBranch) {
    return false;
  }
  if (!status.isClean()) {
    throw new CursorOpenError(
      `工作区有未提交改动，无法切换到分支「${targetBranch}」。请先在 Cursor 或终端处理改动。`,
    );
  }

  try {
    await git.checkout(targetBranch);
    return true;
  } catch {
    // 尝试基于远程分支创建/切换本地分支
    try {
      await git.checkout(['-B', targetBranch, `origin/${targetBranch}`]);
      return true;
    } catch {
      try {
        await git.checkout(['--track', `origin/${targetBranch}`]);
        return true;
      } catch {
        throw new CursorOpenError(
          `无法切换到分支「${targetBranch}」，请确认本地或 origin 上存在该分支。`,
        );
      }
    }
  }
}

async function launchClassicCursor(repoPath: string): Promise<void> {
  const argSets = [buildClassicWindowArgs(repoPath), ['--new-window', repoPath]];
  let lastError: unknown;

  for (const args of argSets) {
    try {
      await launchCursor(args);
      return;
    } catch (error) {
      lastError = error;
    }
  }

  const detail = lastError instanceof Error ? lastError.message : String(lastError);
  throw new CursorOpenError(`无法新开 Cursor 经典编辑器窗口，请确认已安装 cursor 命令。${detail}`);
}

function syncRepositoryGitState(repositoryId: number, repoPath: string): Promise<void> {
  const git = simpleGit(repoPath);
  return git.status().then((status) => {
    const db = getDb();
    db.prepare('UPDATE repositories SET current_branch = ?, is_dirty = ? WHERE id = ?').run(
      status.current,
      status.isClean() ? 0 : 1,
      repositoryId,
    );
  });
}

export async function openRepositoryInCursor(input: {
  repositoryId: number;
  branch?: string | null;
  mode?: 'agent_window' | 'classic';
}): Promise<{
  ok: true;
  path: string;
  branch: string | null;
  switched: boolean;
  mode: 'agent_window' | 'classic';
}> {
  const repo = getRepositoryById(input.repositoryId);
  if (!repo) {
    throw new CursorOpenError('仓库不存在');
  }
  if (!fs.existsSync(repo.path)) {
    throw new CursorOpenError(`仓库路径不存在：${repo.path}`);
  }

  const targetBranch = input.branch?.trim() || repo.currentBranch;
  let switched = false;
  const git = simpleGit(repo.path);

  if (targetBranch) {
    switched = await checkoutTargetBranch(git, targetBranch);
  }

  const mode = input.mode ?? 'agent_window';

  await syncRepositoryGitState(repo.id, repo.path);
  const afterBranch = targetBranch ?? repo.currentBranch;
  if (mode === 'agent_window') {
    await openAgentWithCursor(repo.path);
  } else {
    await launchClassicCursor(repo.path);
  }

  const afterStatus = await git.status();
  return {
    ok: true,
    path: repo.path,
    branch: afterStatus.current ?? afterBranch ?? null,
    switched,
    mode,
  };
}
