import { describe, expect, it } from 'vitest';
import { mergeRecurringTimeOfDay, parseTimeOfDayFromChinese } from './chinese-time-of-day.js';

describe('parseTimeOfDayFromChinese', () => {
  it('解析早上8点15', () => {
    expect(parseTimeOfDayFromChinese('每天早上8点15提醒我打卡')).toBe('08:15');
  });

  it('解析下午5：30', () => {
    expect(parseTimeOfDayFromChinese('每天下午5：30提醒我打卡')).toBe('17:30');
  });

  it('解析每周五下午五点（整点）', () => {
    expect(parseTimeOfDayFromChinese('每周五下午五点完成周报')).toBe('17:00');
  });

  it('解析 8:15 带上午', () => {
    expect(parseTimeOfDayFromChinese('上午8:15开会')).toBe('08:15');
  });
});

describe('mergeRecurringTimeOfDay', () => {
  it('LLM 返回整点时采用本地分钟', () => {
    expect(mergeRecurringTimeOfDay('每天早上8点15提醒我打卡', '08:00')).toBe('08:15');
  });

  it('LLM 已含分钟则保留', () => {
    expect(mergeRecurringTimeOfDay('每天早上8点15提醒我打卡', '08:15')).toBe('08:15');
  });
});
