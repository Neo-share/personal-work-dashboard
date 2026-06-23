import type { AssistantContext, ContextRetriever } from '@project-manager/shared';
import { getAssistantMessages } from '../services/assistant-session-service.js';
import { getPersonalAssistantSoulSettings } from '../services/personal-assistant-soul-service.js';
import { getTodoById } from '../services/todo-service.js';
import { listDaySchedule } from '../services/schedule-service.js';

/**
 * 组装 DB 内会话、待办与当日日程统计（F0 契约第一版）
 */
export class DbContextRetriever implements ContextRetriever {
  async retrieve(sessionId: number, options?: { modifyTodoId?: number }): Promise<AssistantContext> {
    const recentMessages = getAssistantMessages(sessionId).slice(-20);
    const activeTodo = options?.modifyTodoId
      ? getTodoById(options.modifyTodoId) ?? undefined
      : undefined;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daySchedule = listDaySchedule(today.toISOString());

    return {
      sessionId,
      recentMessages,
      activeTodo,
      todayScheduleCount: daySchedule.events.length,
      soulSettings: getPersonalAssistantSoulSettings(),
    };
  }
}

export const dbContextRetriever = new DbContextRetriever();
