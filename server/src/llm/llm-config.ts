/** OpenAI 兼容 API 配置（从环境变量读取） */

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_TIMEOUT_MS = 30_000;

export interface LlmConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
}

/** 任务难度：简单 / 复杂 / 困难 */
export type LlmTaskDifficulty = 'simple' | 'complex' | 'difficult';

/** 调用场景（映射到难度档位） */
export type LlmModelPurpose = 'default' | 'title' | 'slots' | 'generate' | 'revise';

/** 场景 → 难度（默认走简单模型） */
const PURPOSE_DIFFICULTY: Record<LlmModelPurpose, LlmTaskDifficulty> = {
  default: 'simple',
  title: 'simple',
  slots: 'simple',
  generate: 'complex',
  revise: 'difficult',
};

/** 是否已配置 API Key（不校验连通性） */
export function isLlmConfigured(): boolean {
  return Boolean(process.env.LLM_API_KEY?.trim());
}

function resolveSimpleModel(): string {
  return process.env.LLM_MODEL_SIMPLE?.trim() || DEFAULT_MODEL;
}

function resolveComplexModel(): string {
  return process.env.LLM_MODEL_COMPLEX?.trim() || resolveSimpleModel();
}

function resolveDifficultModel(): string {
  return process.env.LLM_MODEL_DIFFICULT?.trim() || resolveComplexModel();
}

/** 按任务难度选择模型 */
export function getLlmModelForDifficulty(difficulty: LlmTaskDifficulty): string {
  switch (difficulty) {
    case 'simple':
      return resolveSimpleModel();
    case 'complex':
      return resolveComplexModel();
    case 'difficult':
      return resolveDifficultModel();
    default:
      return resolveSimpleModel();
  }
}

/** 按调用场景选择模型（内部映射到难度档位） */
export function getLlmModelForPurpose(purpose: LlmModelPurpose): string {
  return getLlmModelForDifficulty(PURPOSE_DIFFICULTY[purpose]);
}

/** 读取 LLM 配置；未配置 API Key 时返回 null；默认模型为简单档 */
export function getLlmConfig(): LlmConfig | null {
  const apiKey = process.env.LLM_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }

  const baseUrl = (process.env.LLM_API_BASE?.trim() || DEFAULT_BASE_URL).replace(/\/$/, '');
  const timeoutMs = Number(process.env.LLM_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);

  return {
    apiKey,
    baseUrl,
    model: resolveSimpleModel(),
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS,
  };
}
