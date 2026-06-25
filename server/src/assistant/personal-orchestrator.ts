import type {
  GuardrailBlocked,
  IntentRouteResult,
  PersonalAssistantRefresh,
  PersonalAssistantResult,
  PersonalIntentType,
  PersonalOrchestrator,
  PersonalOrchestratorInput,
  PersonalOrchestratorOutput,
  PersonalToolName,
} from '@project-manager/shared';
import { PERSONAL_INTENT_TOOL_MAP } from '@project-manager/shared';
import { extractTitleWithLlm, MAX_ASSISTANT_TITLE_LENGTH } from '../llm/llm-title-extractor.js';
import { getTodoById } from '../services/todo-service.js';
import { ruleBasedIntentRouter } from './intent-router.js';
import { mcpContextRetriever } from './mcp-context-retriever.js';
import {
  personalGuardrailEngine,
  sanitizeAssistantReply,
} from './guardrail-engine.js';
import { inMemoryMetricsLedger } from './metrics-ledger.js';
import { getPersonalToolRegistry } from './tools/register-tools.js';
import type { RecurringCreateResult } from './tools/recurring-tools.js';
import type { TodoCreateResult, TodoReviseAiResult } from './tools/todo-tools.js';
import {
  appendAssistantMessage,
  getOrCreateTodoSession,
  resolveAssistantSession,
} from '../services/assistant-session-service.js';

function recordIntentMetric(route: IntentRouteResult): void {
  inMemoryMetricsLedger.record({
    name: 'pw.intent.routed',
    ts: new Date().toISOString(),
    tags: { type: route.type, confidence: route.confidence },
  });
}

function recordGuardrailBlocked(layer: GuardrailBlocked['layer'], code: string): void {
  inMemoryMetricsLedger.record({
    name: 'pw.guardrail.blocked',
    ts: new Date().toISOString(),
    tags: { layer, code },
  });
}

function mergeRefresh(
  current: PersonalAssistantRefresh[] | undefined,
  next: PersonalAssistantRefresh[] | undefined,
): PersonalAssistantRefresh[] | undefined {
  if (!next?.length) return current;
  const merged = new Set<PersonalAssistantRefresh>(current ?? []);
  for (const item of next) merged.add(item);
  return [...merged];
}

function buildBlocked(verdict: {
  layer: GuardrailBlocked['layer'];
  code: string;
  message: string;
}): GuardrailBlocked {
  recordGuardrailBlocked(verdict.layer, verdict.code);
  return {
    blocked: true,
    layer: verdict.layer,
    code: verdict.code,
    message: verdict.message,
  };
}

function needsScheduleTime(type: PersonalIntentType): boolean {
  return type === 'schedule' || type === 'recurring_schedule';
}

function buildUnknownReply(): string {
  return '我可以帮你创建待办、安排日程或设置定时任务。例如："明天下午3点开项目评审会" 或 "本周五提醒我完成UI改版方案"。';
}

function buildTimeParseFailureReply(type: PersonalIntentType): string {
  if (type === 'recurring') {
    return '未能解析重复时间，请补充如「每天下午5点」后再试。';
  }
  return '未能解析具体时间，请补充如「明天下午3点」后再试。';
}

function buildReplyForIntent(
  route: IntentRouteResult,
  toolPayload: unknown,
): string {
  const { type, slots, confidence } = route;

  if (type === 'revise_ai') {
    const result = toolPayload as TodoReviseAiResult;
    const notes: string[] = [];
    if (result.contextSummary) notes.push(result.contextSummary);
    if (result.fromReviseCache) notes.push('命中修订缓存');
    const contextNote = notes.length ? `（${notes.join('；')}）` : '';
    return `已根据你的意见更新结果至 v${result.modifyVersion}${contextNote}。`;
  }

  if (type === 'recurring_schedule') {
    const displayTitle = slots.title ?? '例会';
    return `已识别为例会安排，无需创建待办。已写入日程「${displayTitle}」。`;
  }

  if (type === 'recurring') {
    const displayTitle = slots.title ?? '定时任务';
    return `已识别为重复执行任务，已创建定时任务「${displayTitle}」，到期将物化待办。`;
  }

  if (type === 'todo') {
    const result = toolPayload as TodoCreateResult;
    const prefix =
      confidence === 'medium' ? '已添加待办' : '已识别为待执行事项，已添加待办';
    const aiSuffix =
      result.aiStatus === 'ready'
        ? '，AI 初步结果已生成。'
        : result.aiStatus === 'pending'
          ? '，AI 初步结果生成中…'
          : '。';
    return `${prefix}「${result.title}」${aiSuffix}`;
  }

  if (type === 'schedule') {
    const displayTitle = slots.title ?? '会议安排';
    return `已识别为会议安排，无需创建待办。已写入日程「${displayTitle}」。`;
  }

  return buildUnknownReply();
}

function buildToolParams(
  tool: PersonalToolName,
  route: IntentRouteResult,
  message: string,
  modifyTodoId?: number,
  createdTaskId?: number,
): unknown {
  const { slots, type } = route;

  switch (tool) {
    case 'todo.create':
      return {
        title: slots.title ?? (message.trim().slice(0, MAX_ASSISTANT_TITLE_LENGTH) || '待办事项'),
        description: '来源：自然语言',
        dueAt: slots.dueAt,
        source: 'natural_language' as const,
      };
    case 'todo.revise_ai':
      return {
        modifyTodoId: modifyTodoId!,
        revisionHint: message,
      };
    case 'schedule.create_local':
      return {
        title: slots.title ?? (type === 'recurring_schedule' ? '例会' : '会议安排'),
        startAt: slots.startAt!,
        endAt: slots.endAt!,
      };
    case 'recurring.create':
      return {
        title: slots.title ?? '定时任务',
        frequency: slots.frequency!,
        dayOfWeek: slots.dayOfWeek,
        dayOfMonth: slots.dayOfMonth,
        timeOfDay: slots.timeOfDay ?? '17:00',
      };
    case 'recurring.materialize':
      return { taskId: createdTaskId! };
    default:
      return {};
  }
}

/**
 * 个人助手编排入口（F0 契约）：护栏 → 意图 → 工具 → 指标
 */
export class PersonalAssistantOrchestrator implements PersonalOrchestrator {
  async handle(input: PersonalOrchestratorInput): Promise<PersonalOrchestratorOutput> {
    const orchestratorStarted = Date.now();
    const result = await this.handleInternal(input);
    inMemoryMetricsLedger.record({
      name: 'pw.orchestrator.latency_ms',
      ts: new Date().toISOString(),
      tags: {
        blocked: String('blocked' in result && result.blocked),
      },
      value: Date.now() - orchestratorStarted,
    });
    return result;
  }

  private async handleInternal(input: PersonalOrchestratorInput): Promise<PersonalOrchestratorOutput> {
    const text = input.message.trim();
    const session =
      input.modifyTodoId && getTodoById(input.modifyTodoId)
        ? getOrCreateTodoSession(input.modifyTodoId)
        : resolveAssistantSession(input.sessionId);
    const toolRegistry = getPersonalToolRegistry();

    const inputVerdict = personalGuardrailEngine.checkInput(text);
    if (!inputVerdict.allowed) {
      return buildBlocked(inputVerdict);
    }

    const assistantContext = {
      ...(await mcpContextRetriever.retrieve(session.id, {
        modifyTodoId: input.modifyTodoId,
        message: text,
      })),
      skipReviseCache: input.skipReviseCache,
    };
    const toolCtx = { sessionId: session.id, metrics: inMemoryMetricsLedger, assistantContext };

    appendAssistantMessage(session.id, 'user', text);

    const route = ruleBasedIntentRouter.route(text, {
      sessionId: session.id,
      modifyTodoId: input.modifyTodoId,
    });
    recordIntentMetric(route);

    const intentVerdict = personalGuardrailEngine.checkIntent(route);
    if (!intentVerdict.allowed) {
      return buildBlocked(intentVerdict);
    }

    // 修改模式：revise_ai
    if (route.type === 'revise_ai' && input.modifyTodoId) {
      const toolParams = buildToolParams('todo.revise_ai', route, text, input.modifyTodoId);
      const toolVerdict = personalGuardrailEngine.checkToolCall('todo.revise_ai', toolParams);
      if (!toolVerdict.allowed) {
        return buildBlocked(toolVerdict);
      }

      const invokeResult = await toolRegistry.invoke('todo.revise_ai', toolParams, toolCtx);
      const payload = invokeResult.payload as TodoReviseAiResult;
      let reply = buildReplyForIntent(route, payload);
      const outputVerdict = personalGuardrailEngine.checkOutput(reply);
      if (!outputVerdict.allowed) {
        reply = sanitizeAssistantReply(reply);
      }
      appendAssistantMessage(session.id, 'assistant', reply, payload.modifyResultId);
      return {
        reply,
        refresh: invokeResult.refresh,
        modifyTodoId: payload.modifyTodoId,
        modifyVersion: payload.modifyVersion,
      };
    }

    // 未知意图：结构化引导，不写库
    if (route.type === 'unknown') {
      const reply = buildUnknownReply();
      appendAssistantMessage(session.id, 'assistant', reply);
      return { reply };
    }

    // 时间解析失败：结构化提示，不写库
    if (needsScheduleTime(route.type) && (!route.slots.startAt || !route.slots.endAt)) {
      const reply = buildTimeParseFailureReply(route.type);
      appendAssistantMessage(session.id, 'assistant', reply);
      return { reply };
    }

    if (route.type === 'recurring' && !route.slots.frequency) {
      const reply = buildTimeParseFailureReply(route.type);
      appendAssistantMessage(session.id, 'assistant', reply);
      return { reply };
    }

    const resolvedTitle = await extractTitleWithLlm(text, route.type);
    const routeWithTitle: IntentRouteResult = {
      ...route,
      slots: { ...route.slots, title: resolvedTitle },
    };

    const intentTools =
      routeWithTitle.type === 'revise_ai'
        ? (['todo.revise_ai'] as PersonalToolName[])
        : PERSONAL_INTENT_TOOL_MAP[routeWithTitle.type as keyof typeof PERSONAL_INTENT_TOOL_MAP];

    let refresh: PersonalAssistantRefresh[] | undefined;
    let lastPayload: unknown;
    let createdTaskId: number | undefined;

    for (const toolName of intentTools) {
      const params = buildToolParams(toolName, routeWithTitle, text, input.modifyTodoId, createdTaskId);
      const toolVerdict = personalGuardrailEngine.checkToolCall(toolName, params);
      if (!toolVerdict.allowed) {
        return buildBlocked(toolVerdict);
      }

      const invokeResult = await toolRegistry.invoke(toolName, params, toolCtx);
      refresh = mergeRefresh(refresh, invokeResult.refresh);
      lastPayload = invokeResult.payload;

      if (toolName === 'recurring.create') {
        createdTaskId = (invokeResult.payload as RecurringCreateResult).taskId;
      }
    }

    let reply = buildReplyForIntent(routeWithTitle, lastPayload);
    const outputVerdict = personalGuardrailEngine.checkOutput(reply);
    if (!outputVerdict.allowed) {
      reply = sanitizeAssistantReply(reply);
    }

    appendAssistantMessage(session.id, 'assistant', reply);

    inMemoryMetricsLedger.record({
      name: 'pw.orchestrator.completed',
      ts: new Date().toISOString(),
      tags: { type: routeWithTitle.type },
    });

    const result: PersonalAssistantResult = { reply, refresh };

    if (route.type === 'revise_ai' && lastPayload) {
      const payload = lastPayload as TodoReviseAiResult;
      result.modifyTodoId = payload.modifyTodoId;
      result.modifyVersion = payload.modifyVersion;
    }

    return result;
  }
}

export const personalAssistantOrchestrator = new PersonalAssistantOrchestrator();
