import { describe, expect, it } from 'vitest';
import { inMemoryMetricsLedger } from './metrics-ledger.js';
import { summarizeLlmMetrics } from './metrics-summary.js';
import { recordLlmMetrics, recordLlmSkipped } from '../llm/llm-metrics.js';

describe('metrics-summary', () => {
  it('summarizeLlmMetrics 按 caller 聚合', () => {
    const beforeCalls = summarizeLlmMetrics().totalLlmCalls;

    recordLlmMetrics('title', 'gpt-4o-mini', 80, {
      promptTokens: 100,
      completionTokens: 20,
      totalTokens: 120,
    });
    recordLlmSkipped('title', 'short_message');
    inMemoryMetricsLedger.record({
      name: 'pw.orchestrator.latency_ms',
      ts: new Date().toISOString(),
      value: 200,
    });

    const summary = summarizeLlmMetrics();
    expect(summary.totalLlmCalls).toBeGreaterThanOrEqual(beforeCalls + 1);
    expect(summary.byCaller.title?.calls).toBeGreaterThanOrEqual(1);
    expect(summary.byCaller.title?.totalTokens).toBeGreaterThanOrEqual(120);
    expect(summary.byCaller.title?.promptTokens).toBeGreaterThanOrEqual(100);
    expect(summary.byCaller.title?.completionTokens).toBeGreaterThanOrEqual(20);
    expect(summary.totalSkipped).toBeGreaterThanOrEqual(1);
    expect(summary.orchestratorAvgLatencyMs).toBeGreaterThan(0);
  });
});
