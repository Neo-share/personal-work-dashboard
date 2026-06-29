import type { IntentSlot, PersonalIntentType } from '@project-manager/shared';
import { getLlmModelForPurpose, isLlmConfigured } from './llm-config.js';
import { LlmExtractionError } from './llm-extraction-error.js';
import { chatCompletionWithMetrics } from './llm-metrics.js';

const SLOT_INTENT_TYPES = new Set<PersonalIntentType>([
  'todo',
  'schedule',
  'recurring',
  'recurring_schedule',
]);

const TIME_OF_DAY_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function buildSystemPrompt(intentType: PersonalIntentType, nowIso: string): string {
  const base = [
    '你是个人工作台助手，从用户自然语言中提取结构化时间字段。',
    `当前时刻（ISO 8601，用于解析相对日期）：${nowIso}`,
    '只输出 JSON，不要 markdown，不要解释。',
  ];

  switch (intentType) {
    case 'recurring':
      return [
        ...base,
        '输出：{"timeOfDay":"HH:mm","dayOfWeek":0-6可选,"dayOfMonth":1-31可选}',
        'timeOfDay 必填，须含分钟（HH:mm）；weekly 须含 dayOfWeek（0=周日）；monthly 须含 dayOfMonth。',
        '示例：「每天下午5:30打卡」→ {"timeOfDay":"17:30"}',
        '示例：「每天早上8点15提醒我打卡」→ {"timeOfDay":"08:15"}',
      ].join('\n');
    case 'recurring_schedule':
    case 'schedule':
      return [
        ...base,
        '输出：{"startAt":"ISO8601","endAt":"ISO8601"}，均为 UTC ISO 字符串。',
        'endAt 默认 startAt 后 60 分钟；站会/晨会 30 分钟，出差 480 分钟。',
      ].join('\n');
    case 'todo':
      return [
        ...base,
        '输出：{"dueAt":"ISO8601"}，UTC ISO；无明确截止时可省略 dueAt。',
      ].join('\n');
    default:
      return base.join('\n');
  }
}

function parseJsonFromLlmContent(content: string): Record<string, unknown> | null {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1]!.trim() : trimmed;
  try {
    return JSON.parse(candidate) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function parseSlotsFromLlmContent(
  content: string,
  intentType: PersonalIntentType,
): Partial<IntentSlot> | null {
  const parsed = parseJsonFromLlmContent(content);
  if (!parsed) return null;

  const slots: Partial<IntentSlot> = {};

  if (intentType === 'recurring') {
    if (typeof parsed.timeOfDay === 'string' && TIME_OF_DAY_PATTERN.test(parsed.timeOfDay)) {
      slots.timeOfDay = parsed.timeOfDay;
    }
    if (typeof parsed.dayOfWeek === 'number' && parsed.dayOfWeek >= 0 && parsed.dayOfWeek <= 6) {
      slots.dayOfWeek = parsed.dayOfWeek;
    }
    if (typeof parsed.dayOfMonth === 'number' && parsed.dayOfMonth >= 1 && parsed.dayOfMonth <= 31) {
      slots.dayOfMonth = parsed.dayOfMonth;
    }
    return slots.timeOfDay ? slots : null;
  }

  if (intentType === 'schedule' || intentType === 'recurring_schedule') {
    if (typeof parsed.startAt === 'string' && !Number.isNaN(Date.parse(parsed.startAt))) {
      slots.startAt = parsed.startAt;
    }
    if (typeof parsed.endAt === 'string' && !Number.isNaN(Date.parse(parsed.endAt))) {
      slots.endAt = parsed.endAt;
    }
    return slots.startAt && slots.endAt ? slots : null;
  }

  if (intentType === 'todo') {
    if (typeof parsed.dueAt === 'string' && !Number.isNaN(Date.parse(parsed.dueAt))) {
      slots.dueAt = parsed.dueAt;
    }
    return slots;
  }

  return null;
}

/**
 * 非黄金话术：仅用 LLM 提取时间/周期 slot，失败时不做规则回退
 */
export async function extractIntentSlotsWithLlm(
  message: string,
  intentType: PersonalIntentType,
): Promise<Partial<IntentSlot>> {
  if (!SLOT_INTENT_TYPES.has(intentType)) {
    return {};
  }

  if (!isLlmConfigured()) {
    throw new LlmExtractionError('未配置 LLM_API_KEY，无法解析时间字段');
  }

  const trimmed = message.trim();
  const nowIso = new Date().toISOString();

  const result = await chatCompletionWithMetrics('slots', {
    model: getLlmModelForPurpose('slots'),
    messages: [
      { role: 'system', content: buildSystemPrompt(intentType, nowIso) },
      { role: 'user', content: trimmed },
    ],
    temperature: 0.1,
    maxTokens: 200,
  });

  const slots = parseSlotsFromLlmContent(result.content, intentType);
  if (!slots) {
    throw new LlmExtractionError('LLM 未返回有效的时间字段 JSON');
  }

  return slots;
}
