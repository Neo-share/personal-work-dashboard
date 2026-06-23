import type { AiResultType, PersonalAssistantSoulSettings } from '@project-manager/shared';
import { AI_RESULT_TYPE_LABELS } from '@project-manager/shared';
import type { KnowledgeSnippet } from '../services/internal-knowledge-retriever.js';
import { getPersonalAssistantSoulSettings } from '../services/personal-assistant-soul-service.js';
import { getLlmModelForPurpose } from './llm-config.js';
import { chatCompletionWithMetrics } from './llm-metrics.js';

export interface LlmAiGenerateInput {
  resultType: AiResultType;
  title: string;
  description?: string | null;
  soulSettings?: PersonalAssistantSoulSettings;
  snippets?: KnowledgeSnippet[];
}

export interface LlmAiReviseInput {
  resultType: AiResultType;
  title: string;
  currentHtml: string;
  revisionHint: string;
  soulSettings?: PersonalAssistantSoulSettings;
  snippets?: KnowledgeSnippet[];
}

/** 各结果类型的 HTML 结构要求（对齐个人工作台 §6.3） */
/** 各结果类型 completion 上限（降 completion Token） */
const MAX_TOKENS_BY_TYPE: Record<AiResultType, number> = {
  minutes: 1024,
  review: 1024,
  audit: 768,
  plan: 1024,
  report: 768,
  analysis: 512,
  pick: 512,
};

const RESULT_TYPE_HINTS: Record<AiResultType, string> = {
  minutes: '包含：进度、要点列表、结论。使用 <h3>、<ul><li> 等标签。',
  review: '包含：统计卡片（可用 flex 布局的小块）+ 结论段落。',
  audit: '包含：合规审核清单，使用有序列表 <ol><li>，项可用 ✓ / □ 标记状态。',
  plan: '包含：背景、步骤列表、风险说明。',
  report: '包含：摘要段落 + 要点列表。',
  analysis: '包含：指标分析表格 <table>，含表头与至少 2 行数据。',
  pick: '包含：基金/产品对比表格 <table>，含名称、收益、风险等列。',
};

function buildSoulHint(soul: PersonalAssistantSoulSettings): string {
  const toneMap: Record<PersonalAssistantSoulSettings['tone'], string> = {
    formal: '语气正式、书面',
    friendly: '语气友好、口语化',
    concise: '语气简洁、要点突出',
  };
  const parts = [toneMap[soul.tone]];
  if (soul.customInstructions) {
    parts.push(`用户偏好：${soul.customInstructions}`);
  }
  return parts.join('；');
}

function buildContextBlock(snippets?: KnowledgeSnippet[]): string {
  if (!snippets?.length) {
    return '';
  }
  const lines = snippets.map(
    (item) => `- [${item.label}] (${item.id}) ${item.excerpt}`,
  );
  return ['参考以下资料（须优先采信，勿编造外链）：', ...lines].join('\n');
}

function buildSystemPrompt(
  resultType: AiResultType,
  soul: PersonalAssistantSoulSettings,
  mode: 'generate' | 'revise',
): string {
  const action =
    mode === 'generate'
      ? '为待办事项生成结构化 HTML 初步结果'
      : '根据用户修订意见更新已有 HTML 结果';
  return [
    `你是个人工作台的 AI 助手，负责${action}。`,
    `结果类型：${AI_RESULT_TYPE_LABELS[resultType]}（${resultType}）`,
    `结构要求：${RESULT_TYPE_HINTS[resultType]}`,
    `表达风格：${buildSoulHint(soul)}`,
    '约束：',
    '- 只输出 HTML 片段，不要 markdown 代码块，不要解释性前后缀',
    '- 内容应贴合待办标题与内部参考资料，可合理推断但勿编造具体外链或人名',
    '- 修订时保留原结果有效结构，按用户意见增量修改',
    '- 使用中文',
  ].join('\n');
}

function buildUserPrompt(input: LlmAiGenerateInput): string {
  const lines = [`待办标题：${input.title}`];
  if (input.description?.trim()) {
    lines.push(`待办描述：${input.description.trim()}`);
  }
  const context = buildContextBlock(input.snippets);
  if (context) {
    lines.push('', context);
  }
  lines.push('', '请生成该待办的 AI 初步结果 HTML。');
  return lines.join('\n');
}

function buildReviseUserPrompt(input: LlmAiReviseInput): string {
  const lines = [
    `待办标题：${input.title}`,
    `用户修订意见：${input.revisionHint}`,
    '',
    '当前结果 HTML：',
    input.currentHtml,
  ];
  const context = buildContextBlock(input.snippets);
  if (context) {
    lines.push('', context);
  }
  lines.push('', '请输出修订后的完整 HTML。');
  return lines.join('\n');
}

/** 去除模型可能包裹的 markdown 代码块 */
function normalizeHtmlOutput(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:html)?\s*([\s\S]*?)```$/i);
  return (fenced?.[1] ?? trimmed).trim();
}

/**
 * 调用 LLM 生成待办 AI 初步结果 HTML
 * @throws 未配置 LLM 或请求失败时抛出
 */
export async function generateAiResultWithLlm(input: LlmAiGenerateInput): Promise<string> {
  const soul = input.soulSettings ?? getPersonalAssistantSoulSettings();
  const result = await chatCompletionWithMetrics('generate', {
    model: getLlmModelForPurpose('generate'),
    messages: [
      { role: 'system', content: buildSystemPrompt(input.resultType, soul, 'generate') },
      { role: 'user', content: buildUserPrompt(input) },
    ],
    temperature: 0.6,
    maxTokens: MAX_TOKENS_BY_TYPE[input.resultType],
  });

  const html = normalizeHtmlOutput(result.content);
  if (!html) {
    throw new Error('LLM 返回 HTML 为空');
  }
  return html;
}

/**
 * 调用 LLM 修订待办 AI 结果 HTML
 * @throws 未配置 LLM 或请求失败时抛出
 */
export async function reviseAiResultWithLlm(input: LlmAiReviseInput): Promise<string> {
  const soul = input.soulSettings ?? getPersonalAssistantSoulSettings();
  const result = await chatCompletionWithMetrics('revise', {
    model: getLlmModelForPurpose('revise'),
    messages: [
      { role: 'system', content: buildSystemPrompt(input.resultType, soul, 'revise') },
      { role: 'user', content: buildReviseUserPrompt(input) },
    ],
    temperature: 0.5,
    maxTokens: MAX_TOKENS_BY_TYPE[input.resultType],
  });

  const html = normalizeHtmlOutput(result.content);
  if (!html) {
    throw new Error('LLM 返回 HTML 为空');
  }
  return html;
}
