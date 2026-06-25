import { describe, expect, it } from 'vitest';
import { getDb } from '../db/index.js';
import { seedDatabase } from '../db/seed.js';
import {
  appendAssistantMessage,
  getOrCreateTodoSession,
  getTodoAssistantThread,
  getTodoThreadMessages,
} from './assistant-session-service.js';

/**
 * 回归：切换待办「修改结果」时个人助手会话须按 todoId 隔离（不串线）
 */
describe('assistant-session-service 待办修改线程', () => {
  it('不同待办绑定独立会话，线程消息互不串线', () => {
    seedDatabase(getDb());

    const sessionMinutes = getOrCreateTodoSession(1);
    const sessionPick = getOrCreateTodoSession(3);

    expect(sessionMinutes.id).not.toBe(sessionPick.id);
    expect(sessionMinutes.todoId).toBe(1);
    expect(sessionPick.todoId).toBe(3);

    appendAssistantMessage(sessionMinutes.id, 'user', '纪要待办：强调排期风险');
    appendAssistantMessage(sessionPick.id, 'user', '选品待办：增加货币基金对比');

    const threadMinutes = getTodoAssistantThread(1);
    const threadPick = getTodoAssistantThread(3);

    expect(threadMinutes.sessionId).toBe(sessionMinutes.id);
    expect(threadPick.sessionId).toBe(sessionPick.id);
    expect(threadMinutes.latestVersion).toBe(2);
    expect(threadPick.latestVersion).toBe(1);

    const minutesTexts = threadMinutes.messages.map((m) => m.content).join('\n');
    const pickTexts = threadPick.messages.map((m) => m.content).join('\n');

    expect(minutesTexts).toContain('排期风险');
    expect(minutesTexts).not.toContain('货币基金');
    expect(pickTexts).toContain('货币基金');
    expect(pickTexts).not.toContain('排期风险');
  });

  it('getOrCreateTodoSession 复用已有待办会话', () => {
    seedDatabase(getDb());

    const first = getOrCreateTodoSession(1);
    const second = getOrCreateTodoSession(1);

    expect(second.id).toBe(first.id);
  });

  it('getTodoThreadMessages 仅返回当前待办相关消息', () => {
    seedDatabase(getDb());

    const session1 = getOrCreateTodoSession(1);
    const session3 = getOrCreateTodoSession(3);
    appendAssistantMessage(session1.id, 'user', '仅纪要线程');
    appendAssistantMessage(session3.id, 'user', '仅选品线程');

    const msgs1 = getTodoThreadMessages(1);
    const msgs3 = getTodoThreadMessages(3);

    expect(msgs1.every((m) => m.content !== '仅选品线程')).toBe(true);
    expect(msgs3.every((m) => m.content !== '仅纪要线程')).toBe(true);
  });
});
