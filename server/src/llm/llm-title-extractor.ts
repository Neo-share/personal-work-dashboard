import type { PersonalIntentType } from '@project-manager/shared';
import { getLlmModelForPurpose, isLlmConfigured } from './llm-config.js';
import { chatCompletionWithMetrics, recordLlmSkipped } from './llm-metrics.js';

/** 助手创建的待办/日程/定时任务标题最大字数 */
export const MAX_ASSISTANT_TITLE_LENGTH = 20;

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

/** LLM 未配置或调用失败时的兜底：使用用户原话，不做规则裁剪 */
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

function parseTitleFromLlmContent(content: string): string | null {
  const trimmed = content.trim();
  try {
    const parsed = JSON.parse(trimmed) as { title?: string };
    if (typeof parsed.title === 'string' && parsed.title.trim()) {
      return parsed.title.trim().slice(0, MAX_ASSISTANT_TITLE_LENGTH);
    }
  } catch {
    // 非 JSON 时尝试直接当作标题
    if (trimmed && !trimmed.startsWith('{')) {
      return trimmed.replace(/^["']|["']$/g, '').slice(0, MAX_ASSISTANT_TITLE_LENGTH);
    }
  }
  return null;
}

/**
 * 用 LLM 从自然语言提取标题；未配置或失败时回退用户原话
 */
export async function extractTitleWithLlm(
  message: string,
  intentType: PersonalIntentType,
): Promise<string> {
  if (!needsLlmTitle(intentType)) {
    return fallbackTitleFromMessage(message, intentType);
  }

  const trimmed = message.trim();
  // 降本：短句直接截取，避免额外 LLM 调用
  if (trimmed.length <= MAX_ASSISTANT_TITLE_LENGTH) {
    recordLlmSkipped('title', 'short_message');
    return fallbackTitleFromMessage(message, intentType);
  }

  if (!isLlmConfigured()) {
    return fallbackTitleFromMessage(message, intentType);
  }

  const hint = TITLE_HINTS[intentType] ?? '提取简短标题';
  try {
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

    const title = parseTitleFromLlmContent(result.content);
    if (title) {
      return title;
    }
    throw new Error('LLM 未返回有效标题');
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(`[llm-title] 提取失败，使用原话: ${detail}`);
    return fallbackTitleFromMessage(message, intentType);
  }
}
