import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/** 与 feishu-docu-mcp 共用，复用 Cursor 侧 OAuth 缓存 */
const TOKEN_DIR = join(homedir(), '.feishu-mcp');
const TOKEN_FILE = join(TOKEN_DIR, 'token.json');

export interface FeishuTokenData {
  access_token: string;
  expires_at: number;
  token_type?: string;
  scope?: string;
  refresh_token?: string;
  refresh_expires_at?: number;
}

function ensureDir() {
  if (!existsSync(TOKEN_DIR)) {
    mkdirSync(TOKEN_DIR, { recursive: true });
  }
}

export function loadFeishuToken(): FeishuTokenData | null {
  try {
    if (!existsSync(TOKEN_FILE)) {
      return null;
    }
    return JSON.parse(readFileSync(TOKEN_FILE, 'utf-8')) as FeishuTokenData;
  } catch {
    return null;
  }
}

export function saveFeishuToken(tokenData: FeishuTokenData) {
  ensureDir();
  writeFileSync(TOKEN_FILE, JSON.stringify(tokenData, null, 2), 'utf-8');
}

export function isFeishuAccessTokenExpired(tokenData: FeishuTokenData | null): boolean {
  if (!tokenData?.access_token || !tokenData.expires_at) {
    return true;
  }
  return Date.now() >= tokenData.expires_at - 60_000;
}

export function isFeishuRefreshTokenExpired(tokenData: FeishuTokenData | null): boolean {
  if (!tokenData?.refresh_token || !tokenData.refresh_expires_at) {
    return true;
  }
  return Date.now() >= tokenData.refresh_expires_at - 60_000;
}
