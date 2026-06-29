import type { PersonalIntentType } from '@project-manager/shared';
import { getLlmModelForPurpose, isLlmConfigured } from './llm-config.js';
import { LlmExtractionError } from './llm-extraction-error.js';
import { chatCompletionWithMetrics, recordLlmSkipped } from './llm-metrics.js';

/** 助手创建的待办/日程/定时任务标题最大字数 */
export const MAX_ASSISTANT_TITLE_LENGTH = 20;

export interface ExtractTitleOptions {
  /** 非黄金话术：强制走 LLM，失败不回退原话 */
  llmOnly?: boolean;
}

const TITLE_INTENT_TYPES = new Set<PersonalIntentType>([
  'todo',
  'schedule',
  'recurring',
  'recurring_schedule',
]);

/** 各意图类型的标题提取说明 */
const TITLE_HINTS: Partial<Record<PersonalIntentType, string>> = {
  todo: '待办任务标题：保留对用户识别任务有帮助的表述（如「本周五完成UI改版方案」），去掉纯语气词。',
  schedule: '日程事件简称：如「项目评审会」「面试产品经理」，不要包含具体日期时间。',
  recurring: '定时任务名称：概括重复执行的动作，如「复盘港股收盘情况」。',
  recurring_schedule: '重复例会名称：如「团队周会」「站会」。',
};

const FALLBACK_TITLES: Partial<Record<PersonalIntentType, string>> = {
  todo: '待办事项',
  schedule: '会议安排',
  recurring: '定时任务',
  recurring_schedule: '例会',
};

function needsLlmTitle(intentType: PersonalIntentType): boolean {
  return TITLE_INTENT_TYPES.has(intentType);
}

/** 黄金话术或未强制 LLM 时的兜底：使用用户原话 */
export function fallbackTitleFromMessage(
  message: string,
  intentType: PersonalIntentType,
): string {
  const trimmed = message.trim();
  if (trimmed) {
    return trimmed.slice(0, MAX_ASSISTANT_TITLE_LENGTH);
  }
  return FALLBACK_TITLES[intentType] ?? '未命名';
}

function parseTitleFromLlmContent(content: string, jsonOnly = false): string | null {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1]!.trim() : trimmed;
  try {
    const parsed = JSON.parse(candidate) as { title?: string };
    if (typeof parsed.title === 'string' && parsed.title.trim()) {
      return parsed.title.trim().slice(0, MAX_ASSISTANT_TITLE_LENGTH);
    }
  } catch {
    if (!jsonOnly && candidate && !candidate.startsWith('{')) {
      return candidate.replace(/^["']|["']$/g, '').slice(0, MAX_ASSISTANT_TITLE_LENGTH);
    }
  }
  return null;
}

/**
 * 从自然语言提取标题。
 * llmOnly=true（非黄金话术）：必须走 LLM，失败抛 LlmExtractionError。
 */
export async function extractTitleWithLlm(
  message: string,
  intentType: PersonalIntentType,
  options?: ExtractTitleOptions,
): Promise<string> {
  if (!needsLlmTitle(intentType)) {
    return fallbackTitleFromMessage(message, intentType);
  }

  const llmOnly = options?.llmOnly === true;
  const trimmed = message.trim();

  if (!llmOnly && trimmed.length <= MAX_ASSISTANT_TITLE_LENGTH) {
    recordLlmSkipped('title', 'short_message');
    return fallbackTitleFromMessage(message, intentType);
  }

  if (!isLlmConfigured()) {
    if (llmOnly) {
      throw new LlmExtractionError('未配置 LLM_API_KEY，无法提取标题');
    }
    return fallbackTitleFromMessage(message, intentType);
  }

  const hint = TITLE_HINTS[intentType] ?? '提取简短标题';
  const result = await chatCompletionWithMetrics('title', {
    model: getLlmModelForPurpose('title'),
    messages: [
      {
        role: 'system',
        content: [
          '你是个人工作台助手，从用户输入中提取标题。',
          hint,
          '只输出 JSON：{"title":"..."}，不要 markdown，不要解释。',
          `标题长度不超过 ${MAX_ASSISTANT_TITLE_LENGTH} 字，使用中文。`,
        ].join('\n'),
      },
      { role: 'user', content: trimmed },
    ],
    temperature: 0.2,
    maxTokens: 120,
  });

  const title = parseTitleFromLlmContent(result.content, llmOnly);
  if (title) {
    return title;
  }

  if (llmOnly) {
    throw new LlmExtractionError('LLM 未返回有效标题 JSON');
  }

  console.error('[llm-title] 提取失败，使用原话');
  return fallbackTitleFromMessage(message, intentType);
}
