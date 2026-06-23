/**
 * 个人助手五层底座 — F0 冻结契约（2026-06-23）
 *
 * 协议类型定义。实现见 server/src/assistant/。
 * 设计说明：server/src/assistant/ARCHITECTURE.md §3
 */

import type {
  AssistantMessage,
  PersonalAssistantRefresh,
  PersonalAssistantResult,
  PersonalAssistantSoulSettings,
  TodoItem,
} from './types.js';

// ---------------------------------------------------------------------------
// 3.1 IntentRouter
// ---------------------------------------------------------------------------

/** 自然语言路由意图类型（含重复周期纯会议 → 日程） */
export type PersonalIntentType =
  | 'schedule'
  | 'todo'
  | 'recurring'
  | 'recurring_schedule'
  | 'revise_ai'
  | 'unknown';

export interface IntentSlot {
  title?: string;
  dueAt?: string;
  startAt?: string;
  endAt?: string;
  frequency?: 'daily' | 'weekly' | 'monthly';
  timeOfDay?: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
  modifyTodoId?: number;
}

export interface IntentRouteResult {
  type: PersonalIntentType;
  confidence: 'high' | 'medium' | 'low';
  slots: IntentSlot;
  /** 助手回复中说明识别类型的依据 */
  reason: string;
}

export interface IntentRouteContext {
  sessionId: number;
  modifyTodoId?: number;
}

export interface IntentRouter {
  route(message: string, context: IntentRouteContext): IntentRouteResult;
}

// ---------------------------------------------------------------------------
// 3.2 ToolRegistry
// ---------------------------------------------------------------------------

export type PersonalToolName =
  | 'todo.create'
  | 'todo.revise_ai'
  | 'schedule.create_local'
  | 'recurring.create'
  | 'recurring.materialize'
  | 'mcp.feishu.get_doc';

/** 实现侧为 Zod schema；契约层不引入 zod 依赖 */
export interface ToolDefinition<TParams = unknown, TResult = unknown> {
  name: PersonalToolName;
  description: string;
  paramsSchema: unknown;
  execute: (params: TParams, ctx: ToolContext) => Promise<TResult>;
}

/** MCP 外部知识片段（F4） */
export interface ExternalSnippet {
  source: string;
  excerpt: string;
}

export interface ToolContext {
  sessionId: number;
  metrics: MetricsLedger;
  /** 编排层组装的会话上下文，供副作用工具读取 externalSnippets */
  assistantContext?: AssistantContext;
}

export interface ToolInvokeResult {
  tool: PersonalToolName;
  refresh?: PersonalAssistantRefresh[];
  payload?: unknown;
}

export interface ToolRegistry {
  register<TParams, TResult>(def: ToolDefinition<TParams, TResult>): void;
  invoke(tool: PersonalToolName, params: unknown, ctx: ToolContext): Promise<ToolInvokeResult>;
  listTools(): PersonalToolName[];
}

/** 意图 → 工具映射（F0 冻结） */
export const PERSONAL_INTENT_TOOL_MAP: Record<
  Exclude<PersonalIntentType, 'unknown' | 'revise_ai'>,
  PersonalToolName[]
> = {
  schedule: ['schedule.create_local'],
  todo: ['todo.create'],
  recurring: ['recurring.create', 'recurring.materialize'],
  recurring_schedule: ['schedule.create_local'],
};

// ---------------------------------------------------------------------------
// 3.3 GuardrailEngine
// ---------------------------------------------------------------------------

export type GuardrailLayer = 'input' | 'intent' | 'tool' | 'output';

export interface GuardrailVerdict {
  allowed: boolean;
  layer: GuardrailLayer;
  code: string;
  message: string;
}

export interface GuardrailEngine {
  checkInput(message: string): GuardrailVerdict;
  checkIntent(route: IntentRouteResult): GuardrailVerdict;
  checkToolCall(tool: PersonalToolName, params: unknown): GuardrailVerdict;
  checkOutput(reply: string): GuardrailVerdict;
}

/** SSE blocked 事件载荷（与 chat 路由、PersonalAssistantPanel 对齐） */
export interface PersonalAssistantBlockedEvent {
  type: 'blocked';
  code: string;
  message: string;
}

// ---------------------------------------------------------------------------
// 3.4 ContextRetriever
// ---------------------------------------------------------------------------

export interface AssistantContext {
  sessionId: number;
  recentMessages: AssistantMessage[];
  activeTodo?: TodoItem;
  todayScheduleCount?: number;
  /** Soul 偏好，见 personal-assistant-soul-service */
  soulSettings?: PersonalAssistantSoulSettings;
  /** F4：MCP 外部文档片段，见 docs/个人工作台/个人工作台-交付说明.md §9 */
  externalSnippets?: ExternalSnippet[];
}

export interface ContextRetrieveOptions {
  modifyTodoId?: number;
  /** 用户当前消息，用于提取飞书链接并拉取外部片段 */
  message?: string;
}

export interface ContextRetriever {
  retrieve(sessionId: number, options?: ContextRetrieveOptions): Promise<AssistantContext>;
}

// ---------------------------------------------------------------------------
// 3.5 MetricsLedger
// ---------------------------------------------------------------------------

export interface MetricEvent {
  name: string;
  ts: string;
  tags?: Record<string, string>;
  value?: number;
}

export interface MetricsLedger {
  record(event: MetricEvent): void;
  queryRecent(filter?: { name?: string; limit?: number }): MetricEvent[];
}

// ---------------------------------------------------------------------------
// 编排入口（F0 冻结）
// ---------------------------------------------------------------------------

export interface PersonalOrchestratorInput {
  message: string;
  sessionId?: number;
  modifyTodoId?: number;
}

export interface GuardrailBlocked {
  blocked: true;
  layer: GuardrailLayer;
  code: string;
  message: string;
}

export type PersonalOrchestratorOutput = PersonalAssistantResult | GuardrailBlocked;

export interface PersonalOrchestrator {
  handle(input: PersonalOrchestratorInput): Promise<PersonalOrchestratorOutput>;
}
