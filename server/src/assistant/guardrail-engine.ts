import type {
  GuardrailEngine,
  GuardrailVerdict,
  IntentRouteResult,
  PersonalToolName,
} from '@project-manager/shared';
import { getTodoById } from '../services/todo-service.js';

/** 与产品输入上限一致；无独立配置项时硬编码 */
const MAX_INPUT_LENGTH = 2000;

/**
 * 护栏匹配前归一化（参考 OWASP LLM Prompt Injection Prevention Cheat Sheet）
 * - NFKC：折叠全角/兼容字符
 * - 去除零宽字符：常见绕过手段
 * - 折叠空白：分散插入空格的注入
 */
export function normalizeGuardrailText(text: string): string {
  return text
    .normalize('NFKC')
    // 零宽字符替换为空格，避免 ignore\u200Bprevious 粘连后漏检
    .replace(/[\u200B-\u200D\uFEFF]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 提示注入模式表（guardrail-enhancement §3.1）
 * 分类参考 OWASP LLM01:2025 / Prompt Injection Prevention Cheat Sheet
 */
const INJECTION_PATTERNS: RegExp[] = [
  // 指令覆盖
  /(?:ignore|disregard|forget|override|bypass)\s+(?:all\s+|your\s+|previous\s+|prior\s+|above\s+)*(?:instructions?|prompts?|rules?|directives?)/i,
  /new\s+instructions?\s*:/i,
  /(?:the\s+)?following\s+is\s+(?:the\s+)?(?:real|true|actual)\s+instruction/i,
  // 系统提示词提取
  /(?:reveal|show|display|output|print|repeat|expose|leak)\s+(?:your\s+|the\s+|system\s+|hidden\s+)*(?:prompt|instructions?|system\s+message)/i,
  /(?:what\s+(?:is|are)\s+your\s+)(?:system\s+)?(?:prompt|instructions?)/i,
  // 角色劫持 / 越狱
  /you\s+are\s+now\s+(?:in\s+)?(?:developer|debug|admin|unrestricted)\s+mode/i,
  /(?:act|behave|respond)\s+as\s+(?:if\s+you\s+(?:are|were)\s+)?(?:a\s+)?(?:DAN|unrestricted|unfiltered)/i,
  /(?:developer|jailbreak|DAN)\s+mode/i,
  /pretend\s+(?:you\s+)?(?:have\s+)?no\s+(?:restrictions?|rules?|limitations?|guidelines?)/i,
  /(?:without|ignore)\s+(?:any\s+)?(?:safety|content)\s+(?:guidelines?|rules?|filters?)/i,
  /system\s+override/i,
  // 模板分隔符注入
  /\[\s*INST\s*\]/i,
  /\[\s*\/\s*INST\s*\]/i,
  /<<\s*SYS\s*>>/i,
  /<\|im_start\|>/i,
  /<\|im_end\|>/i,
  /\[SYSTEM\]/i,
  /###\s*(?:System|Instruction|Human|Assistant)\b/i,
  // XSS / 代码片段
  /<\s*script/i,
  /javascript\s*:/i,
  // 中文注入
  /忽略(?:以上|之前|先前)?(?:的)?(?:全部|所有)?(?:指令|指示|规则|提示|约束)/,
  /无视(?:之前|以上|系统|所有)(?:的)?(?:指令|规则|提示)/,
  /(?:输出|显示|泄露|复述)(?:你的|系统)(?:提示词|指令|prompt)/i,
  /你现在是(?:开发者|调试|管理员|无限制)模式/,
  /扮演(?:一个)?(?:没有|无)(?:任何)?(?:限制|规则|约束)/,
  /越狱模式|开发者模式已激活/,
];

/** 意图层 / 输入层敏感动作词（guardrail-enhancement §3.2） */
const SENSITIVE_ACTION_PATTERNS: RegExp[] = [
  /删除所有待办/,
  /删除全部待办/,
  /清空所有待办/,
  /批量删除(?:所有)?待办/,
  /删除所有(?:日程|会议|定时任务)/,
  /清空(?:所有)?(?:待办|日程)/,
  /删除全部/,
  /清空数据库/,
  /(?:drop|truncate)\s+table/i,
  /delete\s+all\s+(?:todos?|tasks?|data)/i,
  /wipe\s+(?:all\s+)?(?:data|database|todos?)/i,
  /rm\s+-rf/i,
];

const OK_VERDICT = (layer: GuardrailVerdict['layer']): GuardrailVerdict => ({
  allowed: true,
  layer,
  code: 'ok',
  message: '',
});

function matchesAnyPattern(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

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

    const normalized = normalizeGuardrailText(message);

    if (matchesAnyPattern(normalized, INJECTION_PATTERNS)) {
      return {
        allowed: false,
        layer: 'input',
        code: 'prompt_injection',
        message: '检测到不安全的输入内容，已拦截。',
      };
    }

    // 高风险破坏性指令在输入层直接拦截（不依赖意图置信度）
    if (matchesAnyPattern(normalized, SENSITIVE_ACTION_PATTERNS)) {
      return {
        allowed: false,
        layer: 'input',
        code: 'sensitive_action',
        message: '检测到高风险操作指令，已拦截。',
      };
    }

    return OK_VERDICT('input');
  }

  checkIntent(route: IntentRouteResult): GuardrailVerdict {
    if (route.confidence !== 'low') {
      return OK_VERDICT('intent');
    }
    const probe = normalizeGuardrailText(`${route.reason} ${route.slots.title ?? ''}`);
    if (matchesAnyPattern(probe, SENSITIVE_ACTION_PATTERNS)) {
      return {
        allowed: false,
        layer: 'intent',
        code: 'sensitive_action_low_confidence',
        message: '该操作需要进一步确认，暂不自动执行。',
      };
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
