import { initTRPC } from '@trpc/server';
import { z } from 'zod';
import {
  appendAssistantMessage,
  createAssistantSession,
  getAssistantMessages,
  getTodoAssistantThread,
  listAssistantSessions,
  listTodoAiThreads,
} from '../services/assistant-session-service.js';
import { reviseAiResult } from '../services/ai-result-service.js';
import {
  getPersonalAssistantSoulSettings,
  setPersonalAssistantSoulSettings,
} from '../services/personal-assistant-soul-service.js';
import { resolvePersonalAssistantIntent } from '../services/personal-assistant-service.js';
import { summarizeLlmMetrics } from '../assistant/metrics-summary.js';
import {
  createRecurringTask,
  deleteRecurringTask,
  listRecurringTasks,
  materializeRecurringTask,
  toggleRecurringTask,
  updateRecurringTask,
} from '../services/recurring-task-service.js';
import {
  createLocalSchedule,
  deleteScheduleEvent,
  getScheduleEventById,
  listCalendarSources,
  listDaySchedule,
  setCalendarSourceEnabled,
} from '../services/schedule-service.js';
import {
  cancelTodo,
  completeTodo,
  confirmAiResult,
  createTodo,
  deleteTodo,
  getPersonalWorkbenchSummary,
  getTodoAiResults,
  getTodoById,
  listTodos,
  restoreTodo,
  updateTodo,
} from '../services/todo-service.js';
import type { TrpcContext } from './context.js';

const t = initTRPC.context<TrpcContext>().create();

export const appRouter = t.router({
  personalWorkbench: t.router({
    summary: t.procedure
      .input(z.object({ date: z.string().optional() }).optional())
      .query(({ input }) => getPersonalWorkbenchSummary(input?.date)),
    getSoulSettings: t.procedure.query(() => getPersonalAssistantSoulSettings()),
    setSoulSettings: t.procedure
      .input(
        z.object({
          tone: z.enum(['formal', 'concise', 'friendly']),
          customInstructions: z.string(),
        }),
      )
      .mutation(({ input }) => setPersonalAssistantSoulSettings(input)),
  }),

  todos: t.router({
    list: t.procedure
      .input(
        z
          .object({
            filter: z.enum(['active', 'all', 'completed', 'overdue']).optional(),
          })
          .optional(),
      )
      .query(({ input }) => listTodos(input?.filter ?? 'active')),
    detail: t.procedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getTodoById(input.id)),
    create: t.procedure
      .input(
        z.object({
          title: z.string().min(1),
          description: z.string().optional(),
          dueAt: z.string().optional(),
          isUrgent: z.boolean().optional(),
        }),
      )
      .mutation(({ input }) => createTodo({ ...input, source: 'manual' })),
    update: t.procedure
      .input(
        z.object({
          id: z.number(),
          title: z.string().optional(),
          description: z.string().nullable().optional(),
          dueAt: z.string().nullable().optional(),
          isUrgent: z.boolean().optional(),
        }),
      )
      .mutation(({ input }) => {
        const { id, ...fields } = input;
        return updateTodo(id, fields);
      }),
    complete: t.procedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => completeTodo(input.id)),
    restore: t.procedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => restoreTodo(input.id)),
    cancel: t.procedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => cancelTodo(input.id)),
    delete: t.procedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => {
        const ok = deleteTodo(input.id);
        return { ok };
      }),
    aiResults: t.procedure
      .input(z.object({ todoId: z.number() }))
      .query(({ input }) => getTodoAiResults(input.todoId)),
    confirmAiResult: t.procedure
      .input(z.object({ todoId: z.number(), resultId: z.number() }))
      .mutation(({ input }) => confirmAiResult(input.todoId, input.resultId)),
    reviseAiResult: t.procedure
      .input(
        z.object({
          todoId: z.number(),
          revisionHint: z.string().min(1),
          sessionId: z.number().optional(),
          skipReviseCache: z.boolean().optional(),
        }),
      )
      .mutation(async ({ input }) => {
        const todo = getTodoById(input.todoId);
        if (!todo?.aiResultType) {
          throw new Error('待办无可修改的 AI 结果');
        }
        return reviseAiResult(
          input.todoId,
          todo.aiResultType,
          todo.title,
          input.revisionHint,
          undefined,
          {
            sessionId: input.sessionId,
            skipReviseCache: input.skipReviseCache,
          },
        );
      }),
  }),

  schedule: t.router({
    listDay: t.procedure
      .input(z.object({ date: z.string() }))
      .query(({ input }) => listDaySchedule(input.date)),
    detail: t.procedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getScheduleEventById(input.id)),
    createLocal: t.procedure
      .input(
        z.object({
          title: z.string().min(1),
          startAt: z.string(),
          endAt: z.string(),
        }),
      )
      .mutation(({ input }) => createLocalSchedule(input)),
    delete: t.procedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => {
        const ok = deleteScheduleEvent(input.id);
        return { ok };
      }),
    sources: t.procedure.query(() => listCalendarSources()),
    setSourceEnabled: t.procedure
      .input(z.object({ source: z.enum(['feishu', 'dingtalk', 'outlook', 'local']), enabled: z.boolean() }))
      .mutation(({ input }) => setCalendarSourceEnabled(input.source, input.enabled)),
  }),

  recurringTasks: t.router({
    list: t.procedure.query(() => listRecurringTasks()),
    create: t.procedure
      .input(
        z.object({
          title: z.string().min(1),
          frequency: z.enum(['daily', 'weekly', 'monthly']),
          dayOfWeek: z.number().optional(),
          dayOfMonth: z.number().optional(),
          timeOfDay: z.string(),
        }),
      )
      .mutation(({ input }) => createRecurringTask(input)),
    update: t.procedure
      .input(
        z.object({
          id: z.number(),
          title: z.string().optional(),
          frequency: z.enum(['daily', 'weekly', 'monthly']).optional(),
          dayOfWeek: z.number().nullable().optional(),
          dayOfMonth: z.number().nullable().optional(),
          timeOfDay: z.string().optional(),
        }),
      )
      .mutation(({ input }) => {
        const { id, ...fields } = input;
        return updateRecurringTask(id, fields);
      }),
    toggle: t.procedure
      .input(z.object({ id: z.number(), enabled: z.boolean() }))
      .mutation(({ input }) => toggleRecurringTask(input.id, input.enabled)),
    delete: t.procedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => {
        const ok = deleteRecurringTask(input.id);
        return { ok };
      }),
    materializeNow: t.procedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => materializeRecurringTask(input.id)),
  }),

  assistant: t.router({
    sessions: t.procedure.query(() => listAssistantSessions()),
    todoThreads: t.procedure.query(() => listTodoAiThreads()),
    todoThread: t.procedure
      .input(z.object({ todoId: z.number() }))
      .query(({ input }) => getTodoAssistantThread(input.todoId)),
    messages: t.procedure
      .input(z.object({ sessionId: z.number() }))
      .query(({ input }) => getAssistantMessages(input.sessionId)),
    createSession: t.procedure
      .input(z.object({ title: z.string(), todoId: z.number().optional() }))
      .mutation(({ input }) => createAssistantSession(input.title, input.todoId)),
    appendMessage: t.procedure
      .input(
        z.object({
          sessionId: z.number(),
          role: z.enum(['user', 'assistant']),
          content: z.string(),
          aiResultId: z.number().optional(),
        }),
      )
      .mutation(({ input }) =>
        appendAssistantMessage(input.sessionId, input.role, input.content, input.aiResultId),
      ),
    resolveIntent: t.procedure
      .input(
        z.object({
          message: z.string(),
          modifyTodoId: z.number().optional(),
          sessionId: z.number().optional(),
          skipReviseCache: z.boolean().optional(),
        }),
      )
      .mutation(async ({ input }) => resolvePersonalAssistantIntent(input.message, input)),
    metricsSummary: t.procedure.query(() => summarizeLlmMetrics()),
  }),
});

export type AppRouter = typeof appRouter;
