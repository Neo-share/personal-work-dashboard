import { describe, expect, it, vi } from 'vitest';

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
import { extractIntentSlotsWithLlm } from './llm-intent-slots-extractor.js';

describe('llm-intent-slots-extractor', () => {
  it('非黄金话术 daily 从 LLM 解析 17:30', async () => {
    vi.mocked(chatCompletionWithMetrics).mockResolvedValue({
      content: '{"timeOfDay":"17:30"}',
      model: 'gpt-4o-mini',
    });

    const slots = await extractIntentSlotsWithLlm('每天下午5：30提醒我打卡', 'recurring');

    expect(slots.timeOfDay).toBe('17:30');
    expect(chatCompletionWithMetrics).toHaveBeenCalledOnce();
  });

  it('仅采用 LLM 返回值，不做本地分钟补全', async () => {
    vi.mocked(chatCompletionWithMetrics).mockResolvedValue({
      content: '{"timeOfDay":"08:00"}',
      model: 'gpt-4o-mini',
    });

    const slots = await extractIntentSlotsWithLlm('每天早上8点15提醒我打卡', 'recurring');

    expect(slots.timeOfDay).toBe('08:00');
  });

  it('非黄金话术 weekly 从 LLM 解析星期与时间', async () => {
    vi.mocked(chatCompletionWithMetrics).mockResolvedValue({
      content: '{"timeOfDay":"17:00","dayOfWeek":5}',
      model: 'gpt-4o-mini',
    });

    const slots = await extractIntentSlotsWithLlm('每周五下午五点完成周报', 'recurring');

    expect(slots.timeOfDay).toBe('17:00');
    expect(slots.dayOfWeek).toBe(5);
  });

  it('LLM 返回无效 JSON 时抛出错误', async () => {
    vi.mocked(chatCompletionWithMetrics).mockResolvedValue({
      content: '无法解析',
      model: 'gpt-4o-mini',
    });

    await expect(extractIntentSlotsWithLlm('每天打卡', 'recurring')).rejects.toBeInstanceOf(
      LlmExtractionError,
    );
  });
});
