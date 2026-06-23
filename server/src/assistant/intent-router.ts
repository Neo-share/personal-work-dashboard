import type { RecurringFrequency } from '@project-manager/shared';
import type {
  IntentRouteContext,
  IntentRouteResult,
  IntentRouter,
  IntentSlot,
  PersonalIntentType,
} from '@project-manager/shared';

/** 日历占用类关键词 */
const SCHEDULE_KEYWORDS = [
  '会议',
  '面试',
  '出差',
  '培训',
  '演示',
  '拜访',
  '周会',
  '例会',
  '评审会',
  '站会',
];

/** 需执行动作类关键词 */
const ACTION_KEYWORDS = [
  '完成',
  '提交',
  '整理',
  '审核',
  '复盘',
  '回访',
  '提醒',
  '改造',
  '方案',
  '纪要',
  '报告',
  '分析',
  '选品',
];

/** 重复周期关键词 */
const RECURRING_PATTERNS: Array<[RegExp, RecurringFrequency]> = [
  [/每天|每日/, 'daily'],
  [/每周|每星期/, 'weekly'],
  [/每月/, 'monthly'],
];

function hasScheduleIntent(text: string): boolean {
  return SCHEDULE_KEYWORDS.some((kw) => text.includes(kw));
}

function hasActionIntent(text: string): boolean {
  return ACTION_KEYWORDS.some((kw) => text.includes(kw));
}

function hasRecurringIntent(text: string): RecurringFrequency | null {
  for (const [pattern, freq] of RECURRING_PATTERNS) {
    if (pattern.test(text)) return freq;
  }
  return null;
}

function isPureMeeting(text: string): boolean {
  const recurring = hasRecurringIntent(text);
  if (!recurring) return false;
  const hasMeeting = /周会|例会|站会|会议/.test(text);
  const hasAction = hasActionIntent(text);
  return hasMeeting && !hasAction;
}

function parseTimeFromText(text: string): { startAt: string; endAt: string } | null {
  const now = new Date();
  let targetDate = new Date(now);

  if (/明天/.test(text)) targetDate.setDate(targetDate.getDate() + 1);
  else if (/后天/.test(text)) targetDate.setDate(targetDate.getDate() + 2);
  else if (/下周/.test(text)) targetDate.setDate(targetDate.getDate() + 7);
  else if (/周三/.test(text)) {
    const diff = (3 - now.getDay() + 7) % 7 || 7;
    targetDate.setDate(targetDate.getDate() + diff);
  } else if (/下周二/.test(text)) {
    const diff = (2 - now.getDay() + 7) % 7 || 7;
    targetDate.setDate(targetDate.getDate() + diff);
  }

  let hour = 10;
  let minute = 0;
  let durationMin = 60;

  const pmMatch = text.match(/下午(\d+)点/);
  const amMatch = text.match(/上午(\d+)点/);
  const timeMatch = text.match(/(\d+)[:：](\d+)/);

  if (pmMatch) {
    hour = Number(pmMatch[1]) + (Number(pmMatch[1]) < 12 ? 12 : 0);
  } else if (amMatch) {
    hour = Number(amMatch[1]);
  } else if (timeMatch) {
    hour = Number(timeMatch[1]);
    minute = Number(timeMatch[2]);
  } else if (/下午3点/.test(text)) {
    hour = 15;
  } else if (/上午10点/.test(text)) {
    hour = 10;
  }

  if (/站会|晨会/.test(text)) durationMin = 30;
  if (/面试/.test(text)) durationMin = 60;
  if (/出差/.test(text)) durationMin = 480;

  targetDate.setHours(hour, minute, 0, 0);
  const startAt = targetDate.toISOString();
  const endDate = new Date(targetDate.getTime() + durationMin * 60 * 1000);
  return { startAt, endAt: endDate.toISOString() };
}

function parseRecurringTime(text: string): string {
  const match = text.match(/(\d+)点/);
  if (match) {
    const h = Number(match[1]);
    const hour = /下午/.test(text) && h < 12 ? h + 12 : h;
    return `${String(hour).padStart(2, '0')}:00`;
  }
  if (/下午5点|17点/.test(text)) return '17:00';
  return '17:00';
}

function buildSlots(
  type: PersonalIntentType,
  text: string,
  context: IntentRouteContext,
): IntentSlot {
  const slots: IntentSlot = {};

  if (context.modifyTodoId) {
    slots.modifyTodoId = context.modifyTodoId;
    return slots;
  }

  if (type === 'schedule' || type === 'recurring_schedule') {
    const time = parseTimeFromText(text);
    if (time) {
      slots.startAt = time.startAt;
      slots.endAt = time.endAt;
    }
    if (type === 'recurring_schedule') {
      slots.frequency = hasRecurringIntent(text) ?? undefined;
    }
    return slots;
  }

  if (type === 'recurring') {
    const freq = hasRecurringIntent(text)!;
    slots.frequency = freq;
    slots.timeOfDay = parseRecurringTime(text);
    if (freq === 'weekly') slots.dayOfWeek = 4;
    if (freq === 'monthly') slots.dayOfMonth = 15;
    return slots;
  }

  if (type === 'todo') {
    const time = parseTimeFromText(text);
    if (time) slots.dueAt = time.startAt;
    return slots;
  }

  return slots;
}

function buildReason(type: PersonalIntentType): string {
  switch (type) {
    case 'revise_ai':
      return '修改模式：更新 AI 结果';
    case 'recurring_schedule':
      return '重复周期纯会议，写入日程不建待办';
    case 'recurring':
      return '重复执行动作，创建定时任务';
    case 'schedule':
      return '日历占用类关键词，写入日程';
    case 'todo':
      return '需执行动作类关键词，创建待办';
    case 'unknown':
      return '未识别可执行意图';
    default:
      return '';
  }
}

/**
 * 规则型意图路由器（F0 契约实现，不直接写 DB）
 */
export class RuleBasedIntentRouter implements IntentRouter {
  route(message: string, context: IntentRouteContext): IntentRouteResult {
    const text = message.trim();

    if (context.modifyTodoId) {
      return {
        type: 'revise_ai',
        confidence: 'high',
        slots: buildSlots('revise_ai', text, context),
        reason: buildReason('revise_ai'),
      };
    }

    const recurringFreq = hasRecurringIntent(text);

    if (recurringFreq) {
      if (isPureMeeting(text)) {
        return {
          type: 'recurring_schedule',
          confidence: 'high',
          slots: buildSlots('recurring_schedule', text, context),
          reason: buildReason('recurring_schedule'),
        };
      }
      return {
        type: 'recurring',
        confidence: 'high',
        slots: buildSlots('recurring', text, context),
        reason: buildReason('recurring'),
      };
    }

    const actionFirst = hasActionIntent(text) && hasScheduleIntent(text);
    if (actionFirst || (hasActionIntent(text) && !hasScheduleIntent(text))) {
      return {
        type: 'todo',
        confidence: 'high',
        slots: buildSlots('todo', text, context),
        reason: buildReason('todo'),
      };
    }

    if (hasScheduleIntent(text)) {
      return {
        type: 'schedule',
        confidence: 'high',
        slots: buildSlots('schedule', text, context),
        reason: buildReason('schedule'),
      };
    }

    if (/提醒|待办|完成|整理|提交/.test(text)) {
      return {
        type: 'todo',
        confidence: 'medium',
        slots: buildSlots('todo', text, context),
        reason: '兜底待办关键词',
      };
    }

    return {
      type: 'unknown',
      confidence: 'low',
      slots: {},
      reason: buildReason('unknown'),
    };
  }
}

export const ruleBasedIntentRouter = new RuleBasedIntentRouter();
