import { describe, expect, it } from 'vitest';
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
