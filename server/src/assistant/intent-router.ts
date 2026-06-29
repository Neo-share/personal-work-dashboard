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

/** 中文星期 → JS getDay()（0=周日 … 6=周六） */
const WEEKDAY_MAP: Record<string, number> = {
  日: 0,
  天: 0,
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
};

/**
 * 解析「本周二 / 下周三 / 周五」等表达，返回相对 today 的天数偏移。
 * weeksAhead=0 表示本自然周，1 表示下一自然周（周一为周首）。
 */
function resolveWeekdayOffset(text: string, now: Date): number | null {
  const nextWeekMatch = text.match(/下(?:个)?(?:星期|周)([一二三四五六日天])/);
  if (nextWeekMatch) {
    const targetDay = WEEKDAY_MAP[nextWeekMatch[1]!];
    if (targetDay === undefined) return null;
    return daysToWeekday(now, targetDay, 1);
  }

  const thisWeekMatch = text.match(/本(?:星期|周)([一二三四五六日天])/);
  if (thisWeekMatch) {
    const targetDay = WEEKDAY_MAP[thisWeekMatch[1]!];
    if (targetDay === undefined) return null;
    const offset = daysToWeekday(now, targetDay, 0);
    // 本自然周该日已过则落到下一周同一天（与交付原型一致）
    if (offset < 0) return offset + 7;
    return offset;
  }

  // 周X / 星期X（排除「每周」「下周」「本周」前缀）
  const bareMatch = text.match(/(?<![每下本])(?:星期|周)([一二三四五六日天])/);
  if (bareMatch) {
    const targetDay = WEEKDAY_MAP[bareMatch[1]!];
    if (targetDay === undefined) return null;
    const offset = daysToWeekday(now, targetDay, 0);
    return offset <= 0 ? offset + 7 : offset;
  }

  return null;
}

/** 距本自然周（周一为周首）内目标星期几的天数；weeksAhead 追加整周 */
function daysToWeekday(now: Date, targetDay: number, weeksAhead: number): number {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const dayOfWeek = now.getDay();
  // 距本周一的天数（周一=0 … 周日=6）
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(today);
  monday.setDate(today.getDate() - daysSinceMonday);
  const mondayOffset = targetDay === 0 ? 6 : targetDay - 1;
  const target = new Date(monday);
  target.setDate(monday.getDate() + mondayOffset + weeksAhead * 7);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function parseTimeFromText(text: string): { startAt: string; endAt: string } | null {
  const now = new Date();
  let targetDate = new Date(now);

  if (/明天/.test(text)) targetDate.setDate(targetDate.getDate() + 1);
  else if (/后天/.test(text)) targetDate.setDate(targetDate.getDate() + 2);
  else {
    const weekdayOffset = resolveWeekdayOffset(text, now);
    if (weekdayOffset !== null) {
      targetDate.setDate(targetDate.getDate() + weekdayOffset);
    } else if (/下(?:个)?(?:星期|周)(?![一二三四五六日天])/.test(text)) {
      // 「下周」无具体星期：默认 +7 天
      targetDate.setDate(targetDate.getDate() + 7);
    }
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

function parseRecurringDayOfWeek(text: string): number | null {
  const match = text.match(/每(?:个)?(?:星期|周)([一二三四五六日天])/);
  if (!match) return null;
  const day = WEEKDAY_MAP[match[1]!];
  return day === undefined ? null : day;
}

function parseRecurringDayOfMonth(text: string): number | null {
  const match = text.match(/每月(\d{1,2})[号日]/);
  if (!match) return null;
  const day = Number(match[1]);
  return day >= 1 && day <= 31 ? day : null;
}

/** 中文小写数字 → 整数（支持一～十二，供「下午五点」等解析） */
const CN_HOUR_MAP: Record<string, number> = {
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
  十一: 11,
  十二: 12,
};

function parseHourToken(token: string): number | null {
  if (/^\d+$/.test(token)) return Number(token);
  return CN_HOUR_MAP[token] ?? null;
}

function parseRecurringTime(text: string): string {
  const pmCnMatch = text.match(/下午([一二三四五六七八九十]+|\d+)点/);
  if (pmCnMatch) {
    const h = parseHourToken(pmCnMatch[1]!);
    if (h !== null) {
      const hour = h < 12 ? h + 12 : h;
      return `${String(hour).padStart(2, '0')}:00`;
    }
  }

  const amCnMatch = text.match(/上午([一二三四五六七八九十]+|\d+)点/);
  if (amCnMatch) {
    const h = parseHourToken(amCnMatch[1]!);
    if (h !== null) return `${String(h).padStart(2, '0')}:00`;
  }

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
    if (freq === 'weekly') {
      slots.dayOfWeek = parseRecurringDayOfWeek(text) ?? 4;
    }
    if (freq === 'monthly') {
      slots.dayOfMonth = parseRecurringDayOfMonth(text) ?? 15;
    }
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
