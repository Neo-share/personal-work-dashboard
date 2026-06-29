import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { SCHEMA_SQL } from './schema.js';
import { seedDatabase } from './seed.js';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'project-manager.db');

let db: Database.Database | null = null;

/** 单测专用：注入内存库并重置单例 */
export function initTestDb(database: Database.Database): void {
  if (db) {
    db.close();
  }
  db = database;
}

/** 单测专用：关闭并清空单例，避免污染进程内其它测试 */
export function resetTestDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

function migrateSchema(database: Database.Database): void {
  const repositoryColumns = database
    .prepare('PRAGMA table_info(repositories)')
    .all() as Array<{ name: string }>;
  const repositoryColumnNames = new Set(repositoryColumns.map((column) => column.name));

  if (!repositoryColumnNames.has('last_commit_at')) {
    database.exec('ALTER TABLE repositories ADD COLUMN last_commit_at TEXT');
  }

  const peopleColumns = database
    .prepare('PRAGMA table_info(people)')
    .all() as Array<{ name: string }>;
  const peopleColumnNames = new Set(peopleColumns.map((column) => column.name));

  if (!peopleColumnNames.has('feishu_open_id')) {
    database.exec('ALTER TABLE people ADD COLUMN feishu_open_id TEXT');
  }

  const requirementColumns = database
    .prepare('PRAGMA table_info(requirements)')
    .all() as Array<{ name: string }>;
  const requirementColumnNames = new Set(requirementColumns.map((column) => column.name));

  if (!requirementColumnNames.has('domain')) {
    database.exec("ALTER TABLE requirements ADD COLUMN domain TEXT NOT NULL DEFAULT 'dev'");
  }

  // 工作域枚举调整：将旧生活/学习等域映射到新业务域
  const legacyDomainMap: Record<string, string> = {
    life: 'operations',
    learning: 'product',
    admin: 'operations',
    other: 'operations',
  };
  for (const [legacy, target] of Object.entries(legacyDomainMap)) {
    database.prepare('UPDATE requirements SET domain = ? WHERE domain = ?').run(target, legacy);
  }
}

export function getDb(): Database.Database {
  if (!db) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.exec(SCHEMA_SQL);
    migrateSchema(db);
    seedDatabase(db);
  }
  return db;
}

export function getWorkspacePath(): string {
  const database = getDb();
  const row = database
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get('workspace_path') as { value: string } | undefined;
  return row?.value ?? '/Users/ningliu/Documents/CodeLab';
}

export function setWorkspacePath(workspacePath: string): void {
  const database = getDb();
  database
    .prepare(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    )
    .run('workspace_path', workspacePath);
}

const DEFAULT_IGNORE_DIRS = ['node_modules', '.cursor', '.Trash'];

export function getIgnoreDirs(): string[] {
  const database = getDb();
  const row = database
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get('scan_ignore_dirs') as { value: string } | undefined;
  if (!row?.value) return [...DEFAULT_IGNORE_DIRS];
  try {
    const parsed = JSON.parse(row.value) as string[];
    return Array.isArray(parsed) ? parsed : [...DEFAULT_IGNORE_DIRS];
  } catch {
    return [...DEFAULT_IGNORE_DIRS];
  }
}

export function setIgnoreDirs(dirs: string[]): void {
  const database = getDb();
  const normalized = dirs.map((item) => item.trim()).filter(Boolean);
  database
    .prepare(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    )
    .run('scan_ignore_dirs', JSON.stringify(normalized));
}

