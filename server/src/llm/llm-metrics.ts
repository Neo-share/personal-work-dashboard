import type { ChatCompletionOptions, ChatCompletionResult } from './openai-client.js';
import { createLlmClient } from './openai-client.js';
import { inMemoryMetricsLedger } from '../assistant/metrics-ledger.js';

/** LLM 调用场景，用于指标分桶 */
export type LlmCaller = 'title' | 'generate' | 'revise';

export function recordLlmMetrics(
  caller: LlmCaller,
  model: string,
  latencyMs: number,
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  },
): void {
  const ts = new Date().toISOString();
  inMemoryMetricsLedger.record({
    name: 'pw.llm.latency_ms',
    ts,
    tags: { caller, model },
    value: latencyMs,
  });

  if (!usage) {
    return;
  }

  inMemoryMetricsLedger.record({
    name: 'pw.llm.tokens',
    ts,
    tags: {
      caller,
      model,
      prompt: String(usage.promptTokens),
      completion: String(usage.completionTokens),
    },
    value: usage.totalTokens,
  });
}

/** 记录因降本策略跳过 LLM 的调用 */
export function recordLlmSkipped(caller: LlmCaller, reason: string): void {
  inMemoryMetricsLedger.record({
    name: 'pw.llm.skipped',
    ts: new Date().toISOString(),
    tags: { caller, reason },
  });
}

/**
 * 带 MetricsLedger 记录的 chatCompletion 包装
 * @throws LLM 未配置或请求失败
 */
export async function chatCompletionWithMetrics(
  caller: LlmCaller,
  options: ChatCompletionOptions,
): Promise<ChatCompletionResult> {
  const client = createLlmClient();
  if (!client) {
    throw new Error('LLM 未配置');
  }

  const started = Date.now();
  const result = await client.chatCompletion(options);
  recordLlmMetrics(caller, result.model, Date.now() - started, result.usage);
  return result;
}
