import type { PersonalAssistantRefresh, ToolDefinition } from '@project-manager/shared';
import { z } from 'zod';
import { reviseAiResult } from '../../services/ai-result-service.js';
import { createTodo, getTodoById } from '../../services/todo-service.js';

export interface TodoCreateResult {
  refresh: PersonalAssistantRefresh[];
  todoId: number;
  title: string;
  aiStatus: string;
}

export interface TodoReviseAiResult {
  refresh: PersonalAssistantRefresh[];
  modifyTodoId: number;
  modifyVersion: number;
  contextSummary?: string;
  fromReviseCache?: boolean;
}

export const todoCreateTool: ToolDefinition<
  {
    title: string;
    description?: string;
    dueAt?: string;
    source?: 'manual' | 'natural_language' | 'recurring_task';
  },
  TodoCreateResult
> = {
  name: 'todo.create',
  description: '创建待办并触发能力判定',
  paramsSchema: z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    dueAt: z.string().optional(),
    source: z.enum(['manual', 'natural_language', 'recurring_task']).optional(),
  }),
  execute: async (params, ctx) => {
    const todo = createTodo({
      title: params.title,
      description: params.description ?? '来源：自然语言',
      dueAt: params.dueAt,
      source: params.source ?? 'natural_language',
      externalSnippets: ctx.assistantContext?.externalSnippets,
    });
    return {
      refresh: ['todos', 'summary'],
      todoId: todo.id,
      title: todo.title,
      aiStatus: todo.aiStatus,
    };
  },
};

export const todoReviseAiTool: ToolDefinition<
  { modifyTodoId: number; revisionHint: string },
  TodoReviseAiResult
> = {
  name: 'todo.revise_ai',
  description: '根据用户意见修订待办 AI 结果',
  paramsSchema: z.object({
    modifyTodoId: z.number().int().positive(),
    revisionHint: z.string().min(1),
  }),
  execute: async (params, ctx) => {
    const todo = getTodoById(params.modifyTodoId);
    if (!todo || !todo.aiResultType) {
      throw new Error('待办不存在或不支持 AI 修改');
    }
    const revised = await reviseAiResult(
      params.modifyTodoId,
      todo.aiResultType,
      todo.title,
      params.revisionHint,
      ctx.assistantContext?.externalSnippets,
      {
        sessionId: ctx.sessionId,
        skipReviseCache: ctx.assistantContext?.skipReviseCache,
      },
    );
    return {
      refresh: ['todos'],
      modifyTodoId: params.modifyTodoId,
      modifyVersion: revised.version,
      contextSummary: revised.contextSummary,
      fromReviseCache: revised.fromReviseCache,
    };
  },
};
