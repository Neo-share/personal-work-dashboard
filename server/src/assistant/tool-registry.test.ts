import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { PERSONAL_INTENT_TOOL_MAP } from '@project-manager/shared';
import { InMemoryMetricsLedger } from './metrics-ledger.js';
import {
  PersonalToolRegistry,
  ToolNotRegisteredError,
  ToolParamsValidationError,
} from './tool-registry.js';

describe('PersonalToolRegistry（契约 §3.2）', () => {
  it('注册后可 invoke 并记录 metrics', async () => {
    const registry = new PersonalToolRegistry();
    const metrics = new InMemoryMetricsLedger();

    registry.register({
      name: 'todo.create',
      description: '创建待办',
      paramsSchema: z.object({ title: z.string() }),
      execute: async (params) => ({ refresh: ['todos'], title: params.title }),
    });

    expect(registry.listTools()).toEqual(['todo.create']);

    const result = await registry.invoke(
      'todo.create',
      { title: '测试待办' },
      { sessionId: 1, metrics },
    );

    expect(result.tool).toBe('todo.create');
    expect(result.refresh).toContain('todos');

    const events = metrics.queryRecent({ name: 'pw.tool.invoked', limit: 1 });
    expect(events).toHaveLength(1);
    expect(events[0]?.tags?.tool).toBe('todo.create');
  });

  it('未注册工具抛出 ToolNotRegisteredError', async () => {
    const registry = new PersonalToolRegistry();
    const metrics = new InMemoryMetricsLedger();

    await expect(
      registry.invoke('schedule.create_local', {}, { sessionId: 1, metrics }),
    ).rejects.toBeInstanceOf(ToolNotRegisteredError);
  });

  it('参数 Zod 校验失败抛出 ToolParamsValidationError', async () => {
    const registry = new PersonalToolRegistry();
    const metrics = new InMemoryMetricsLedger();

    registry.register({
      name: 'schedule.create_local',
      description: '创建本地日程',
      paramsSchema: z.object({ title: z.string(), startAt: z.string(), endAt: z.string() }),
      execute: async () => ({}),
    });

    await expect(
      registry.invoke('schedule.create_local', { title: '会议' }, { sessionId: 1, metrics }),
    ).rejects.toBeInstanceOf(ToolParamsValidationError);
  });

  it('重复注册同名工具失败', () => {
    const registry = new PersonalToolRegistry();
    const def = {
      name: 'todo.create' as const,
      description: 'x',
      paramsSchema: z.object({}),
      execute: async () => ({}),
    };
    registry.register(def);
    expect(() => registry.register(def)).toThrow(/已注册/);
  });
});

describe('PERSONAL_INTENT_TOOL_MAP（F0 冻结）', () => {
  it('各意图映射的工具名非空且符合 PersonalToolName 格式', () => {
    for (const [intent, tools] of Object.entries(PERSONAL_INTENT_TOOL_MAP)) {
      expect(tools.length).toBeGreaterThan(0);
      for (const tool of tools) {
        expect(tool).toMatch(/^[a-z_]+\.[a-z_]+$/);
      }
      expect(intent).not.toBe('unknown');
    }
  });
});
