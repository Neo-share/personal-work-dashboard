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
import { LlmExtractionError } from './llm-extraction-error.js';
import { extractTitleWithLlm, MAX_ASSISTANT_TITLE_LENGTH } from './llm-title-extractor.js';

describe('llm-title-extractor', () => {
  it('黄金话术短句可跳过 LLM', async () => {
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
  });

  it('非黄金话术 llmOnly 时短句也走 LLM', async () => {
    vi.mocked(chatCompletionWithMetrics).mockResolvedValue({
      content: '{"title":"打卡提醒"}',
      model: 'gpt-4o-mini',
    });

    const title = await extractTitleWithLlm('每天早上8点15提醒我打卡', 'recurring', {
      llmOnly: true,
    });

    expect(title).toBe('打卡提醒');
    expect(chatCompletionWithMetrics).toHaveBeenCalledOnce();
  });

  it('llmOnly 且 LLM 无效响应时抛出错误', async () => {
    vi.mocked(chatCompletionWithMetrics).mockResolvedValue({
      content: '无效',
      model: 'gpt-4o-mini',
    });

    await expect(
      extractTitleWithLlm('每天早上8点15提醒我打卡', 'recurring', { llmOnly: true }),
    ).rejects.toBeInstanceOf(LlmExtractionError);
  });
});
