import type { PersonalAssistantRefresh, ToolDefinition } from '@project-manager/shared';
import { z } from 'zod';
import {
  createRecurringTask,
  materializeRecurringTask,
} from '../../services/recurring-task-service.js';

export interface RecurringCreateResult {
  refresh: PersonalAssistantRefresh[];
  taskId: number;
  title: string;
}

export interface RecurringMaterializeResult {
  refresh: PersonalAssistantRefresh[];
  todoIds: number[];
}

export const recurringCreateTool: ToolDefinition<
  {
    title: string;
    frequency: 'daily' | 'weekly' | 'monthly';
    dayOfWeek?: number;
    dayOfMonth?: number;
    timeOfDay: string;
  },
  RecurringCreateResult
> = {
  name: 'recurring.create',
  description: '创建定时任务',
  paramsSchema: z.object({
    title: z.string().min(1),
    frequency: z.enum(['daily', 'weekly', 'monthly']),
    dayOfWeek: z.number().int().min(0).max(6).optional(),
    dayOfMonth: z.number().int().min(1).max(31).optional(),
    timeOfDay: z.string().min(1),
  }),
  execute: async (params) => {
    const task = createRecurringTask(params);
    return {
      refresh: ['recurringTasks', 'todos', 'summary'],
      taskId: task.id,
      title: task.title,
    };
  },
};

export const recurringMaterializeTool: ToolDefinition<
  { taskId: number },
  RecurringMaterializeResult
> = {
  name: 'recurring.materialize',
  description: '物化定时任务为待办',
  paramsSchema: z.object({
    taskId: z.number().int().positive(),
  }),
  execute: async (params) => {
    const { todoIds } = materializeRecurringTask(params.taskId);
    return {
      refresh: ['todos', 'summary'],
      todoIds,
    };
  },
};
