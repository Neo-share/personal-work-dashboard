import { execFile } from 'node:child_process';
import fs from 'node:fs';
import { promisify } from 'node:util';
import simpleGit from 'simple-git';
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

function buildAgentWindowArgs(repoPath: string, reuseWindow: boolean): string[] {
  const args: string[] = [];
  if (reuseWindow) {
    args.push('-r', '--reuse-window');
  }
  args.push('--glass', repoPath);
  return args;
}

function buildClassicWindowArgs(repoPath: string, reuseWindow: boolean): string[] {
  const args: string[] = [];
  if (reuseWindow) {
    args.push('-r', '--reuse-window');
  }
  args.push('--classic', repoPath);
  return args;
}

async function launchCursor(
  repoPath: string,
  mode: 'agent_window' | 'classic',
): Promise<void> {
  const argSets =
    mode === 'agent_window'
      ? [buildAgentWindowArgs(repoPath, true), buildAgentWindowArgs(repoPath, false)]
      : [buildClassicWindowArgs(repoPath, true), buildClassicWindowArgs(repoPath, false)];

  let lastError: unknown;

  for (const args of argSets) {
    for (const command of CURSOR_BIN_CANDIDATES) {
      try {
        await execFileAsync(command, args);
        return;
      } catch (error) {
        lastError = error;
      }
    }
  }

  for (const command of CURSOR_BIN_CANDIDATES) {
    try {
      await execFileAsync(command, ['-r', '--reuse-window', repoPath]);
      return;
    } catch (error) {
      lastError = error;
    }
  }

  const detail = lastError instanceof Error ? lastError.message : String(lastError);
  throw new CursorOpenError(`无法打开 Cursor Agent Window，请确认已安装 cursor 命令。${detail}`);
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
    const status = await git.status();
    if (status.current !== targetBranch) {
      if (!status.isClean()) {
        throw new CursorOpenError(
          `工作区有未提交改动，无法切换到分支「${targetBranch}」。请先在 Cursor 或终端处理改动。`,
        );
      }
      try {
        await git.checkout(targetBranch);
        switched = true;
      } catch {
        throw new CursorOpenError(
          `无法切换到分支「${targetBranch}」，请确认本地存在该分支。`,
        );
      }
    }
  }

  const mode = input.mode ?? 'agent_window';

  await syncRepositoryGitState(repo.id, repo.path);
  await launchCursor(repo.path, mode);

  const afterStatus = await git.status();
  return {
    ok: true,
    path: repo.path,
    branch: afterStatus.current ?? targetBranch ?? null,
    switched,
    mode,
  };
}
