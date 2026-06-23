import { describe, expect, it } from 'vitest';
import { getDb } from '../db/index.js';
import { seedDatabase } from '../db/seed.js';
import {
  appendAssistantMessage,
  createAssistantSession,
} from '../services/assistant-session-service.js';
import { dbContextRetriever } from './context-retriever.js';

describe('DbContextRetriever', () => {
  it('组装 recentMessages、activeTodo 与 todayScheduleCount', async () => {
    seedDatabase(getDb());

    const session = createAssistantSession('测试会话');
    appendAssistantMessage(session.id, 'user', '第一条');
    appendAssistantMessage(session.id, 'assistant', '第二条');

    const result = await dbContextRetriever.retrieve(session.id, { modifyTodoId: 1 });

    expect(result.sessionId).toBe(session.id);
    expect(result.recentMessages.length).toBeGreaterThanOrEqual(2);
    expect(result.recentMessages.at(-1)?.content).toBe('第二条');
    expect(result.activeTodo?.id).toBe(1);
    expect(result.activeTodo?.title).toBe('做会议纪要');
    expect(result.todayScheduleCount).toBeGreaterThan(0);
    expect(result.soulSettings).toBeDefined();
  });

  it('无 modifyTodoId 时不返回 activeTodo', async () => {
    seedDatabase(getDb());
    const session = createAssistantSession('空上下文');

    const result = await dbContextRetriever.retrieve(session.id);

    expect(result.activeTodo).toBeUndefined();
    expect(result.todayScheduleCount).toBeGreaterThanOrEqual(0);
  });
});
