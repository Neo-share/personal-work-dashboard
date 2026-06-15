import fs from 'node:fs';
import path from 'node:path';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';

/** 加载 server/.env（不加载 .env.example） */
export function loadServerEnv(): string | null {
  const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const candidates = [
    path.join(serverRoot, '.env'),
    path.join(serverRoot, '..', '.env'),
    path.resolve(process.cwd(), 'server', '.env'),
    path.resolve(process.cwd(), '.env'),
  ];

  const seen = new Set<string>();
  for (const envPath of candidates) {
    const normalized = path.resolve(envPath);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    if (!fs.existsSync(normalized)) continue;
    loadEnvFile(normalized);
    return normalized;
  }

  return null;
}
