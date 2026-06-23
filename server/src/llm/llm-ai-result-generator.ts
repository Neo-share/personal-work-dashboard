import type { AiResultType, PersonalAssistantSoulSettings } from '@project-manager/shared';
import { AI_RESULT_TYPE_LABELS } from '@project-manager/shared';
import { getPersonalAssistantSoulSettings } from '../services/personal-assistant-soul-service.js';
import { createLlmClient } from './openai-client.js';

export interface LlmAiGenerateInput {
  resultType: AiResultType;
  title: string;
  description?: string | null;
  soulSettings?: PersonalAssistantSoulSettings;
}

/** 各结果类型的 HTML 结构要求（对齐个人工作台 §6.3） */
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

function buildSystemPrompt(resultType: AiResultType, soul: PersonalAssistantSoulSettings): string {
  return [
    '你是个人工作台的 AI 助手，负责为待办事项生成结构化 HTML 初步结果。',
    `结果类型：${AI_RESULT_TYPE_LABELS[resultType]}（${resultType}）`,
    `结构要求：${RESULT_TYPE_HINTS[resultType]}`,
    `表达风格：${buildSoulHint(soul)}`,
    '约束：',
    '- 只输出 HTML 片段，不要 markdown 代码块，不要解释性前后缀',
    '- 内容应贴合待办标题与描述，可合理推断但勿编造具体外链或人名',
    '- 使用中文',
  ].join('\n');
}

function buildUserPrompt(input: LlmAiGenerateInput): string {
  const lines = [`待办标题：${input.title}`];
  if (input.description?.trim()) {
    lines.push(`待办描述：${input.description.trim()}`);
  }
  lines.push('请生成该待办的 AI 初步结果 HTML。');
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
  const client = createLlmClient();
  if (!client) {
    throw new Error('LLM 未配置');
  }

  const soul = input.soulSettings ?? getPersonalAssistantSoulSettings();
  const result = await client.chatCompletion({
    messages: [
      { role: 'system', content: buildSystemPrompt(input.resultType, soul) },
      { role: 'user', content: buildUserPrompt(input) },
    ],
    temperature: 0.6,
    maxTokens: 2048,
  });

  const html = normalizeHtmlOutput(result.content);
  if (!html) {
    throw new Error('LLM 返回 HTML 为空');
  }
  return html;
}
