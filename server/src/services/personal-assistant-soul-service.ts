import type { PersonalAssistantSoulSettings } from '@project-manager/shared';
import { getDb } from '../db/index.js';

const SETTINGS_KEY = 'personal_assistant_soul';

const DEFAULT_SOUL_SETTINGS: PersonalAssistantSoulSettings = {
  tone: 'concise',
  customInstructions: '',
};

export function getPersonalAssistantSoulSettings(): PersonalAssistantSoulSettings {
  const db = getDb();
  const row = db
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get(SETTINGS_KEY) as { value: string } | undefined;
  if (!row?.value) {
    return { ...DEFAULT_SOUL_SETTINGS };
  }
  try {
    const parsed = JSON.parse(row.value) as Partial<PersonalAssistantSoulSettings>;
    return {
      tone: parsed.tone ?? DEFAULT_SOUL_SETTINGS.tone,
      customInstructions: parsed.customInstructions ?? '',
    };
  } catch {
    return { ...DEFAULT_SOUL_SETTINGS };
  }
}

export function setPersonalAssistantSoulSettings(
  input: PersonalAssistantSoulSettings,
): PersonalAssistantSoulSettings {
  const db = getDb();
  const normalized: PersonalAssistantSoulSettings = {
    tone: input.tone,
    customInstructions: input.customInstructions.trim(),
  };
  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(SETTINGS_KEY, JSON.stringify(normalized));
  return normalized;
}
