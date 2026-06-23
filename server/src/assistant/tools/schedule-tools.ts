import type { PersonalAssistantRefresh, ToolDefinition } from '@project-manager/shared';
import { z } from 'zod';
import { createLocalSchedule } from '../../services/schedule-service.js';

export interface ScheduleCreateResult {
  refresh: PersonalAssistantRefresh[];
  title: string;
}

export const scheduleCreateLocalTool: ToolDefinition<
  { title: string; startAt: string; endAt: string },
  ScheduleCreateResult
> = {
  name: 'schedule.create_local',
  description: '写入本地日程事件',
  paramsSchema: z.object({
    title: z.string().min(1),
    startAt: z.string().min(1),
    endAt: z.string().min(1),
  }),
  execute: async (params) => {
    createLocalSchedule(params);
    return {
      refresh: ['schedule', 'summary'],
      title: params.title,
    };
  },
};
