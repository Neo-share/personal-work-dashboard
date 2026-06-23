import { describe, expect, it, vi } from 'vitest';
import { inMemoryMetricsLedger } from '../assistant/metrics-ledger.js';

vi.mock('./llm-config.js', () => ({
  isLlmConfigured: vi.fn(() => true),
  getLlmModelForPurpose: vi.fn(() => 'gpt-4o-mini'),
}));

vi.mock('./llm-metrics.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./llm-metrics.js')>();
  return {
    ...actual,
    chatCompletionWithMetrics: vi.fn(),
  };
});

import { chatCompletionWithMetrics } from './llm-metrics.js';
import { extractTitleWithLlm, MAX_ASSISTANT_TITLE_LENGTH } from './llm-title-extractor.js';

describe('llm-title-extractor', () => {
  it('短句跳过 LLM 并记录 skipped', async () => {
    const beforeSkipped = inMemoryMetricsLedger.queryRecent({
      name: 'pw.llm.skipped',
      limit: 200,
    }).length;

    const shortMessage = '完成UI改版';
    expect(shortMessage.length).toBeLessThanOrEqual(MAX_ASSISTANT_TITLE_LENGTH);

    const title = await extractTitleWithLlm(shortMessage, 'todo');
    expect(title).toBe(shortMessage);
    expect(chatCompletionWithMetrics).not.toHaveBeenCalled();

    const afterSkipped = inMemoryMetricsLedger.queryRecent({
      name: 'pw.llm.skipped',
      limit: 200,
    });
    expect(afterSkipped.length).toBe(beforeSkipped + 1);
    expect(afterSkipped[afterSkipped.length - 1]?.tags?.reason).toBe('short_message');
  });
});
