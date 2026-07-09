// ─── 个人工作台 ─────────────────────────────────────────────

/** 待办来源 */
export type TodoSource = 'manual' | 'natural_language' | 'recurring_task';

/** 待办状态 */
export type TodoStatus = 'active' | 'completed' | 'cancelled';

/** 待办 AI 生成状态 */
export type TodoAiStatus = 'none' | 'pending' | 'ready' | 'confirmed' | 'failed';

/** AI 结果类型（能力判定） */
export type AiResultType =
  | 'minutes'
  | 'review'
  | 'audit'
  | 'plan'
  | 'report'
  | 'analysis'
  | 'pick';

/** AI 结果版本状态 */
export type AiResultStatus = 'pending' | 'ready' | 'confirmed' | 'failed';

/** 日历渠道 */
export type CalendarSourceType = 'feishu' | 'dingtalk' | 'outlook' | 'local';

/** 定时任务重复周期 */
export type RecurringFrequency = 'daily' | 'weekly' | 'monthly';

/** 待办筛选 */
export type TodoFilter = 'active' | 'all' | 'completed' | 'overdue';

export interface TodoItem {
  id: number;
  title: string;
  description: string | null;
  dueAt: string | null;
  source: TodoSource;
  status: TodoStatus;
  isUrgent: boolean;
  aiStatus: TodoAiStatus;
  aiResultType: AiResultType | null;
  recurringTaskId: number | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** 列表接口计算字段 */
  isOverdue?: boolean;
  /** 最新 AI 结果版本号 */
  latestAiVersion?: number | null;
}

export interface TodoAiResult {
  id: number;
  todoId: number;
  version: number;
  resultType: AiResultType;
  htmlContent: string;
  status: AiResultStatus;
  provider: string | null;
  createdAt: string;
}

export interface ScheduleEventSource {
  id: number;
  eventId: number;
  source: CalendarSourceType;
  title: string;
  startAt: string;
  endAt: string;
}

export interface ScheduleEvent {
  id: number;
  title: string;
  startAt: string;
  endAt: string;
  isMerged: boolean;
  sources: ScheduleEventSource[];
}

export interface CalendarSource {
  id: number;
  source: CalendarSourceType;
  label: string;
  enabled: boolean;
  lastSyncedAt: string | null;
}

export interface RecurringTask {
  id: number;
  title: string;
  frequency: RecurringFrequency;
  /** 每周：0=周日 … 6=周六；每月：1-31 */
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  timeOfDay: string;
  todoDescription: string;
  enabled: boolean;
  nextTriggerAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PersonalWorkbenchSummary {
  scheduleCount: number;
  todoCount: number;
  overdueCount: number;
  completedCount: number;
  rawScheduleCount: number;
}

export interface AssistantSession {
  id: number;
  title: string;
  todoId: number | null;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface AssistantMessage {
  id: number;
  sessionId: number;
  role: 'user' | 'assistant';
  content: string;
  aiResultId: number | null;
  createdAt: string;
}

/** 历史对话左栏：带 AI 结果的待办线程摘要 */
export interface TodoAiThread {
  todoId: number;
  title: string;
  latestVersion: number;
  messageCount: number;
  latestHtmlPreview: string | null;
}

/** 个人助手 SSE 返回的刷新指令 */
export type PersonalAssistantRefresh =
  | 'todos'
  | 'schedule'
  | 'recurringTasks'
  | 'summary'
  | 'all';

export interface PersonalAssistantResult {
  reply: string;
  refresh?: PersonalAssistantRefresh[];
  /** 修改模式：关联待办 ID */
  modifyTodoId?: number;
  modifyVersion?: number;
}

/** 个人助手 Soul 偏好（settings KV 持久化） */
export type PersonalAssistantSoulTone = 'formal' | 'concise' | 'friendly';

export interface PersonalAssistantSoulSettings {
  tone: PersonalAssistantSoulTone;
  /** 注入助手回复与 AI 生成的自定义说明 */
  customInstructions: string;
}

export const PERSONAL_ASSISTANT_SOUL_TONE_LABELS: Record<PersonalAssistantSoulTone, string> = {
  formal: '正式',
  concise: '简洁',
  friendly: '友好',
};

export const TODO_SOURCE_LABELS: Record<TodoSource, string> = {
  manual: '手动添加',
  natural_language: '自然语言',
  recurring_task: '定时任务',
};

export const CALENDAR_SOURCE_LABELS: Record<CalendarSourceType, string> = {
  feishu: '飞书',
  dingtalk: '钉钉',
  outlook: 'Outlook',
  local: '本地',
};

export const RECURRING_FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  daily: '每天',
  weekly: '每周',
  monthly: '每月',
};

export const AI_RESULT_TYPE_LABELS: Record<AiResultType, string> = {
  minutes: '会议纪要',
  review: '复盘',
  audit: '审核',
  plan: '方案',
  report: '报告',
  analysis: '分析',
  pick: '选品',
};
