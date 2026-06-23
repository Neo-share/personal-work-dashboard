import { describe, expect, it } from 'vitest';
import { inMemoryMetricsLedger } from '../assistant/metrics-ledger.js';
import { recordLlmMetrics, recordLlmSkipped } from './llm-metrics.js';

describe('llm-metrics', () => {
  it('recordLlmMetrics 写入 latency / tokens', () => {
    const beforeLatency = inMemoryMetricsLedger.queryRecent({
      name: 'pw.llm.latency_ms',
      limit: 200,
    }).length;

    recordLlmMetrics('generate', 'gpt-4o-mini', 120, {
      promptTokens: 1000,
      completionTokens: 500,
      totalTokens: 1500,
    });

    const latencyEvents = inMemoryMetricsLedger.queryRecent({
      name: 'pw.llm.latency_ms',
      limit: 200,
    });
    expect(latencyEvents.length).toBe(beforeLatency + 1);
    expect(inMemoryMetricsLedger.queryRecent({ name: 'pw.llm.tokens', limit: 1 })[0]?.value).toBe(1500);
    expect(
      inMemoryMetricsLedger.queryRecent({ name: 'pw.llm.cost_cny', limit: 1 }),
    ).toHaveLength(0);
  });

  it('recordLlmSkipped 写入 skipped 指标', () => {
    const before = inMemoryMetricsLedger.queryRecent({ name: 'pw.llm.skipped', limit: 200 }).length;
    recordLlmSkipped('title', 'short_message');
    const after = inMemoryMetricsLedger.queryRecent({ name: 'pw.llm.skipped', limit: 200 });
    expect(after.length).toBe(before + 1);
    expect(after[after.length - 1]?.tags?.reason).toBe('short_message');
  });
});
