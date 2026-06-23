import Database from 'better-sqlite3';
import { afterEach, beforeEach } from 'vitest';
import { SCHEMA_SQL } from '../db/schema.js';
import { initTestDb, resetTestDb } from '../db/index.js';

/** 每个用例使用独立内存库，避免 seed 与跨用例污染 */
beforeEach(() => {
  const database = new Database(':memory:');
  database.pragma('foreign_keys = ON');
  database.exec(SCHEMA_SQL);
  initTestDb(database);
});

afterEach(() => {
  resetTestDb();
});
