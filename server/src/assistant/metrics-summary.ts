import type { MetricEvent } from '@project-manager/shared';
import { inMemoryMetricsLedger } from './metrics-ledger.js';
import { getLlmConfig } from '../llm/llm-config.js';

export interface CallerMetricsBucket {
  calls: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  avgLatencyMs: number;
  skipped: number;
}

export interface LlmMetricsSummary {
  configuredModel?: string;
  persisted: boolean;
  eventCount: number;
  totalLlmCalls: number;
  totalTokens: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalSkipped: number;
  orchestratorAvgLatencyMs: number;
  aiGenerateAvgLatencyMs: number;
  byCaller: Record<string, CallerMetricsBucket>;
}

function initCallerBucket(): CallerMetricsBucket {
  return {
    calls: 0,
    totalTokens: 0,
    promptTokens: 0,
    completionTokens: 0,
    avgLatencyMs: 0,
    skipped: 0,
  };
}

function parseTagInt(tags: Record<string, string> | undefined, key: string): number {
  const value = Number(tags?.[key]);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function finalizeLatency(bucket: CallerMetricsBucket, latencySum: number): void {
  if (bucket.calls > 0) {
    bucket.avgLatencyMs = Math.round((latencySum / bucket.calls) * 100) / 100;
  }
}

function avgFromEvents(events: MetricEvent[]): number {
  if (events.length === 0) {
    return 0;
  }
  const sum = events.reduce((acc, event) => acc + (event.value ?? 0), 0);
  return Math.round((sum / events.length) * 100) / 100;
}

/** 汇总 MetricsLedger（SQLite 持久化 + 内存回退）中的 LLM 用量与时延 */
export function summarizeLlmMetrics(): LlmMetricsSummary {
  const events = inMemoryMetricsLedger.queryRecent({ limit: 5000 });
  const byCaller: Record<string, CallerMetricsBucket> = {};
  const latencySumByCaller: Record<string, number> = {};

  let totalLlmCalls = 0;
  let totalTokens = 0;
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let totalSkipped = 0;

  for (const event of events) {
    if (event.name === 'pw.llm.latency_ms') {
      const caller = event.tags?.caller ?? 'unknown';
      if (!byCaller[caller]) {
        byCaller[caller] = initCallerBucket();
        latencySumByCaller[caller] = 0;
      }
      byCaller[caller].calls += 1;
      latencySumByCaller[caller] += event.value ?? 0;
      totalLlmCalls += 1;
    }

    if (event.name === 'pw.llm.tokens') {
      const caller = event.tags?.caller ?? 'unknown';
      if (!byCaller[caller]) {
        byCaller[caller] = initCallerBucket();
        latencySumByCaller[caller] = 0;
      }
      const prompt = parseTagInt(event.tags, 'prompt');
      const completion = parseTagInt(event.tags, 'completion');
      const tokens = event.value ?? prompt + completion;
      totalTokens += tokens;
      totalPromptTokens += prompt;
      totalCompletionTokens += completion;
      byCaller[caller].totalTokens += tokens;
      byCaller[caller].promptTokens += prompt;
      byCaller[caller].completionTokens += completion;
    }

    if (event.name === 'pw.llm.skipped') {
      const caller = event.tags?.caller ?? 'unknown';
      if (!byCaller[caller]) {
        byCaller[caller] = initCallerBucket();
        latencySumByCaller[caller] = 0;
      }
      byCaller[caller].skipped += 1;
      totalSkipped += 1;
    }
  }

  for (const [caller, bucket] of Object.entries(byCaller)) {
    finalizeLatency(bucket, latencySumByCaller[caller] ?? 0);
  }

  const orchestratorEvents = events.filter((event) => event.name === 'pw.orchestrator.latency_ms');
  const aiGenerateEvents = events.filter((event) => event.name === 'pw.ai.generate.latency_ms');

  return {
    configuredModel: getLlmConfig()?.model,
    persisted: events.length > 0,
    eventCount: events.length,
    totalLlmCalls,
    totalTokens,
    totalPromptTokens,
    totalCompletionTokens,
    totalSkipped,
    orchestratorAvgLatencyMs: avgFromEvents(orchestratorEvents),
    aiGenerateAvgLatencyMs: avgFromEvents(aiGenerateEvents),
    byCaller,
  };
}
