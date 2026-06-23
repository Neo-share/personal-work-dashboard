import { initTRPC } from '@trpc/server';
import { z } from 'zod';
import { getWorkspacePath, getIgnoreDirs, setIgnoreDirs, setWorkspacePath } from '../db/index.js';
import {
  addLink,
  addMilestone,
  addRequirementPerson,
  addRequirementRepository,
  getRepositoryRequirements,
  removeLink,
  removeMilestone,
  removeRequirementPerson,
  removeRequirementRepository,
  touchRequirement,
  updateMilestone,
} from '../services/association-service.js';
import { getRequirementGraph } from '../services/graph-service.js';
import { openRepositoryInCursor } from '../services/cursor-service.js';
import { createPerson, deletePerson, listPeople, updatePerson } from '../services/people-service.js';
import {
  createRequirement,
  deleteRequirement,
  getRequirementDetailLive,
  getWorkbenchSummary,
  listRequirements,
  updateRequirement,
} from '../services/requirement-service.js';
import {
  getLatestScanSnapshot,
  getRepositoryById,
  deleteRepositoryBranch,
  listRepositoriesLive,
  listRepositoryBranches,
  runWorkspaceScan,
  setRepositoryBranchNote,
  syncRepositoryBranches,
} from '../services/repository-service.js';
import { generateWeeklyReport } from '../services/weekly-report-service.js';
import {
  appendAssistantMessage,
  createAssistantSession,
  getAssistantMessages,
  listAssistantSessions,
  listTodoAiThreads,
} from '../services/assistant-session-service.js';
import { reviseAiResult } from '../services/ai-result-service.js';
import {
  getPersonalAssistantSoulSettings,
  setPersonalAssistantSoulSettings,
} from '../services/personal-assistant-soul-service.js';
import { resolvePersonalAssistantIntent } from '../services/personal-assistant-service.js';
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

const requirementStatusSchema = z.enum([
  'pending_review',
  'developing',
  'integrating',
  'testing',
  'pending_release',
  'released',
  'paused',
]);

const workDomainSchema = z.enum(['dev', 'life', 'learning', 'admin', 'other']);

const requirementListFilterSchema = z
  .object({
    status: requirementStatusSchema.optional(),
    domain: workDomainSchema.optional(),
    beforeTesting: z.boolean().optional(),
    personId: z.number().optional(),
    repositoryId: z.number().optional(),
    riskOnly: z.boolean().optional(),
    keyword: z.string().optional(),
    releaseFrom: z.string().optional(),
    releaseTo: z.string().optional(),
  })
  .optional();

export const appRouter = t.router({
  settings: t.router({
    getWorkspacePath: t.procedure.query(() => getWorkspacePath()),
    setWorkspacePath: t.procedure
      .input(z.object({ workspacePath: z.string().min(1) }))
      .mutation(({ input }) => {
        setWorkspacePath(input.workspacePath);
        return { workspacePath: input.workspacePath };
      }),
    getIgnoreDirs: t.procedure.query(() => getIgnoreDirs()),
    setIgnoreDirs: t.procedure
      .input(z.object({ dirs: z.array(z.string()) }))
      .mutation(({ input }) => {
        setIgnoreDirs(input.dirs);
        return { dirs: getIgnoreDirs() };
      }),
  }),

  workbench: t.router({
    summary: t.procedure.query(() => getWorkbenchSummary()),
  }),

  weeklyReport: t.router({
    generate: t.procedure
      .input(
        z
          .object({
            weekStart: z.string().optional(),
            weekEnd: z.string().optional(),
            domain: workDomainSchema.optional(),
          })
          .optional(),
      )
      .query(({ input }) => generateWeeklyReport(input)),
  }),

  requirements: t.router({
    list: t.procedure
      .input(requirementListFilterSchema)
      .query(({ input }) => listRequirements(input)),
    detail: t.procedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getRequirementDetailLive(input.id)),
    create: t.procedure
      .input(
        z.object({
          name: z.string().min(1),
          domain: workDomainSchema.optional(),
          status: requirementStatusSchema,
          priority: z.enum(['high', 'medium', 'low']),
          targetVersion: z.string().optional(),
          plannedReleaseAt: z.string().optional(),
          risk: z.string().optional(),
          notes: z.string().optional(),
        }),
      )
      .mutation(({ input }) => createRequirement(input)),
    update: t.procedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().optional(),
          domain: workDomainSchema.optional(),
          status: z
            .enum([
              'pending_review',
              'developing',
              'integrating',
              'testing',
              'pending_release',
              'released',
              'paused',
            ])
            .optional(),
          priority: z.enum(['high', 'medium', 'low']).optional(),
          targetVersion: z.string().nullable().optional(),
          plannedReleaseAt: z.string().nullable().optional(),
          risk: z.string().nullable().optional(),
          blockers: z.string().nullable().optional(),
          notes: z.string().nullable().optional(),
        }),
      )
      .mutation(({ input }) => updateRequirement(input.id, input)),
    delete: t.procedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => {
        const ok = deleteRequirement(input.id);
        return { ok };
      }),
    addRepository: t.procedure
      .input(
        z.object({
          requirementId: z.number(),
          repositoryId: z.number(),
          responsibility: z.string().optional(),
          branch: z.string().optional(),
          env: z.string().optional(),
          status: z.string().optional(),
          risk: z.string().optional(),
        }),
      )
      .mutation(({ input }) => {
        const result = addRequirementRepository(input);
        touchRequirement(input.requirementId);
        return result;
      }),
    removeRepository: t.procedure
      .input(z.object({ id: z.number(), requirementId: z.number() }))
      .mutation(({ input }) => {
        const ok = removeRequirementRepository(input.id);
        if (!ok) {
          throw new Error('仓库关联不存在或已移除');
        }
        touchRequirement(input.requirementId);
        return { ok: true };
      }),
    addPerson: t.procedure
      .input(
        z.object({
          requirementId: z.number(),
          personId: z.number(),
          managementRole: z.enum([
            'owner',
            'participant',
            'watcher',
            'acceptor',
            'release_coordinator',
          ]),
          direction: z.enum(['upstream', 'downstream']),
          roleType: z.string().min(1),
          responsibility: z.string().optional(),
          status: z
            .enum(['pending', 'in_progress', 'completed', 'blocked'])
            .optional(),
          notes: z.string().optional(),
        }),
      )
      .mutation(({ input }) => {
        const result = addRequirementPerson(input);
        touchRequirement(input.requirementId);
        return result;
      }),
    removePerson: t.procedure
      .input(z.object({ id: z.number(), requirementId: z.number() }))
      .mutation(({ input }) => {
        const ok = removeRequirementPerson(input.id);
        if (!ok) {
          throw new Error('人员关联不存在或已移除');
        }
        touchRequirement(input.requirementId);
        return { ok: true };
      }),
    addMilestone: t.procedure
      .input(
        z.object({
          requirementId: z.number(),
          name: z.string().min(1),
          targetDate: z.string().optional(),
          status: z.enum(['pending', 'in_progress', 'completed', 'blocked']).optional(),
          blockers: z.string().optional(),
        }),
      )
      .mutation(({ input }) => {
        const result = addMilestone(input);
        touchRequirement(input.requirementId);
        return result;
      }),
    removeMilestone: t.procedure
      .input(z.object({ id: z.number(), requirementId: z.number() }))
      .mutation(({ input }) => {
        const ok = removeMilestone(input.id);
        touchRequirement(input.requirementId);
        return { ok };
      }),
    updateMilestone: t.procedure
      .input(
        z.object({
          id: z.number(),
          requirementId: z.number(),
          name: z.string().optional(),
          targetDate: z.string().nullable().optional(),
          status: z.enum(['pending', 'in_progress', 'completed', 'blocked']).optional(),
          blockers: z.string().nullable().optional(),
        }),
      )
      .mutation(({ input }) => {
        const { id, requirementId, ...fields } = input;
        const result = updateMilestone(id, fields);
        touchRequirement(requirementId);
        return result;
      }),
    addLink: t.procedure
      .input(
        z.object({
          requirementId: z.number(),
          type: z.string().min(1),
          title: z.string().min(1),
          url: z.string().url(),
        }),
      )
      .mutation(({ input }) => {
        const result = addLink(input);
        touchRequirement(input.requirementId);
        return result;
      }),
    removeLink: t.procedure
      .input(z.object({ id: z.number(), requirementId: z.number() }))
      .mutation(({ input }) => {
        const ok = removeLink(input.id);
        touchRequirement(input.requirementId);
        return { ok };
      }),
  }),

  graph: t.router({
    get: t.procedure
      .input(z.object({ requirementId: z.number().optional() }).default({}))
      .query(({ input }) => getRequirementGraph(input.requirementId)),
  }),

  repositories: t.router({
    list: t.procedure.query(() => listRepositoriesLive()),
    detail: t.procedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getRepositoryById(input.id)),
    requirements: t.procedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getRepositoryRequirements(input.id)),
    branches: t.procedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => listRepositoryBranches(input.id)),
    setBranchNote: t.procedure
      .input(
        z.object({
          repositoryId: z.number(),
          branch: z.string().min(1),
          notes: z.string(),
        }),
      )
      .mutation(({ input }) =>
        setRepositoryBranchNote(input.repositoryId, input.branch, input.notes),
      ),
    deleteBranch: t.procedure
      .input(
        z.object({
          repositoryId: z.number(),
          branch: z.string().min(1),
        }),
      )
      .mutation(({ input }) => deleteRepositoryBranch(input.repositoryId, input.branch)),
    syncBranches: t.procedure
      .input(
        z.object({
          repositoryId: z.number(),
          branch: z.string().optional(),
        }),
      )
      .mutation(({ input }) => syncRepositoryBranches(input.repositoryId, input.branch)),
    scanWorkspace: t.procedure
      .input(z.object({ workspacePath: z.string().optional() }).optional())
      .mutation(async ({ input }) => {
        const workspacePath = input?.workspacePath ?? getWorkspacePath();
        return runWorkspaceScan(workspacePath);
      }),
    latestScan: t.procedure.query(() => getLatestScanSnapshot()),
    openInCursor: t.procedure
      .input(
        z.object({
          repositoryId: z.number(),
          branch: z.string().nullable().optional(),
          mode: z.enum(['agent_window', 'classic']).optional(),
        }),
      )
      .mutation(({ input }) => openRepositoryInCursor(input)),
  }),

  people: t.router({
    list: t.procedure.query(() => listPeople()),
    create: t.procedure
      .input(
        z.object({
          name: z.string().min(1),
          role: z.string().min(1),
          team: z.string().optional(),
          contact: z.string().optional(),
          feishuOpenId: z.string().optional(),
        }),
      )
      .mutation(({ input }) => createPerson(input)),
    update: t.procedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().optional(),
          role: z.string().optional(),
          team: z.string().nullable().optional(),
          contact: z.string().nullable().optional(),
          feishuOpenId: z.string().nullable().optional(),
        }),
      )
      .mutation(({ input }) => {
        const { id, ...fields } = input;
        return updatePerson(id, fields);
      }),
    delete: t.procedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => {
        const ok = deletePerson(input.id);
        return { ok };
      }),
  }),

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
        }),
      )
      .mutation(async ({ input }) => {
        const todo = getTodoById(input.todoId);
        if (!todo?.aiResultType) {
          throw new Error('待办无可修改的 AI 结果');
        }
        return reviseAiResult(input.todoId, todo.aiResultType, todo.title, input.revisionHint);
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
        }),
      )
      .mutation(async ({ input }) => resolvePersonalAssistantIntent(input.message, input)),
  }),
});

export type AppRouter = typeof appRouter;
