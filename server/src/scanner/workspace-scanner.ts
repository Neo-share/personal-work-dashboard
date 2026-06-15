import fs from 'node:fs';
import path from 'node:path';
import simpleGit from 'simple-git';
import type { Repository, ScanFailure } from '@project-manager/shared';

const ENV_KEYWORDS = ['dev', 'sit', 'uat', 'prod', 'gray'];

export interface WorkspaceScanOutput {
  repositories: Repository[];
  failures: ScanFailure[];
}

function detectTechTags(packageJson: Record<string, unknown>): string[] {
  const tags = new Set<string>();
  const deps = {
    ...(packageJson.dependencies as Record<string, string> | undefined),
    ...(packageJson.devDependencies as Record<string, string> | undefined),
  };

  if (deps.vue) {
    const vueVersion = deps.vue.replace(/[^\d.]/g, '');
    tags.add(Number(vueVersion.split('.')[0]) >= 3 ? 'Vue3' : 'Vue2');
  }
  if (deps.vite) tags.add('Vite');
  if (deps['@vue/cli-service']) tags.add('Vue CLI');
  if (deps.vant) tags.add('Vant');
  if (deps['element-ui']) tags.add('Element UI');
  if (deps['view-design']) tags.add('View Design');
  if (deps.echarts) tags.add('ECharts');
  if (deps['@sentry/vue'] || deps['@sentry/react']) tags.add('Sentry');
  if (deps.react) tags.add('React');
  if (deps.typescript) tags.add('TypeScript');

  return Array.from(tags);
}

function detectEnvScripts(scripts: Record<string, string> | undefined): string[] {
  if (!scripts) return [];
  const envs = new Set<string>();
  for (const script of Object.values(scripts)) {
    for (const keyword of ENV_KEYWORDS) {
      if (script.toLowerCase().includes(keyword)) {
        envs.add(keyword);
      }
    }
  }
  return Array.from(envs);
}

async function scanRepository(
  repoPath: string,
  name: string,
): Promise<{ repository: Repository; failure: ScanFailure | null }> {
  const git = simpleGit(repoPath);
  let remote: string | null = null;
  let currentBranch: string | null = null;
  let defaultBranch: string | null = null;
  let lastCommit: string | null = null;
  let lastCommitAuthor: string | null = null;
  let lastCommitAt: string | null = null;
  let isDirty = false;
  let gitError: string | null = null;

  try {
    const remotes = await git.getRemotes(true);
    remote = remotes.find((item) => item.name === 'origin')?.refs.fetch ?? null;
    const status = await git.status();
    currentBranch = status.current;
    isDirty = !status.isClean();
    const log = await git.log({ maxCount: 1 });
    if (log.latest) {
      lastCommit = log.latest.hash;
      lastCommitAuthor = log.latest.author_name;
      lastCommitAt = log.latest.date;
    }
    const branches = await git.branch(['-r']);
    defaultBranch =
      branches.all.find((branch) => branch.includes('origin/HEAD'))?.split('/').pop() ??
      'main';
  } catch {
    gitError = 'Git 信息读取失败';
  }

  let techTags: string[] = [];
  let envScripts: string[] = [];
  const packageJsonPath = path.join(repoPath, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(
        fs.readFileSync(packageJsonPath, 'utf-8'),
      ) as Record<string, unknown>;
      techTags = detectTechTags(packageJson);
      envScripts = detectEnvScripts(packageJson.scripts as Record<string, string>);
    } catch {
      gitError = gitError ?? 'package.json 解析失败';
    }
  }

  const repository: Repository = {
    id: 0,
    name,
    path: repoPath,
    remote,
    defaultBranch,
    currentBranch,
    lastCommit,
    lastCommitAuthor,
    lastCommitAt,
    isDirty,
    techTags,
    envScripts,
    scannedAt: new Date().toISOString(),
  };

  const failure =
    gitError !== null
      ? { name, path: repoPath, reason: gitError }
      : null;

  return { repository, failure };
}

function sortRepositoriesByActiveDesc(repos: Repository[]): Repository[] {
  return [...repos].sort((a, b) => {
    const aAt = Date.parse(a.lastCommitAt ?? a.scannedAt ?? '') || 0;
    const bAt = Date.parse(b.lastCommitAt ?? b.scannedAt ?? '') || 0;
    const diff = bAt - aAt;
    return diff !== 0 ? diff : a.name.localeCompare(b.name, 'zh-CN');
  });
}

export async function scanWorkspace(
  workspacePath: string,
  ignoreDirs: string[] = [],
): Promise<WorkspaceScanOutput> {
  const ignoreSet = new Set(ignoreDirs.map((item) => item.trim()).filter(Boolean));
  const repositories: Repository[] = [];
  const failures: ScanFailure[] = [];

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(workspacePath, { withFileTypes: true });
  } catch {
    return {
      repositories: [],
      failures: [{ name: workspacePath, path: workspacePath, reason: '工作区路径不可读' }],
    };
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (ignoreSet.has(entry.name)) continue;

    const repoPath = path.join(workspacePath, entry.name);
    const gitDir = path.join(repoPath, '.git');
    if (!fs.existsSync(gitDir)) continue;

    try {
      const { repository, failure } = await scanRepository(repoPath, entry.name);
      repositories.push(repository);
      if (failure) failures.push(failure);
    } catch {
      failures.push({
        name: entry.name,
        path: repoPath,
        reason: '仓库扫描异常中断',
      });
    }
  }

  return {
    repositories: sortRepositoriesByActiveDesc(repositories),
    failures,
  };
}
