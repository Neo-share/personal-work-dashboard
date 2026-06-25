import { describe, expect, it } from 'vitest';
import { getDb } from '../db/index.js';
import { seedDatabase } from '../db/seed.js';
import {
  appendAssistantMessage,
  getOrCreateTodoSession,
  getTodoAssistantThread,
  getTodoThreadMessages,
  listTodoAiThreads,
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

describe('assistant-session-service 历史对话（L1-06）', () => {
  // L1-06 06.12：左栏线程摘要
  it('06.12 listTodoAiThreads 返回标题、最新版本与对话条数', () => {
    seedDatabase(getDb());

    const threads = listTodoAiThreads();
    const minutes = threads.find((t) => t.title === '做会议纪要');

    expect(minutes).toBeDefined();
    expect(minutes!.latestVersion).toBe(2);
    expect(minutes!.messageCount).toBeGreaterThanOrEqual(0);
    expect(minutes!.latestHtmlPreview).toContain('会议纪要 v2');
  });

  // L1-06 06.09：修订消息写入线程并关联 ai_result_id
  it('06.09 appendAssistantMessage 关联 ai_result_id 后可从线程读出', () => {
    seedDatabase(getDb());

    const session = getOrCreateTodoSession(1, '做会议纪要');
    const db = getDb();
    const resultRow = db
      .prepare(
        `SELECT id FROM todo_ai_results WHERE todo_id = 1 ORDER BY version DESC LIMIT 1`,
      )
      .get() as { id: number };

    appendAssistantMessage(session.id, 'user', '请把进度改成 90%');
    appendAssistantMessage(session.id, 'assistant', '已按意见更新结果', resultRow.id);

    const msgs = getTodoThreadMessages(1);

    expect(msgs.some((m) => m.content === '请把进度改成 90%')).toBe(true);
    expect(msgs.some((m) => m.aiResultId === resultRow.id)).toBe(true);

    const thread = getTodoAssistantThread(1);
    expect(thread.latestVersion).toBe(2);
  });
});
