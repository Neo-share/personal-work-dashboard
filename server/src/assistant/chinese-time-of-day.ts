/** 中文小写数字 → 整数（一～十二） */
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
  if (/^\d+$/.test(token)) {
    const n = Number(token);
    return n >= 0 && n <= 23 ? n : null;
  }
  return CN_HOUR_MAP[token] ?? null;
}

function parseMinuteToken(token: string): number | null {
  if (/^\d+$/.test(token)) {
    const n = Number(token);
    return n >= 0 && n <= 59 ? n : null;
  }
  return null;
}

function formatTimeOfDay(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function applyMeridiem(hour: number, text: string): number {
  if (/下午|傍晚|晚上/.test(text) && hour < 12) return hour + 12;
  if (/上午|早上|早晨|清晨/.test(text) && hour === 12) return 0;
  return hour;
}

/**
 * 从中文自然语言解析 HH:mm（定时任务 timeOfDay）。
 * 支持：早上8点15、下午5：30、8:15、8点15分 等。
 */
export function parseTimeOfDayFromChinese(text: string): string | null {
  const normalized = text.replace(/：/g, ':');

  const colonMatch = normalized.match(/(?:^|[^\d])(\d{1,2}):(\d{2})(?:[^\d]|$)/);
  if (colonMatch) {
    const hour = applyMeridiem(Number(colonMatch[1]), text);
    const minute = Number(colonMatch[2]);
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return formatTimeOfDay(hour, minute);
    }
  }

  const meridiemPointMin = normalized.match(
    /(?:上午|早上|早晨|清晨|下午|傍晚|晚上)([一二三四五六七八九十]+|\d{1,2})点(\d{1,2})(?:分)?/,
  );
  if (meridiemPointMin) {
    const h = parseHourToken(meridiemPointMin[1]!);
    const m = parseMinuteToken(meridiemPointMin[2]!);
    if (h !== null && m !== null) {
      return formatTimeOfDay(applyMeridiem(h, text), m);
    }
  }

  const meridiemPointOnly = normalized.match(
    /(?:上午|早上|早晨|清晨|下午|傍晚|晚上)([一二三四五六七八九十]+|\d{1,2})点(?!\d)/,
  );
  if (meridiemPointOnly) {
    const h = parseHourToken(meridiemPointOnly[1]!);
    if (h !== null) {
      return formatTimeOfDay(applyMeridiem(h, text), 0);
    }
  }

  const pointMinMatch = normalized.match(/(\d{1,2})点(\d{1,2})(?:分)?/);
  if (pointMinMatch) {
    const h = parseHourToken(pointMinMatch[1]!);
    const m = parseMinuteToken(pointMinMatch[2]!);
    if (h !== null && m !== null) {
      return formatTimeOfDay(applyMeridiem(h, text), m);
    }
  }

  const pointOnlyMatch = normalized.match(/(\d{1,2})点(?!\d)/);
  if (pointOnlyMatch) {
    const h = parseHourToken(pointOnlyMatch[1]!);
    if (h !== null) {
      return formatTimeOfDay(applyMeridiem(h, text), 0);
    }
  }

  const cnPointOnly = normalized.match(/([一二三四五六七八九十]+)点(?!\d)/);
  if (cnPointOnly) {
    const h = parseHourToken(cnPointOnly[1]!);
    if (h !== null) {
      return formatTimeOfDay(applyMeridiem(h, text), 0);
    }
  }

  return null;
}

/** LLM 返回整点但原文含明确分钟时，优先采用本地解析 */
export function mergeRecurringTimeOfDay(message: string, llmTime?: string): string | null {
  const local = parseTimeOfDayFromChinese(message);
  if (!llmTime) return local;
  if (!local) return llmTime;

  const [, llmMinute = '00'] = llmTime.split(':');
  const [, localMinute = '00'] = local.split(':');

  if (localMinute !== '00' && llmMinute === '00') {
    return local;
  }

  return llmTime;
}
