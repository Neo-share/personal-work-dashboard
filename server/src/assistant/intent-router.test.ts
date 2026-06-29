import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PERSONAL_INTENT_TOOL_MAP } from '@project-manager/shared';
import {
  GOLDEN_PHRASES,
  GOLDEN_ROUTE_CONTEXT,
} from './fixtures/golden-phrases.js';
import { ruleBasedIntentRouter } from './intent-router.js';

describe('RuleBasedIntentRouter 黄金话术（契约 §3.1）', () => {
  for (const [index, caseDef] of GOLDEN_PHRASES.entries()) {
    it(`#${index + 1} ${caseDef.input} → ${caseDef.intent}`, () => {
      const route = ruleBasedIntentRouter.route(caseDef.input, GOLDEN_ROUTE_CONTEXT);

      expect(route.type).toBe(caseDef.intent);
      expect(route.reason.length).toBeGreaterThan(0);

      if (caseDef.intent === 'unknown') {
        expect(route.confidence).toBe('low');
        return;
      }

      expect(['high', 'medium']).toContain(route.confidence);

      if (caseDef.intent === 'schedule' || caseDef.intent === 'recurring_schedule') {
        expect(route.slots.startAt).toBeTruthy();
        expect(route.slots.endAt).toBeTruthy();
      }
      if (caseDef.intent === 'recurring') {
        expect(route.slots.frequency).toBeTruthy();
        expect(route.slots.timeOfDay).toBeTruthy();
      }

      const tools = PERSONAL_INTENT_TOOL_MAP[caseDef.intent];
      expect(tools.length).toBeGreaterThan(0);
    });
  }
});

describe('RuleBasedIntentRouter 修改模式', () => {
  it('modifyTodoId 存在时返回 revise_ai', () => {
    const route = ruleBasedIntentRouter.route('改短一点', {
      sessionId: 1,
      modifyTodoId: 42,
    });
    expect(route.type).toBe('revise_ai');
    expect(route.slots.modifyTodoId).toBe(42);
  });

  it('路由阶段不设置标题（由编排层 LLM 提取）', () => {
    const route = ruleBasedIntentRouter.route('本周五提醒我完成UI改版方案', GOLDEN_ROUTE_CONTEXT);
    expect(route.type).toBe('todo');
    expect(route.slots.title).toBeUndefined();
  });
});

describe('RuleBasedIntentRouter 星期解析', () => {
  // 2026-06-29 为周一，本地 15:00（东八区）
  const mondayAfternoon = new Date('2026-06-29T07:00:00.000Z');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(mondayAfternoon);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('本周二待办截止应落在周二而非当天', () => {
    const route = ruleBasedIntentRouter.route('本周二提醒我完成UI改版方案', GOLDEN_ROUTE_CONTEXT);

    expect(route.type).toBe('todo');
    expect(route.slots.dueAt).toBe('2026-06-30T02:00:00.000Z');
  });

  it('本周五待办截止应落在本周五', () => {
    const route = ruleBasedIntentRouter.route('本周五提醒我完成UI改版方案', GOLDEN_ROUTE_CONTEXT);

    expect(route.slots.dueAt).toBe('2026-07-03T02:00:00.000Z');
  });

  it('下周二待办截止应落在下一自然周周二', () => {
    const route = ruleBasedIntentRouter.route('提醒我下周二完成协议合规审核', GOLDEN_ROUTE_CONTEXT);

    expect(route.slots.dueAt).toBe('2026-07-07T02:00:00.000Z');
  });

  it('每周五定时任务应解析为周五而非默认周四', () => {
    const route = ruleBasedIntentRouter.route('每周五下午五点完成周报', GOLDEN_ROUTE_CONTEXT);

    expect(route.type).toBe('recurring');
    expect(route.slots.frequency).toBe('weekly');
    expect(route.slots.dayOfWeek).toBe(5);
    expect(route.slots.timeOfDay).toBe('17:00');
  });
});
