import type {
  GuardrailEngine,
  GuardrailVerdict,
  IntentRouteResult,
  PersonalToolName,
} from '@project-manager/shared';
import { getTodoById } from '../services/todo-service.js';

/** 与产品输入上限一致；无独立配置项时硬编码 */
const MAX_INPUT_LENGTH = 2000;

/** 提示注入模式表（guardrail-enhancement §3.1） */
const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /system\s*prompt/i,
  /you\s+are\s+now/i,
  /\[\s*INST\s*\]/i,
  /<\s*script/i,
];

/** 意图层敏感动作词（guardrail-enhancement §3.2） */
const SENSITIVE_ACTION_PATTERNS: RegExp[] = [/删除所有待办/, /删除全部/, /清空数据库/];

const OK_VERDICT = (layer: GuardrailVerdict['layer']): GuardrailVerdict => ({
  allowed: true,
  layer,
  code: 'ok',
  message: '',
});

/**
 * 四层护栏引擎（F0 契约实现）
 * 规则细则 SSOT：TODO/guardrail-enhancement.md
 */
export class PersonalGuardrailEngine implements GuardrailEngine {
  checkInput(message: string): GuardrailVerdict {
    if (!message.trim()) {
      return {
        allowed: false,
        layer: 'input',
        code: 'empty_message',
        message: '请输入内容后再发送。',
      };
    }
    if (message.length > MAX_INPUT_LENGTH) {
      return {
        allowed: false,
        layer: 'input',
        code: 'input_too_long',
        message: '输入内容过长，请缩短后重试。',
      };
    }
    for (const pattern of INJECTION_PATTERNS) {
      if (pattern.test(message)) {
        return {
          allowed: false,
          layer: 'input',
          code: 'prompt_injection',
          message: '检测到不安全的输入内容，已拦截。',
        };
      }
    }
    return OK_VERDICT('input');
  }

  checkIntent(route: IntentRouteResult): GuardrailVerdict {
    if (route.confidence !== 'low') {
      return OK_VERDICT('intent');
    }
    const probe = `${route.reason} ${route.slots.title ?? ''}`;
    for (const pattern of SENSITIVE_ACTION_PATTERNS) {
      if (pattern.test(probe)) {
        return {
          allowed: false,
          layer: 'intent',
          code: 'sensitive_action_low_confidence',
          message: '该操作需要进一步确认，暂不自动执行。',
        };
      }
    }
    return OK_VERDICT('intent');
  }

  checkToolCall(tool: PersonalToolName, params: unknown): GuardrailVerdict {
    if (tool === 'todo.revise_ai') {
      const modifyTodoId = (params as { modifyTodoId?: number })?.modifyTodoId;
      if (typeof modifyTodoId !== 'number') {
        return {
          allowed: false,
          layer: 'tool',
          code: 'missing_modify_todo_id',
          message: '缺少有效的待办 ID。',
        };
      }
      const todo = getTodoById(modifyTodoId);
      if (!todo || !todo.aiResultType) {
        return {
          allowed: false,
          layer: 'tool',
          code: 'invalid_modify_todo_id',
          message: '待办不存在或不支持 AI 修改。',
        };
      }
    }
    return OK_VERDICT('tool');
  }

  checkOutput(reply: string): GuardrailVerdict {
    if (/server\/data\//.test(reply) || /\/Users\/[^\s'"]+\//.test(reply)) {
      return {
        allowed: false,
        layer: 'output',
        code: 'leaked_path',
        message: '回复包含内部路径，需脱敏后下发。',
      };
    }
    return OK_VERDICT('output');
  }
}

/** 输出层脱敏（G5）：路径替换为占位符 */
export function sanitizeAssistantReply(reply: string): string {
  return reply
    .replace(/server\/data\/[^\s'"]+/g, '[路径已隐藏]')
    .replace(/\/Users\/[^\s'"]+/g, '[路径已隐藏]');
}

export const personalGuardrailEngine = new PersonalGuardrailEngine();
