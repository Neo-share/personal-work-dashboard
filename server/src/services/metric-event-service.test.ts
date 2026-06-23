import { describe, expect, it } from 'vitest';
import { inMemoryMetricsLedger } from '../assistant/metrics-ledger.js';
import {
  insertMetricEvent,
  queryRecentMetricEvents,
} from './metric-event-service.js';

describe('metric-event-service', () => {
  it('insert 与 queryRecent 可读写 SQLite', () => {
    insertMetricEvent({
      name: 'pw.llm.latency_ms',
      ts: new Date().toISOString(),
      tags: { caller: 'title', model: 'gpt-4o-mini' },
      value: 42,
    });

    const events = queryRecentMetricEvents({ name: 'pw.llm.latency_ms', limit: 10 });
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[events.length - 1]?.value).toBe(42);
  });

  it('PersistingMetricsLedger record 后 queryRecent 可读库', () => {
    const before = queryRecentMetricEvents({ limit: 5000 }).length;
    inMemoryMetricsLedger.record({
      name: 'pw.test.persist',
      ts: new Date().toISOString(),
      value: 1,
    });
    const after = queryRecentMetricEvents({ limit: 5000 });
    expect(after.length).toBe(before + 1);
    expect(after[after.length - 1]?.name).toBe('pw.test.persist');
  });
});
