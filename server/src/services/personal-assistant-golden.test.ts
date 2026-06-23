import { describe, expect, it } from 'vitest';
import { getDb } from '../db/index.js';
import { resolvePersonalAssistantIntent } from './personal-assistant-service.js';
import { GOLDEN_PHRASES } from '../assistant/fixtures/golden-phrases.js';

function countTable(table: 'todos' | 'schedule_events' | 'recurring_tasks'): number {
  const db = getDb();
  const row = db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get() as { c: number };
  return row.c;
}

/** 端到端：Orchestrator + ToolRegistry + DB（契约行为回归） */
describe('resolvePersonalAssistantIntent 黄金话术（E2E）', () => {
  for (const [index, caseDef] of GOLDEN_PHRASES.entries()) {
    it(`#${index + 1} ${caseDef.input}`, async () => {
      const beforeTodos = countTable('todos');
      const beforeSchedule = countTable('schedule_events');
      const beforeRecurring = countTable('recurring_tasks');

      const result = await resolvePersonalAssistantIntent(caseDef.input);

      if (caseDef.replyIncludes) {
        expect(result.reply).toContain(caseDef.replyIncludes);
      }

      switch (caseDef.intent) {
        case 'schedule':
          expect(countTable('schedule_events')).toBeGreaterThan(beforeSchedule);
          expect(countTable('todos')).toBe(beforeTodos);
          expect(result.refresh).toContain('schedule');
          break;
        case 'todo':
          expect(countTable('todos')).toBeGreaterThan(beforeTodos);
          expect(result.refresh).toContain('todos');
          break;
        case 'recurring':
          expect(countTable('recurring_tasks')).toBeGreaterThan(beforeRecurring);
          expect(result.refresh).toContain('recurringTasks');
          break;
        case 'recurring_schedule':
          expect(countTable('schedule_events')).toBeGreaterThan(beforeSchedule);
          expect(countTable('recurring_tasks')).toBe(beforeRecurring);
          expect(result.refresh).toContain('schedule');
          break;
        case 'unknown':
          expect(countTable('todos')).toBe(beforeTodos);
          expect(countTable('schedule_events')).toBe(beforeSchedule);
          expect(countTable('recurring_tasks')).toBe(beforeRecurring);
          expect(result.refresh).toBeUndefined();
          break;
      }
    });
  }
});
